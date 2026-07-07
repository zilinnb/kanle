import { Router, Request, Response } from "express";
import { body, param, validationResult } from "express-validator";
import { Op, fn, col } from "sequelize";
import { Post, Comment, Like, CommentLike, User } from "../models";
import { authenticate, authenticateOptional, AuthRequest, requireAdmin } from "../middleware/auth";
import { getClientIp } from "../utils/ip";
import { getRegionByIp } from "../utils/region";
import { generateShortId } from "../utils/short-id";
import { triggerRevalidate } from "../utils/revalidate";
import { checkCommentRate, recordCommentSuccess, resetViolations } from "../middleware/rateLimit";
import { blacklistService } from "../services/blacklist-service";
import { sendCommentNotification } from "../services/email-service";
import { parseVideoFromUrl, ParseError } from "./video-parse";

const router = Router();

/** 自动临时封禁时长：1 小时 */
const AUTO_BAN_DURATION = 60 * 60 * 1000;

/**
 * 生成文章摘要：
 * - excerpt 非空且不等于标题时直接用
 * - 否则从 content 提取纯文本前 100 字符
 */
function getExcerpt(post: any): string {
  const title = (post.title || "").trim();
  const excerpt = (post.excerpt || "").trim();
  if (excerpt && excerpt !== title) return excerpt;
  const content = post.content || "";
  const text = content
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.slice(0, 100);
}

/**
 * WP Ulike 风格的访客身份识别：
 * 按优先级取第一个非空字段作为该用户的唯一标识：
 *   userId (已登录博主) > visitorId (cookie 游客) > email (评论过的游客) > ip (兜底)
 *
 * 互斥取一而非 OR 多重匹配——确保 meLiked 和 toggle 用完全一致的单一条件，
 * 彻底修复"显示已赞但无法取消"的不一致 bug。
 *
 * 返回 null 表示无法识别身份（无任何标识）。返回的对象其他维度字段置 null，
 * 与 Like 表的 4 个互斥 UNIQUE 索引 where 条件对齐。
 */
export function buildIdentity(
  userId?: string,
  visitorId?: string,
  email?: string,
  ip?: string
): { userId: string | null; visitorId: string | null; email: string | null; ip: string | null } | null {
  if (userId) return { userId, visitorId: null, email: null, ip: null };
  if (visitorId) return { visitorId, email: null, ip: null, userId: null };
  if (email) return { email, ip: null, visitorId: null, userId: null };
  if (ip) return { ip, visitorId: null, email: null, userId: null };
  return null;
}

/**
 * 线程化排序评论：顶级评论按 (点赞多 → 时间早) 排序，回复按时间正序紧跟其父评论。
 * 匹配父评论用 author + email 双键，避免同名歧义。孤儿回复（父评论不在列表中）排末尾。
 */
function sortCommentsThreaded<T extends { replyTo?: string | null; replyToEmail?: string | null; author: string; email?: string | null; likeCount: number; createdAt: string }>(comments: T[]): T[] {
  const topLevel = comments.filter((c) => !c.replyTo);
  const replies = comments.filter((c) => c.replyTo);

  // 顶级评论：点赞多优先，同级时间早优先
  topLevel.sort((a, b) => {
    if (b.likeCount !== a.likeCount) return b.likeCount - a.likeCount;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  // 按父评论分组（author + email 双键）
  const repliesByParent = new Map<string, T[]>();
  for (const r of replies) {
    const key = `${r.replyTo}|${r.replyToEmail || ""}`;
    if (!repliesByParent.has(key)) repliesByParent.set(key, []);
    repliesByParent.get(key)!.push(r);
  }
  // 每组回复按时间正序（对话顺序）
  for (const group of repliesByParent.values()) {
    group.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  // 交织：父评论后紧跟其回复
  const result: T[] = [];
  for (const tc of topLevel) {
    result.push(tc);
    const key = `${tc.author}|${tc.email || ""}`;
    const tcReplies = repliesByParent.get(key);
    if (tcReplies) {
      result.push(...tcReplies);
      repliesByParent.delete(key);
    }
  }
  // 孤儿回复（父评论不在列表中）排末尾
  for (const group of repliesByParent.values()) {
    result.push(...group);
  }
  return result;
}

function formatPost(
  post: any,
  meLiked = false,
  commentLikesMap?: Map<string, { likeCount: number; meLiked: boolean }>,
  meCommented = false,
  isAuthor = false
) {
  // 如果音乐有 neteaseId，用代理 URL（实时获取有效 URL，避免过期 403）
  let music = post.music || null;
  if (music && music.source === "netease" && music.neteaseId) {
    music = { ...music, url: `/api/music/stream?id=${music.neteaseId}` };
  } else if (music && music.source === "musicfree" && music.platform && music.musicId) {
    // MusicFree 音源（酷狗/QQ/酷我/咪咕等）：重写为流代理 URL，每次播放实时获取有效地址
    // 解决 CDN URL 过期问题：插件返回的直链有时效性，存储的 URL 过期后无法播放
    // 把 extra 字段展开成顶级 query 参数（值转字符串），避免 JSON 数字类型导致插件返回试听片段
    const params = new URLSearchParams({
      platform: music.platform,
      id: String(music.musicId),
    });
    if (music.extra) {
      const extraObj: Record<string, any> =
        typeof music.extra === "string" ? (() => { try { return JSON.parse(music.extra); } catch { return {}; } })() : music.extra;
      for (const [k, v] of Object.entries(extraObj)) {
        if (v != null && v !== "") params.set(k, String(v));
      }
    }
    music = { ...music, url: `/api/music/stream?${params.toString()}` };
  }
  let linkCard = post.linkCard;
  if (typeof linkCard === "string") {
    try { linkCard = JSON.parse(linkCard); } catch { linkCard = null; }
  }
  let video = post.video;
  if (typeof video === "string") {
    try { video = JSON.parse(video); } catch { video = null; }
  }
  // 服务端标记作者评论：用 email 比对，前端只读 isAuthor 布尔值
  const authorEmail = post.author?.email ? String(post.author.email).toLowerCase() : "";
  return {
      id: post.id,
      shortId: post.shortId,
      type: post.type || "moment",
      title: post.title || "",
      excerpt: getExcerpt(post),
      cover: post.cover || "",
      category: post.category || "",
      content: post.content,
      images: post.images,
      location: post.location || "",
      music,
      linkCard: linkCard || null,
      video: video || null,
      pinned: post.pinned || false,
      isAd: post.isAd || false,
      adAvatar: post.adAvatar || "",
      adNickname: post.adNickname || "",
      likesDisabled: post.likesDisabled || false,
      commentsDisabled: post.commentsDisabled || false,
      createdAt: post.createdAt,
      region: post.region || "",
      articleType: post.articleType || "original",
      viewCount: post.viewCount || 0,
      status: post.status || "published",
      author: post.author,
      comments: sortCommentsThreaded((post.comments || []).map((c: any) => {
        const likeData = commentLikesMap?.get(c.id);
        const isAuthor = !!(authorEmail && c.email && String(c.email).toLowerCase() === authorEmail);
        return {
          id: c.id,
          author: c.authorName,
          email: c.email,
          website: c.website,
          replyTo: c.replyTo,
          replyToEmail: c.replyToEmail,
          content: c.content,
          createdAt: c.createdAt,
          likeCount: likeData?.likeCount ?? 0,
          meLiked: likeData?.meLiked ?? false,
          isAuthor,
          region: c.region || "",
        };
      })),
      likes: post.likes?.filter((l: any) => l.status === "like")
        .map((l: any) => ({ name: l.name, email: l.email || l.user?.email || undefined })) || [],
      meLiked,
      meCommented,
      isAuthor,
    };
}

// GET /api/posts - list posts with pagination（排除广告，广告由 /api/ads 单独提供）
// 支持 ?type=article/moment 过滤，?category=xxx 分类过滤
router.get("/", authenticateOptional, async (req: AuthRequest, res: Response) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
  const offset = (page - 1) * limit;

  const where: any = { isAd: false, status: "published" };
  const typeParam = req.query.type as string;
  if (typeParam === "article" || typeParam === "moment") {
    where.type = typeParam;
  }
  const categoryParam = req.query.category as string;
  if (categoryParam) {
    where.category = categoryParam;
  }

  const { count, rows: posts } = await Post.findAndCountAll({
    distinct: true,
    where,
    include: [
      { model: User, as: "author", attributes: ["id", "email", "username", "nickname", "avatar", "cover", "bio"] },
      { model: Comment, as: "comments" },
      { model: Like, as: "likes", include: [{ model: User, as: "user", attributes: ["email"], required: false }] },
    ],
    order: [["pinned", "DESC"], ["createdAt", "DESC"]],
    limit,
    offset,
  });

  // 预查询当前访客在本页所有帖子上的点赞状态（一次性 IN 查询）
  // WP Ulike：只查 status='like' 的记录（unlike 是软删，不算已点赞）
  const ip = getClientIp(req);
  const userId = req.user?.id;
  const visitorId = req.visitorId;
  const emailParam = (req.query.email as string) || req.user?.email || "";
  const normalizedEmail = emailParam ? String(emailParam).trim().toLowerCase() : "";
  const identity = buildIdentity(userId, visitorId, normalizedEmail, ip);
  let likedPostIds = new Set<string>();
  if (identity && posts.length > 0) {
    const postIds = posts.map((p: any) => p.id);
    const myLikes = await Like.findAll({
      attributes: ["postId"],
      where: {
        postId: { [Op.in]: postIds },
        status: "like",
        ...identity,
      },
      group: ["postId"],
    });
    likedPostIds = new Set(myLikes.map((l: any) => l.postId));
  }

  // 全局批查询本页所有评论的点赞计数 + 当前访客点赞状态（2 次查询，避免 N+1）
  const allCommentIds = posts.flatMap((p: any) => (p.comments || []).map((c: any) => c.id));
  const commentLikesMap = new Map<string, { likeCount: number; meLiked: boolean }>();
  if (allCommentIds.length > 0) {
    // 查询 1：每条评论的点赞计数
    const likeCounts = await CommentLike.findAll({
      attributes: ["commentId", [fn("COUNT", col("id")), "likeCount"]],
      where: { commentId: { [Op.in]: allCommentIds }, status: "like" },
      group: ["commentId"],
      raw: true,
    }) as any[];
    for (const row of likeCounts) {
      commentLikesMap.set(row.commentId, { likeCount: Number(row.likeCount), meLiked: false });
    }
    // 查询 2：当前访客的点赞状态（identity 维度互斥）
    if (identity) {
      const myCommentLikes = await CommentLike.findAll({
        attributes: ["commentId"],
        where: { commentId: { [Op.in]: allCommentIds }, status: "like", ...identity },
        raw: true,
      }) as any[];
      for (const row of myCommentLikes) {
        const existing = commentLikesMap.get(row.commentId);
        if (existing) existing.meLiked = true;
        else commentLikesMap.set(row.commentId, { likeCount: 0, meLiked: true });
      }
    }
    // 补全无点赞记录的评论
    for (const id of allCommentIds) {
      if (!commentLikesMap.has(id)) commentLikesMap.set(id, { likeCount: 0, meLiked: false });
    }
  }

  res.json({
    data: posts.map((p: any) => formatPost(p, likedPostIds.has(p.id), commentLikesMap)),
    pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit), hasMore: page * limit < count },
  });
});

// GET /api/posts/:id — 支持 UUID 和 shortId 两种格式
router.get("/:id", authenticateOptional, async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

  const where = isUuid ? { id } : { shortId: id };
  const post = await Post.findOne({
    where,
    include: [
      { model: User, as: "author", attributes: ["id", "email", "username", "nickname", "avatar", "cover", "bio"] },
      { model: Comment, as: "comments" },
      { model: Like, as: "likes", include: [{ model: User, as: "user", attributes: ["email"], required: false }] },
    ],
  });

  if (!post) {
    res.status(404).json({ message: "动态不存在" });
    return;
  }

  // ?view=1 时原子递增阅读量（SSR 不带此参数，仅客户端 fetch 带）
  if (req.query.view === "1") {
    await Post.increment("viewCount", { where: { id: post.id } });
    // Sequelize increment() 不更新内存中的实例，手动同步
    const current = (post.getDataValue("viewCount") as number) || 0;
    post.setDataValue("viewCount", current + 1);
  }

  // 查询当前访客是否已点赞该帖子（WP Ulike：只算 status='like'）
  const ip = getClientIp(req);
  const userId = req.user?.id;
  const visitorId = req.visitorId;
  const emailParam = (req.query.email as string) || req.user?.email || "";
  const normalizedEmail = emailParam ? String(emailParam).trim().toLowerCase() : "";
  const identity = buildIdentity(userId, visitorId, normalizedEmail, ip);
  let meLiked = false;
  if (identity) {
    const existing = await Like.findOne({
      where: { postId: post.id, status: "like", ...identity },
    });
    meLiked = !!existing;
  }

  // 判断当前访客是否已评论（用于"评论可见"内容解锁）
  let meCommented = false;
  if (normalizedEmail) {
    const existing = await Comment.findOne({
      where: { postId: post.id, email: normalizedEmail },
    });
    meCommented = !!existing;
  }
  if (!meCommented && ip) {
    const existing = await Comment.findOne({
      where: { postId: post.id, ip },
    });
    meCommented = !!existing;
  }

  // 判断当前访客是否是文章作者（作者始终可见评论可见内容）
  const authorEmail = (post as any).author?.email
    ? String((post as any).author.email).trim().toLowerCase()
    : "";
  const isAuthor = !!(normalizedEmail && authorEmail && normalizedEmail === authorEmail);

  // 批量查询评论点赞计数 + 当前访客点赞状态（2 次查询，避免 N+1）
  const commentIds = ((post as any).comments || []).map((c: any) => c.id);
  const commentLikesMap = new Map<string, { likeCount: number; meLiked: boolean }>();
  if (commentIds.length > 0) {
    const likeCounts = await CommentLike.findAll({
      attributes: ["commentId", [fn("COUNT", col("id")), "likeCount"]],
      where: { commentId: { [Op.in]: commentIds }, status: "like" },
      group: ["commentId"],
      raw: true,
    }) as any[];
    for (const row of likeCounts) {
      commentLikesMap.set(row.commentId, { likeCount: Number(row.likeCount), meLiked: false });
    }
    if (identity) {
      const myCommentLikes = await CommentLike.findAll({
        attributes: ["commentId"],
        where: { commentId: { [Op.in]: commentIds }, status: "like", ...identity },
        raw: true,
      }) as any[];
      for (const row of myCommentLikes) {
        const existing = commentLikesMap.get(row.commentId);
        if (existing) existing.meLiked = true;
        else commentLikesMap.set(row.commentId, { likeCount: 0, meLiked: true });
      }
    }
    for (const id of commentIds) {
      if (!commentLikesMap.has(id)) commentLikesMap.set(id, { likeCount: 0, meLiked: false });
    }
  }

  res.json(formatPost(post, meLiked, commentLikesMap, meCommented, isAuthor));
});

// POST /api/posts - create post (admin only)
router.post(
  "/",
  authenticate,
  requireAdmin,
  [
    body("type").optional().isIn(["moment", "article"]),
    body("title").optional().trim().isLength({ max: 200 }),
    body("excerpt").optional().trim().isLength({ max: 500 }),
    body("cover").optional().trim().isLength({ max: 512 }),
    body("category").optional().trim().isLength({ max: 50 }),
    body("articleType").optional().isIn(["original", "repost", "ai"]),
    body("content").optional().trim(),
    body("images").optional().isArray(),
    body("location").optional().trim().isLength({ max: 255 }),
    body("region").optional().trim().isLength({ max: 100 }),
    body("music").optional().isObject(),
    body("linkCard").optional({ nullable: true }).isObject(),
    body("video").optional({ nullable: true }).isObject(),
    body("isAd").optional().isBoolean(),
    body("likesDisabled").optional().isBoolean(),
    body("commentsDisabled").optional().isBoolean(),
    body("pinned").optional().isBoolean(),
    body("status").optional().isIn(["published", "draft"]),
  ],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const {
      type = "moment",
      title = "",
      excerpt = "",
      cover = "",
      category = "",
      articleType = "original",
      content = "",
      images = [],
      location = "",
      region: bodyRegion = "",
      music = null,
      linkCard = null,
      video = null,
      isAd = false,
      likesDisabled = false,
      commentsDisabled = false,
      pinned = false,
      status = "published",
    } = req.body;

    // 广告不允许置顶，强制清零防止前端绕过
    const finalPinned = isAd ? false : pinned;

    const ip = getClientIp(req);
    const ipRegion = await getRegionByIp(ip);
    const region = bodyRegion || ipRegion;

    let post: Post | null = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        post = await Post.create({
          userId: req.user!.id,
          shortId: generateShortId(),
          type,
          title,
          excerpt,
          cover,
          category,
          articleType,
          content,
          images,
          location,
          music,
          linkCard,
          video,
          isAd,
          likesDisabled,
          commentsDisabled,
          pinned: finalPinned,
          status,
          ip,
          region,
        });
        break;
      } catch (err: any) {
        if (err.name === "SequelizeUniqueConstraintError" && attempt < 4) continue;
        throw err;
      }
    }

    const full = await Post.findByPk(post!.id, {
      include: [
        { model: User, as: "author", attributes: ["id", "email", "username", "nickname", "avatar", "cover", "bio"] },
        { model: Comment, as: "comments" },
        { model: Like, as: "likes", include: [{ model: User, as: "user", attributes: ["email"], required: false }] },
      ],
    });

    // 触发首页 ISR 重生成，确保刷新页面立即可见最新动态
    triggerRevalidate();

    res.status(201).json(formatPost(full));
  }
);

// PUT /api/posts/:id - update post (admin only)
router.put(
  "/:id",
  authenticate,
  requireAdmin,
  [
    param("id").isUUID(),
    body("type").optional().isIn(["moment", "article"]),
    body("title").optional({ nullable: true }).trim().isLength({ max: 200 }),
    body("excerpt").optional({ nullable: true }).trim().isLength({ max: 500 }),
    body("cover").optional({ nullable: true }).trim().isLength({ max: 512 }),
    body("category").optional({ nullable: true }).trim().isLength({ max: 50 }),
    body("articleType").optional().isIn(["original", "repost", "ai"]),
    body("content").optional().trim(),
    body("images").optional().isArray(),
    body("location").optional().trim().isLength({ max: 255 }),
    body("region").optional({ nullable: true }).trim().isLength({ max: 100 }),
    body("music").optional({ nullable: true }).isObject(),
    body("linkCard").optional({ nullable: true }).isObject(),
    body("video").optional({ nullable: true }).isObject(),
    body("isAd").optional().isBoolean(),
    body("likesDisabled").optional().isBoolean(),
    body("commentsDisabled").optional().isBoolean(),
    body("pinned").optional().isBoolean(),
    body("status").optional().isIn(["published", "draft"]),
  ],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const post = await Post.findByPk(req.params.id as string);
    if (!post) {
      res.status(404).json({ message: "动态不存在" });
      return;
    }

    // 广告不允许置顶：即使传入 pinned=true 也强制为 false
    const incomingPinned = req.body.pinned;
    const finalPinned =
      incomingPinned !== undefined
        ? (post.isAd ? false : incomingPinned)
        : post.pinned;

    await post.update({
      type: req.body.type !== undefined ? req.body.type : post.type,
      title: req.body.title !== undefined ? req.body.title : post.title,
      excerpt: req.body.excerpt !== undefined ? req.body.excerpt : post.excerpt,
      cover: req.body.cover !== undefined ? req.body.cover : post.cover,
      category: req.body.category !== undefined ? req.body.category : post.category,
      articleType: req.body.articleType !== undefined ? req.body.articleType : post.articleType,
      content: req.body.content !== undefined ? req.body.content : post.content,
      images: req.body.images !== undefined ? req.body.images : post.images,
      location: req.body.location !== undefined ? req.body.location : post.location,
      region: req.body.region !== undefined ? req.body.region : post.region,
      music: req.body.music !== undefined ? req.body.music : post.music,
      linkCard: req.body.linkCard !== undefined ? req.body.linkCard : post.linkCard,
      video: req.body.video !== undefined ? req.body.video : post.video,
      isAd: req.body.isAd !== undefined ? req.body.isAd : post.isAd,
      likesDisabled: req.body.likesDisabled !== undefined ? req.body.likesDisabled : post.likesDisabled,
      commentsDisabled: req.body.commentsDisabled !== undefined ? req.body.commentsDisabled : post.commentsDisabled,
      pinned: finalPinned,
      status: req.body.status !== undefined ? req.body.status : post.status,
    });

    // 触发首页 ISR 重生成，确保刷新页面看到最新动态
    triggerRevalidate();

    res.json(formatPost(post));
  }
);

// DELETE /api/posts/:id - delete post (admin only)
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
    if (!post) {
      res.status(404).json({ message: "动态不存在" });
      return;
    }

    await post.destroy();
    // 触发首页 ISR 重生成，确保刷新页面看到最新动态
    triggerRevalidate();
    res.status(204).send();
  }
);

// PATCH /api/posts/:id/pin - 置顶/取消置顶（admin only）
router.patch(
  "/:id/pin",
  authenticate,
  requireAdmin,
  param("id").isUUID(),
  body("pinned").isBoolean(),
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const post = await Post.findByPk(req.params.id as string);
    if (!post) {
      res.status(404).json({ message: "动态不存在" });
      return;
    }

    if (post.isAd) {
      res.status(400).json({ message: "广告不支持置顶" });
      return;
    }

    post.pinned = req.body.pinned;
    await post.save();
    triggerRevalidate();
    res.json({ id: post.id, pinned: post.pinned });
  }
);

// POST /api/posts/:id/refresh-video - 重新解析视频 URL（公开端点）
// 播放解析视频时，存储的 URL 可能已过期，需要重新解析获取新鲜 URL。
// skipCache=1 时跳过内存缓存（播放失败自动重试时使用）。
router.post(
  "/:id/refresh-video",
  param("id").isUUID(),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    const post = await Post.findByPk(req.params.id as string);
    if (!post) {
      res.status(404).json({ message: "动态不存在" });
      return;
    }
    const video = post.video as any;
    if (!video || !video.sourceUrl) {
      res.status(400).json({ message: "该动态没有可解析的视频" });
      return;
    }
    try {
      const result = await parseVideoFromUrl(video.sourceUrl);
      // 更新 Post.video：保留 embedCode 等字段，覆盖解析结果
      const updatedVideo = { ...video, ...result };
      await post.update({ video: updatedVideo });
      triggerRevalidate();
      res.json(result);
    } catch (err: any) {
      if (err instanceof ParseError) {
        res.status(err.status).json({ message: err.message });
      } else {
        res.status(502).json({ message: "解析服务暂时不可用，请稍后重试" });
      }
    }
  }
);

// POST /api/posts/:id/comments
router.post(
  "/:id/comments",
  [
    param("id").isUUID(),
    body("content").trim().isLength({ min: 1 }),
    body("authorName").trim().isLength({ min: 1, max: 100 }),
    body("email").trim().isEmail().normalizeEmail(),
    body("website").optional().trim().isLength({ max: 255 }),
    body("replyTo").optional().trim(),
    body("replyToEmail").optional().trim().isEmail().normalizeEmail(),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const post = await Post.findByPk(req.params.id as string, {
      include: [{ model: User, as: "author", attributes: ["email"] }],
    });
    if (!post) {
      res.status(404).json({ message: "动态不存在" });
      return;
    }

    const ip = getClientIp(req);
    const email: string = req.body.email;
    const commentRegion = await getRegionByIp(ip);

    // 评论防刷总开关：关闭时跳过黑名单和限流检查，仅记录 IP
    const antiSpamEnabled = await blacklistService.isAntiSpamEnabled();
    if (antiSpamEnabled) {
      // 1. 黑名单检查（邮箱或 IP 任一命中即拒绝）
      const ban = await blacklistService.check(email, ip);
      if (ban.banned) {
        const until = ban.expiresAt
          ? new Date(ban.expiresAt).toLocaleString("zh-CN", { hour12: false })
          : "永久";
        res.status(403).json({
          message: `您已被限制评论（原因：${ban.reason || "违规操作"}，解除时间：${until}）。如有疑问请联系管理员。`,
          code: "BANNED",
        });
        return;
      }

      // 2. 限流检查：邮箱 10 秒内最多 2 条；IP 60 秒内最多 10 条
      const rate = checkCommentRate(email, ip);
      if (!rate.allowed) {
        // 自动临时封禁：违规累计达阈值则写入黑名单
        if (rate.banKey) {
          await blacklistService.add(
            rate.banKey.type,
            rate.banKey.value,
            "频繁刷评论自动封禁",
            AUTO_BAN_DURATION
          );
          resetViolations(rate.banKey.type, rate.banKey.value);
        }
        const msg =
          rate.reason === "RATE_LIMIT_EMAIL"
            ? `评论太快了，请等待 ${rate.retryAfter} 秒后再试`
            : `操作过于频繁，请稍后再试`;
        res.status(429).json({
          message: msg,
          code: rate.reason,
          retryAfter: rate.retryAfter,
        });
        return;
      }
    }

    const comment = await Comment.create({
      postId: post.id,
      authorName: req.body.authorName,
      email,
      website: req.body.website || null,
      replyTo: req.body.replyTo || null,
      replyToEmail: req.body.replyToEmail || null,
      content: req.body.content,
      ip,
      region: commentRegion,
    });

    // 评论成功后记录一次命中（用于后续限流计数），并重置该用户的违规计数
    if (antiSpamEnabled) recordCommentSuccess(email, ip);

    // 服务端标记作者评论（与 formatPost 逻辑一致）
    const authorEmail = (post as any).author?.email ? String((post as any).author.email).toLowerCase() : "";
    const isAuthor = !!(authorEmail && comment.email && String(comment.email).toLowerCase() === authorEmail);

    res.status(201).json({
      id: comment.id,
      author: comment.authorName,
      email: comment.email,
      website: comment.website,
      replyTo: comment.replyTo,
      replyToEmail: comment.replyToEmail,
      content: comment.content,
      createdAt: comment.createdAt,
      // 新评论默认无点赞，作者标记服务端计算
      likeCount: 0,
      meLiked: false,
      isAuthor,
      region: comment.region || "",
    });

    // 发送邮件通知（非关键路径，失败仅记日志，不阻塞响应）
    sendCommentNotification({
      actorNickname: comment.authorName,
      actorEmail: comment.email,
      content: comment.content,
      replyTo: comment.replyTo,
      replyToEmail: comment.replyToEmail,
      postContent: post.content || post.title || "",
      postId: post.id,
      commentId: comment.id,
    }).catch(() => {});
  }
);

// POST /api/posts/:id/comments/:commentId/likes
// 评论点赞 toggle — 复用 buildIdentity 与帖子点赞 toggle 逻辑：
//   - 验证 comment 属于 post（防越权）
//   - 维度互斥：userId > visitorId > email > ip（与帖子点赞完全一致）
//   - 软删翻转：已 like → unlike；已 unlike 或不存在 → like
//   - 只返回 { liked, likeCount }，不返回点赞名单（高频操作，简化响应）
//   - 不调用 triggerRevalidate（评论点赞频繁，避免 ISR 拖慢）
router.post(
  "/:id/comments/:commentId/likes",
  authenticateOptional,
  [param("id").isUUID(), param("commentId").isUUID()],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { name: bodyName, email } = req.body;
    if (!bodyName || typeof bodyName !== "string") {
      res.status(400).json({ message: "缺少 name 参数" });
      return;
    }

    // 验证 comment 属于 post（防越权）
    const comment = await Comment.findOne({
      where: { id: req.params.commentId, postId: req.params.id },
    });
    if (!comment) {
      res.status(404).json({ message: "评论不存在" });
      return;
    }

    const userId = req.user?.id;
    const visitorId = req.visitorId;
    const normalizedEmail = email ? String(email).trim().toLowerCase() : "";
    const ip = getClientIp(req);

    const identity = buildIdentity(userId, visitorId, normalizedEmail, ip);
    if (!identity) {
      res.status(400).json({ message: "无法识别访客身份（无 userId/visitorId/email/IP）" });
      return;
    }

    // 已登录博主：强制使用其 nickname 作为显示名
    let displayName = bodyName;
    if (userId) {
      const user = await User.findByPk(userId, { attributes: ["nickname"] });
      if (user?.nickname) displayName = user.nickname;
    }

    // WP Ulike 软删翻转
    const existing = await CommentLike.findOne({
      where: { commentId: comment.id, ...identity },
    });

    let liked: boolean;
    if (existing) {
      const newStatus = existing.status === "like" ? "unlike" : "like";
      await existing.update({ status: newStatus, name: displayName });
      liked = newStatus === "like";
    } else {
      await CommentLike.create({
        commentId: comment.id,
        name: displayName,
        email: identity.email,
        ip: identity.ip,
        visitorId: identity.visitorId,
        userId: identity.userId,
        status: "like",
      });
      liked = true;
    }

    // 返回当前评论的点赞计数（仅 status='like'）
    const likeCount = await CommentLike.count({
      where: { commentId: comment.id, status: "like" },
    });

    res.json({ liked, likeCount });
  }
);

// POST /api/posts/:id/likes
// WP Ulike 风格 toggle：找现有记录（含 status='unlike' 的，因为要翻转）
//   - 找到 → UPDATE status 翻转（like ↔ unlike）
//   - 未找到 → INSERT status='like'
//
// 维度优先级：userId (已登录博主) > visitorId (cookie 游客) > email (评论过的游客) > ip (兜底)
// 互斥取一而非 OR，确保 meLiked 和 toggle 用完全一致的单一条件，避免不一致 bug。
//
// 同时强制后端 likesDisabled 检查（修复 bug #1）：
//   - post.likesDisabled=true 时返回 403，前端 UI 应保持原状
//
// 已登录博主点赞时强制 name = user.nickname（修复 bug #6：登录用户点赞显示"访客"）
router.post(
  "/:id/likes",
  authenticateOptional,
  param("id").isUUID(),
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { name: bodyName, email } = req.body;
    if (!bodyName || typeof bodyName !== "string") {
      res.status(400).json({ message: "缺少 name 参数" });
      return;
    }

    const post = await Post.findByPk(req.params.id as string);
    if (!post) {
      res.status(404).json({ message: "动态不存在" });
      return;
    }

    // 后端强制 likesDisabled（修复 bug #1）
    if (post.likesDisabled) {
      res.status(403).json({ message: "该动态已关闭点赞", code: "LIKES_DISABLED" });
      return;
    }

    const userId = req.user?.id;
    const visitorId = req.visitorId;
    const normalizedEmail = email ? String(email).trim().toLowerCase() : "";
    const ip = getClientIp(req);

    // 构造互斥身份（与 meLiked 完全一致）
    const identity = buildIdentity(userId, visitorId, normalizedEmail, ip);
    if (!identity) {
      res.status(400).json({ message: "无法识别访客身份（无 userId/visitorId/email/IP）" });
      return;
    }

    // 已登录博主：强制使用其 nickname 作为显示名（修复 bug #6）
    let displayName = bodyName;
    if (userId) {
      const user = await User.findByPk(userId, { attributes: ["nickname"] });
      if (user?.nickname) displayName = user.nickname;
    }

    // 找现有记录（含 status='unlike' 的，因为要翻转）
    const existing = await Like.findOne({
      where: { postId: post.id, ...identity },
    });

    let liked: boolean;
    if (existing) {
      // WP Ulike 软删翻转
      const newStatus = existing.status === "like" ? "unlike" : "like";
      await existing.update({ status: newStatus, name: displayName });
      liked = newStatus === "like";
    } else {
      // 新建点赞记录：仅存当前维度的字段，其他设 NULL（与 4 个互斥 UNIQUE 索引对齐）
      await Like.create({
        postId: post.id,
        name: displayName,
        email: identity.email,
        ip: identity.ip,
        visitorId: identity.visitorId,
        userId: identity.userId,
        status: "like",
      });
      liked = true;
    }

    // 返回 likes 列表（仅 status='like'，前端无需手动维护）
    const likes = await Like.findAll({
      where: { postId: post.id, status: "like" },
      include: [{ model: User, as: "user", attributes: ["email"], required: false }],
      attributes: ["name", "email"],
      order: [["createdAt", "ASC"]],
    });

    res.json({ liked, likes: likes.map((l: any) => ({ name: l.name, email: l.email || (l as any).user?.email || undefined })) });

    // 触发首页 ISR 重生成，确保刷新页面立即看到最新点赞状态
    triggerRevalidate();
  }
);

// PUT /api/likes/update-name — 访客填写昵称后，更新其历史点赞的显示名
// WP Ulike 多维度升级（priority: visitorId > email > ip）：
//   1. 优先 visitorId（cookie 游客）→ email 升级：补 email + 改 name + 清 visitorId/ip
//   2. 其次 IP 维度 → email 升级：补 email + 改 name + 清 ip
//   3. 已有 email 维度的：直接改 name（跨设备同步）
//   4. 无 email：只更新对应维度的 name
// 冲突处理：同 post 已存在 email 维度点赞 → 把旧 visitorId/IP 维度记录软删为 unlike
router.put("/likes/update-name", async (req: AuthRequest, res: Response) => {
  const { email, newName } = req.body;
  if (!newName || typeof newName !== "string") {
    res.status(400).json({ message: "缺少 newName 参数" });
    return;
  }

  const normalizedEmail = email ? String(email).trim().toLowerCase() : "";
  const ip = getClientIp(req);
  const visitorId = req.visitorId;

  let updated = 0;

  if (normalizedEmail) {
    // 1) visitorId 维度 → email 升级（cookie 游客填邮箱）
    if (visitorId) {
      const cookieLikes = await Like.findAll({
        where: { visitorId, email: null, userId: null },
      });
      for (const like of cookieLikes) {
        const conflict = await Like.findOne({
          where: { postId: like.postId, email: normalizedEmail, userId: null },
        });
        if (conflict) {
          // 冲突：保留用户最新的点赞意图。
          // 旧维度是 like 但 email 维度是 unlike → 把 email 维度恢复为 like
          // 然后软删旧 visitorId 维度记录为 unlike（WP Ulike status 翻转）
          if (like.status === "like") {
            if (conflict.status === "unlike") {
              await conflict.update({ status: "like" });
            }
            await like.update({ status: "unlike" });
            updated++;
          }
        } else {
          // 升级：补 email + 改 name + 清 visitorId/ip（维度隔离）
          await like.update({
            email: normalizedEmail,
            name: newName,
            visitorId: null,
            ip: null,
          });
          updated++;
        }
      }
    }

    // 2) IP 维度 → email 升级（未带 cookie 的访客填邮箱）
    if (ip) {
      const ipLikes = await Like.findAll({
        where: { ip, email: null, visitorId: null, userId: null },
      });
      for (const like of ipLikes) {
        const conflict = await Like.findOne({
          where: { postId: like.postId, email: normalizedEmail, userId: null },
        });
        if (conflict) {
          // 冲突：保留用户最新的点赞意图。
          // 旧维度是 like 但 email 维度是 unlike → 把 email 维度恢复为 like
          // 然后软删旧 IP 维度记录为 unlike
          if (like.status === "like") {
            if (conflict.status === "unlike") {
              await conflict.update({ status: "like" });
            }
            await like.update({ status: "unlike" });
            updated++;
          }
        } else {
          // 升级：补 email + 改 name + 清 ip
          await like.update({
            email: normalizedEmail,
            name: newName,
            ip: null,
          });
          updated++;
        }
      }
    }

    // 3) 已存在 email 维度的点赞：直接改 name（跨设备同步）
    const emailLikes = await Like.findAll({
      where: { email: normalizedEmail, userId: null, status: "like" },
    });
    for (const like of emailLikes) {
      if (like.name !== newName) {
        await like.update({ name: newName });
        updated++;
      }
    }
  } else if (visitorId) {
    // 4a) 无 email、有 cookie：更新 visitorId 维度点赞的 name
    const cookieLikes = await Like.findAll({
      where: { visitorId, email: null, userId: null, status: "like" },
    });
    for (const like of cookieLikes) {
      if (like.name !== newName) {
        await like.update({ name: newName });
        updated++;
      }
    }
  } else if (ip) {
    // 4b) 无 email、无 cookie：只更新 IP 维度匿名点赞的 name
    const ipLikes = await Like.findAll({
      where: { ip, email: null, visitorId: null, userId: null, status: "like" },
    });
    for (const like of ipLikes) {
      if (like.name !== newName) {
        await like.update({ name: newName });
        updated++;
      }
    }
  }

  // 升级点赞维度后触发 ISR 重生成，前端立即看到昵称更新
  if (updated > 0) triggerRevalidate();

  res.json({ updated, newName });
});

export default router;
