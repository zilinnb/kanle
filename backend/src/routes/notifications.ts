import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { Post, Comment, Like, User } from "../models";

const router = Router();

interface NotificationItem {
  id: string;
  type: "like" | "comment" | "reply";
  actor: string;
  actorEmail: string;
  content: string;
  postPreview: string;
  postType: "music" | "image" | "link" | "text" | "video";
  postImage: string;
  postId: string;
  /** 动态短 ID，用于前端构造 /post/{shortId} URL */
  shortId?: string;
  /** 文章类型通知：true=跳转 /articles/{postId}，false=跳转 /moments/{shortId} */
  isArticle?: boolean;
  /** 评论/回复类型通知携带的目标评论 ID，用于前端跳转到详情页定位评论锚点；like 类型留空 */
  commentId?: string;
  replyTo?: string | null;
  createdAt: string;
  isLive?: boolean;
}

function preview(text: string) {
  const t = (text || "").replace(/\s+/g, " ").trim();
  return t.length > 30 ? t.slice(0, 30) + "…" : t;
}

/** 从 post 提取预览类型和缩略图 */
function getPostThumb(post: any, defaultCover = ""): { type: "music" | "image" | "link" | "text" | "video"; image: string; isLive: boolean } {
  // 文章类型：优先使用文章封面，无封面时用博主背景图作为默认封面
  if (post.type === "article") {
    const cover = post.cover || defaultCover || "";
    return { type: "image", image: cover, isLive: false };
  }
  if (post.music) {
    const cover = (post.music as any)?.cover || (post.music as any)?.artwork || "";
    return { type: "music", image: cover, isLive: false };
  }
  if (post.video) {
    const cover = (post.video as any)?.cover || "";
    return { type: "video", image: cover, isLive: false };
  }
  if (post.images && Array.isArray(post.images) && post.images.length > 0) {
    const first = post.images[0];
    // 兼容字符串 URL 和 {src, video} 对象两种格式
    const isObj = typeof first === "object" && first !== null;
    const src = isObj ? (first.src || "") : String(first);
    const video = isObj ? (first.video || "") : "";
    return { type: "image", image: src, isLive: !!video };
  }
  if (post.linkCard) {
    const img = (post.linkCard as any)?.image || "";
    if (img) return { type: "link", image: img, isLive: false };
  }
  return { type: "text", image: "", isLive: false };
}

function normalizeEmail(email?: string) {
  return (email || "").trim().toLowerCase();
}

/**
 * GET /api/notifications
 *
 * 支持两种身份：
 * 1. 博主：Header Authorization Bearer token → 返回自己所有动态的赞/评论/回复
 * 2. 访客：Query ?email=xxx → 返回回复给该邮箱的评论通知
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || "1")) || 1);
    const limit = Math.max(1, Math.min(50, parseInt(String(req.query.limit || "10")) || 10));
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

    if (token) {
      const secret = process.env.JWT_SECRET || "kanle-secret";
      const decoded = jwt.verify(token, secret) as { id: string };
      const adminId = decoded.id;
      const adminUser = await User.findByPk(adminId, { attributes: ["nickname", "cover"] });
      const adminNickname = adminUser?.nickname || "";
      const adminCover = adminUser?.cover || "";

      const posts = await Post.findAll({
        where: { userId: adminId },
        attributes: ["id", "shortId", "type", "content", "images", "music", "linkCard", "video", "cover", "createdAt"],
        order: [["createdAt", "DESC"]],
      });

      if (posts.length === 0) {
        res.json({ data: [], pagination: { page, limit, total: 0, hasMore: false } });
        return;
      }

      const postMap = new Map(posts.map((p) => [p.id, p]));
      const postIds = posts.map((p) => p.id);

      const [likes, comments] = await Promise.all([
        Like.findAll({
          where: { postId: postIds },
          order: [["createdAt", "DESC"]],
          limit: 200,
        }),
        Comment.findAll({
          where: { postId: postIds },
          order: [["createdAt", "DESC"]],
          limit: 200,
        }),
      ]);

      // 对于 email 为空的旧点赞数据，通过 name 关联 Comment 表 best-effort 查找 email
      const likesNeedingEmail = likes.filter((l) => !l.email && l.name);
      const likeNames = [...new Set(likesNeedingEmail.map((l) => l.name))];
      const nameToEmail = new Map<string, string>();
      if (likeNames.length > 0) {
        const commentsForEmail = await Comment.findAll({
          where: { authorName: likeNames },
          attributes: ["authorName", "email"],
          order: [["createdAt", "DESC"]],
        });
        for (const c of commentsForEmail) {
          if (c.email && !nameToEmail.has(c.authorName)) {
            nameToEmail.set(c.authorName, c.email);
          }
        }
      }

      const items: NotificationItem[] = [];

      for (const like of likes) {
        if (like.name === adminNickname) continue;
        const post = postMap.get(like.postId);
        if (!post) continue;
        const thumb = getPostThumb(post, adminCover);
        items.push({
          id: `like-${like.id}`,
          type: "like",
          actor: like.name || "访客",
          actorEmail: like.email || nameToEmail.get(like.name) || "",
          content: "",
          postPreview: preview(post.content || "（图片动态）"),
          postType: thumb.type,
          postImage: thumb.image,
          isLive: thumb.isLive,
          postId: post.id,
          shortId: post.shortId,
          isArticle: post.type === "article",
          createdAt: (like.createdAt as Date).toISOString(),
        });
      }

      for (const c of comments) {
        if (c.authorName === adminNickname) continue;
        const post = postMap.get(c.postId);
        if (!post) continue;
        const isReply = !!c.replyTo;
        const thumb = getPostThumb(post, adminCover);
        items.push({
          id: `comment-${c.id}`,
          type: isReply ? "reply" : "comment",
          actor: c.authorName || "访客",
          actorEmail: c.email || "",
          content: c.content || "",
          postPreview: preview(post.content || "（图片动态）"),
          postType: thumb.type,
          postImage: thumb.image,
          isLive: thumb.isLive,
          postId: post.id,
          shortId: post.shortId,
          isArticle: post.type === "article",
          commentId: c.id,
          replyTo: c.replyTo || null,
          createdAt: (c.createdAt as Date).toISOString(),
        });
      }

      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const total = items.length;
      const start = (page - 1) * limit;
      const end = start + limit;
      res.json({ data: items.slice(start, end), pagination: { page, limit, total, hasMore: end < total } });
      return;
    }

    // 访客分支：只返回回复给该邮箱的评论
    const email = normalizeEmail(req.query.email as string);
    if (!email) {
      res.status(401).json({ message: "缺少认证信息或邮箱参数" });
      return;
    }

    const comments = await Comment.findAll({
      where: { replyToEmail: email },
      order: [["createdAt", "DESC"]],
      limit: 200,
      include: [{ model: Post, as: "post", attributes: ["id", "shortId", "type", "content", "images", "music", "linkCard", "video", "cover"] }],
    });

    // 查询博主 cover 作为文章默认封面
    const adminUser = await User.findOne({ where: { role: "admin" }, attributes: ["cover"] });
    const adminCover = adminUser?.cover || "";

    const items: NotificationItem[] = comments
      .filter((c) => normalizeEmail(c.email) !== email)
      .map((c) => {
        const postData = (c as any).post;
        const thumb = getPostThumb(postData, adminCover);
        return {
          id: `reply-${c.id}`,
          type: "reply",
          actor: c.authorName || "访客",
          actorEmail: c.email || "",
          content: c.content || "",
          postPreview: preview(postData?.content || "（图片动态）"),
          postType: thumb.type,
          postImage: thumb.image,
          isLive: thumb.isLive,
          postId: c.postId,
          shortId: postData?.shortId,
          isArticle: postData?.type === "article",
          commentId: c.id,
          replyTo: c.replyTo || null,
          createdAt: (c.createdAt as Date).toISOString(),
        };
      });

    const vTotal = items.length;
    const vStart = (page - 1) * limit;
    const vEnd = vStart + limit;
    res.json({ data: items.slice(vStart, vEnd), pagination: { page, limit, total: vTotal, hasMore: vEnd < vTotal } });
  } catch (err) {
    console.error("[notifications] error:", err);
    res.status(500).json({ message: "获取通知失败" });
  }
});

export default router;
