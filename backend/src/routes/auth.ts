import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { body, validationResult } from "express-validator";
import { Op } from "sequelize";
import { User, Like } from "../models";
import { generateToken } from "../utils/jwt";
import { getClientIp } from "../utils/ip";
import { AuthRequest } from "../middleware/auth";

const router = Router();

/**
 * 登录时把该用户的旧匿名点赞（visitorId/email/IP 维度）升级为 userId 维度。
 * WP Ulike 多维度升级（priority: visitorId > email > ip）：
 *   - visitorId 维度（cookie 游客）→ 补 userId + 清 visitorId/email/ip
 *   - email 维度（评论过游客）→ 补 userId + 清 email/ip
 *   - IP 维度（纯匿名游客）→ 补 userId + 清 email/ip
 *
 * 冲突处理：同 post 已有 userId 维度点赞 → 把旧维度记录软删为 unlike（WP Ulike status 翻转）
 * 升级后 meLiked 仅按 userId 查询即可，实现登录用户跨设备一致。
 */
async function migrateLikesToUserId(user: User, ip: string, visitorId?: string) {
  // 1) visitorId 维度 → userId（cookie 游客登录）
  if (visitorId) {
    const cookieLikes = await Like.findAll({
      where: { visitorId, userId: null },
    });
    for (const like of cookieLikes) {
      const dup = await Like.findOne({ where: { postId: like.postId, userId: user.id } });
      if (dup) {
        // 冲突：保留用户最新的点赞意图。
        // 旧维度是 like 但 userId 维度是 unlike → 把 userId 维度恢复为 like
        // 然后软删旧维度记录为 unlike（不物理删除，保留历史）
        if (like.status === "like") {
          if (dup.status === "unlike") {
            await dup.update({ status: "like" });
          }
          await like.update({ status: "unlike" });
        }
      } else {
        // 升级：补 userId + nickname，清空其他维度字段
        await like.update({
          userId: user.id,
          name: user.nickname,
          visitorId: null,
          email: null,
          ip: null,
        });
      }
    }
  }

  // 2) email 维度 → userId（评论过的游客登录）
  const emailLikes = await Like.findAll({
    where: { email: user.email, userId: null },
  });
  for (const like of emailLikes) {
    const dup = await Like.findOne({ where: { postId: like.postId, userId: user.id } });
    if (dup) {
      if (like.status === "like") {
        if (dup.status === "unlike") {
          await dup.update({ status: "like" });
        }
        await like.update({ status: "unlike" });
      }
    } else {
      await like.update({
        userId: user.id,
        name: user.nickname,
        email: null,
        ip: null,
        visitorId: null,
      });
    }
  }

  // 3) IP 维度 → userId（纯匿名游客登录）
  if (ip) {
    const ipLikes = await Like.findAll({
      where: { ip, email: null, visitorId: null, userId: null },
    });
    for (const like of ipLikes) {
      const dup = await Like.findOne({ where: { postId: like.postId, userId: user.id } });
      if (dup) {
        if (like.status === "like") {
          if (dup.status === "unlike") {
            await dup.update({ status: "like" });
          }
          await like.update({ status: "unlike" });
        }
      } else {
        await like.update({
          userId: user.id,
          name: user.nickname,
          email: null,
          ip: null,
          visitorId: null,
        });
      }
    }
  }
}

function publicUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    nickname: user.nickname,
    avatar: user.avatar,
    cover: user.cover,
    bio: user.bio,
    website: user.website,
    role: user.role,
  };
}

// POST /api/auth/register
router.post(
  "/register",
  [
    body("email").isEmail().normalizeEmail(),
    body("password").isLength({ min: 6 }),
    body("nickname").trim().isLength({ min: 1, max: 100 }),
    body("username")
      .optional()
      .trim()
      .isLength({ min: 3, max: 50 })
      .matches(/^[a-zA-Z0-9_]+$/),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { email, password, nickname, username, avatar, cover, bio } = req.body;

    const existing = await User.findOne({
      where: {
        [Op.or]: [{ email }, ...(username ? [{ username }] : [])],
      },
    });
    if (existing) {
      res.status(409).json({ message: "邮箱或用户名已被注册" });
      return;
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({
      email,
      username: username || "",
      password: hashed,
      nickname,
      avatar: avatar || "",
      cover: cover || "",
      bio: bio || "",
      role: "visitor",
    });

    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    res.status(201).json({ token, user: publicUser(user) });
  }
);

// POST /api/auth/login — 支持用户名或邮箱登录
router.post(
  "/login",
  [body("account").trim().isLength({ min: 1 }), body("password").exists()],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { account, password } = req.body;
    // account 可能是邮箱，也可能是用户名
    const isEmail = account.includes("@");
    const where = isEmail ? { email: account } : { username: account };
    const user = await User.findOne({ where });
    if (!user) {
      res.status(401).json({ message: "用户名或密码错误" });
      return;
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      res.status(401).json({ message: "用户名或密码错误" });
      return;
    }

    // 登录成功后：把该用户旧的 visitorId/email/IP 维度点赞迁移到 userId 维度
    // 这样 meLiked 仅按 userId 查询即可，实现跨设备一致
    try {
      const ip = getClientIp(req);
      const visitorId = req.visitorId;
      await migrateLikesToUserId(user, ip, visitorId);
    } catch (e) {
      // 迁移失败不影响登录
      console.error("migrateLikesToUserId error:", e);
    }

    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    res.json({ token, user: publicUser(user) });
  }
);

export default router;
