import { Router, Request, Response } from "express";
import { body, param, validationResult } from "express-validator";
import { Op } from "sequelize";
import { Post, Comment, Like, User } from "../models";
import { authenticate, authenticateOptional, AuthRequest, requireAdmin } from "../middleware/auth";
import { getClientIp } from "../utils/ip";
import { buildIdentity } from "./posts";
import { triggerRevalidate } from "../utils/revalidate";
import { generateShortId } from "../utils/short-id";

const router = Router();

// 广告位 formatAd：加 meLiked 参数（修复 bug #5）
// likes 列表过滤 status='like'（WP Ulike 软删：unlike 不显示）
function formatAd(post: any, meLiked = false) {
  let linkCard = post.linkCard;
  if (typeof linkCard === "string") {
    try { linkCard = JSON.parse(linkCard); } catch { linkCard = null; }
  }
  let images = post.images;
  if (typeof images === "string") {
    try { images = JSON.parse(images); } catch { images = []; }
  }
  return {
    id: post.id,
    content: post.content,
    images,
    linkCard: linkCard || null,
    isAd: true,
    adAvatar: post.adAvatar || "",
    adNickname: post.adNickname || "",
    likesDisabled: !!post.likesDisabled,
    commentsDisabled: !!post.commentsDisabled,
    createdAt: post.createdAt,
    author: post.author,
    comments: post.comments?.map((c: any) => ({
      id: c.id,
      author: c.authorName,
      email: c.email,
      website: c.website,
      replyTo: c.replyTo,
      replyToEmail: c.replyToEmail,
      replyToId: c.replyToId,
      content: c.content,
      createdAt: c.createdAt,
    })) || [],
    likes: post.likes?.filter((l: any) => l.status === "like")
      .map((l: any) => ({ name: l.name, email: l.email || l.user?.email || undefined })) || [],
    meLiked,
  };
}

const adIncludes: any[] = [
  { model: User, as: "author", attributes: ["id", "email", "username", "nickname", "avatar", "cover", "bio"] },
  { model: Comment, as: "comments", separate: true, order: [["createdAt", "ASC"]] },
  { model: Like, as: "likes", include: [{ model: User, as: "user", attributes: ["email"], required: false }] },
];

// GET /api/ads - 公开：获取广告列表（按创建时间倒序）
// 加 meLiked 预查询（修复 bug #5：广告位无 meLiked）
router.get("/", authenticateOptional, async (req: AuthRequest, res: Response) => {
  const ads = await Post.findAll({
    where: { isAd: true },
    include: adIncludes,
    order: [["createdAt", "DESC"]],
  });

  // 预查询当前访客在所有广告上的点赞状态（一次性 IN 查询）
  const ip = getClientIp(req);
  const userId = req.user?.id;
  const visitorId = req.visitorId;
  const emailParam = (req.query.email as string) || req.user?.email || "";
  const normalizedEmail = emailParam ? String(emailParam).trim().toLowerCase() : "";
  const identity = buildIdentity(userId, visitorId, normalizedEmail, ip);
  let likedAdIds = new Set<string>();
  if (identity && ads.length > 0) {
    const adIds = ads.map((a: any) => a.id);
    const myLikes = await Like.findAll({
      attributes: ["postId"],
      where: {
        postId: { [Op.in]: adIds },
        status: "like",
        ...identity,
      },
      group: ["postId"],
    });
    likedAdIds = new Set(myLikes.map((l: any) => l.postId));
  }

  res.json({ data: ads.map((a: any) => formatAd(a, likedAdIds.has(a.id))) });
});

// POST /api/ads - 管理员：创建广告
router.post(
  "/",
  authenticate,
  requireAdmin,
  [
    body("adAvatar").trim().isLength({ min: 1, max: 512 }),
    body("adNickname").trim().isLength({ min: 1, max: 100 }),
    body("content").optional().trim(),
    body("images").optional().isArray(),
    body("linkCard").optional().isObject(),
  ],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { adAvatar, adNickname, content = "", images = [], linkCard = null } = req.body;
    let post: Post | null = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        post = await Post.create({
          userId: req.user!.id,
          shortId: generateShortId(),
          content,
          images,
          location: null,
          music: null,
          linkCard,
          video: null,
          pinned: false,
          isAd: true,
          adAvatar,
          adNickname,
          likesDisabled: false,
          commentsDisabled: false,
        });
        break;
      } catch (err: any) {
        if (err.name === "SequelizeUniqueConstraintError" && attempt < 4) continue;
        throw err;
      }
    }

    const full = await Post.findByPk(post!.id, { include: adIncludes });
    triggerRevalidate();
    res.status(201).json(formatAd(full));
  }
);

// PUT /api/ads/:id - 管理员：更新广告
router.put(
  "/:id",
  authenticate,
  requireAdmin,
  [
    param("id").isUUID(),
    body("adAvatar").optional({ nullable: true }).trim().isLength({ max: 512 }),
    body("adNickname").optional({ nullable: true }).trim().isLength({ max: 100 }),
    body("content").optional({ nullable: true }).trim(),
    body("images").optional({ nullable: true }).isArray(),
    body("linkCard").optional({ nullable: true }).isObject(),
    body("likesDisabled").optional({ nullable: true }).isBoolean(),
    body("commentsDisabled").optional({ nullable: true }).isBoolean(),
  ],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const post = await Post.findByPk(req.params.id as string);
    if (!post || !post.isAd) {
      res.status(404).json({ message: "广告不存在" });
      return;
    }

    await post.update({
      adAvatar: req.body.adAvatar !== undefined ? req.body.adAvatar : post.adAvatar,
      adNickname: req.body.adNickname !== undefined ? req.body.adNickname : post.adNickname,
      content: req.body.content ?? post.content,
      images: req.body.images ?? post.images,
      linkCard: req.body.linkCard !== undefined ? req.body.linkCard : post.linkCard,
      likesDisabled: req.body.likesDisabled !== undefined ? req.body.likesDisabled : post.likesDisabled,
      commentsDisabled: req.body.commentsDisabled !== undefined ? req.body.commentsDisabled : post.commentsDisabled,
    });

    triggerRevalidate();
    res.json(formatAd(post));
  }
);

// DELETE /api/ads/:id - 管理员：删除广告
router.delete(
  "/:id",
  authenticate,
  requireAdmin,
  param("id").isUUID(),
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const post = await Post.findByPk(req.params.id as string);
    if (!post || !post.isAd) {
      res.status(404).json({ message: "广告不存在" });
      return;
    }

    await post.destroy();
    triggerRevalidate();
    res.status(204).send();
  }
);

// POST /api/ads/:id/convert-to-post — 管理员：将广告转回普通动态
router.post(
  "/:id/convert-to-post",
  authenticate,
  requireAdmin,
  param("id").isUUID(),
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const post = await Post.findByPk(req.params.id as string);
    if (!post || !post.isAd) {
      res.status(404).json({ message: "广告不存在" });
      return;
    }

    await post.update({
      isAd: false,
      adAvatar: "",
      adNickname: "",
    });

    triggerRevalidate();
    res.json({ id: post.id, isAd: false });
  }
);

export default router;
