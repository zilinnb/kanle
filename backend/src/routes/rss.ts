import { Router, Request, Response } from "express";
import { body, validationResult } from "express-validator";
import RSSParser from "rss-parser";
import { RssSource, RssArticle } from "../models";
import { authenticate, requireAdmin, AuthRequest } from "../middleware/auth";

const router = Router();
const parser = new RSSParser({
  timeout: 10000,
  headers: {
    "User-Agent": "Mozilla/5.0 (compatible; KanleRSS/1.0)",
  },
});

// 提取文章摘要中的第一张图片作为缩略图
function extractThumbnail(content: string): string {
  if (!content) return "";
  const match = content.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match ? match[1] : "";
}

// 清理 HTML 标签，截取摘要
function stripHtml(html: string, maxLen = 200): string {
  if (!html) return "";
  const text = html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
  return text.length > maxLen ? text.slice(0, maxLen) + "..." : text;
}

// 抓取单个 RSS 源
async function fetchRssSource(source: RssSource): Promise<number> {
  try {
    const feed = await parser.parseURL(source.url);
    let inserted = 0;

    for (const item of feed.items) {
      const guid = item.guid || item.link || item.title || "";
      if (!guid) continue;

      const link = item.link || "";
      const title = item.title || "无标题";
      const content = item.content || item.contentSnippet || item.summary || "";
      const thumbnail = extractThumbnail(content) || (item as { enclosure?: { url?: string } }).enclosure?.url || "";
      const pubDate = item.isoDate ? new Date(item.isoDate) : item.pubDate ? new Date(item.pubDate) : new Date();
      const author = item.creator || item.author || source.name;

      // 按 sourceId + guid 去重
      const existing = await RssArticle.findOne({ where: { sourceId: source.id, guid } });
      if (existing) {
        // 更新内容（标题/链接可能变化）
        await existing.update({
          title: title.slice(0, 500),
          link: link.slice(0, 1000),
          desc: stripHtml(content),
          author: author.slice(0, 100),
          thumbnail: thumbnail.slice(0, 500),
          pubDate,
        });
      } else {
        await RssArticle.create({
          sourceId: source.id,
          title: title.slice(0, 500),
          link: link.slice(0, 1000),
          desc: stripHtml(content),
          author: author.slice(0, 100),
          thumbnail: thumbnail.slice(0, 500),
          pubDate,
          guid: guid.slice(0, 500),
        });
        inserted++;
      }
    }

    return inserted;
  } catch (err) {
    console.error(`[RSS] 抓取失败 ${source.name} (${source.url}):`, (err as Error).message);
    return 0;
  }
}

// 抓取所有 RSS 源
export async function refreshAllRss(): Promise<{ total: number; inserted: number }> {
  const sources = await RssSource.findAll({ order: [["sort", "ASC"], ["createdAt", "ASC"]] });
  let totalInserted = 0;

  for (const source of sources) {
    const inserted = await fetchRssSource(source);
    totalInserted += inserted;
  }

  // 清理超过 500 条的旧文章
  const totalCount = await RssArticle.count();
  if (totalCount > 500) {
    const oldArticles = await RssArticle.findAll({
      order: [["pubDate", "DESC"]],
      offset: 500,
      limit: totalCount - 500,
      attributes: ["id"],
    });
    if (oldArticles.length > 0) {
      await RssArticle.destroy({ where: { id: oldArticles.map((a) => a.id) } });
    }
  }

  return { total: sources.length, inserted: totalInserted };
}

// 定时抓取（每 30 分钟）
let refreshTimer: NodeJS.Timeout | null = null;
function startScheduledRefresh() {
  if (refreshTimer) return;
  // 启动后 10 秒首次抓取
  setTimeout(async () => {
    try {
      const result = await refreshAllRss();
      console.log(`[RSS] 初始抓取完成: ${result.total} 个源, 新增 ${result.inserted} 篇`);
    } catch (err) {
      console.error("[RSS] 初始抓取失败:", err);
    }
  }, 10000);

  // 每 30 分钟抓取一次
  refreshTimer = setInterval(async () => {
    try {
      const result = await refreshAllRss();
      console.log(`[RSS] 定时抓取完成: ${result.total} 个源, 新增 ${result.inserted} 篇`);
    } catch (err) {
      console.error("[RSS] 定时抓取失败:", err);
    }
  }, 30 * 60 * 1000);
}

startScheduledRefresh();

// ===== 公开 API =====

// GET /api/rss/articles - 获取 RSS 文章列表（分页，按发布时间倒序）
router.get("/articles", async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(String(req.query.page || "1")) || 1);
  const limit = Math.max(1, Math.min(50, parseInt(String(req.query.limit || "20")) || 20));

  const { rows, count } = await RssArticle.findAndCountAll({
    include: [{ association: "source", attributes: ["id", "name", "avatar", "url"] }],
    order: [["pubDate", "DESC"], ["createdAt", "DESC"]],
    offset: (page - 1) * limit,
    limit,
    distinct: true,
  });

  res.json({
    data: rows,
    pagination: { page, limit, total: count, hasMore: page * limit < count },
  });
});

// GET /api/rss/sources - 获取订阅源列表（公开）
router.get("/sources", async (_req: Request, res: Response) => {
  const sources = await RssSource.findAll({
    order: [["sort", "ASC"], ["createdAt", "ASC"]],
    include: [{ association: "articles", attributes: ["id"], required: false }],
  });
  res.json({
    data: sources.map((s) => ({
      id: s.id,
      name: s.name,
      url: s.url,
      avatar: s.avatar,
      desc: s.desc,
      sort: s.sort,
      articleCount: (s as unknown as { articles?: unknown[] }).articles?.length || 0,
    })),
  });
});

// ===== 管理 API =====

// POST /api/rss/sources - 创建订阅源（管理员）
router.post(
  "/sources",
  authenticate,
  requireAdmin,
  [
    body("name").trim().isLength({ min: 1, max: 100 }),
    body("url").trim().isLength({ min: 1, max: 500 }),
    body("avatar").optional().trim().isLength({ max: 512 }),
    body("desc").optional().trim().isLength({ max: 255 }),
  ],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    const source = await RssSource.create({
      name: req.body.name,
      url: req.body.url,
      avatar: req.body.avatar || "",
      desc: req.body.desc || "",
    });
    // 创建后立即抓取
    fetchRssSource(source).catch(() => {});
    res.status(201).json(source);
  }
);

// PUT /api/rss/sources/:id - 更新订阅源（管理员）
router.put(
  "/sources/:id",
  authenticate,
  requireAdmin,
  [
    body("name").optional().trim().isLength({ min: 1, max: 100 }),
    body("url").optional().trim().isLength({ min: 1, max: 500 }),
    body("avatar").optional().trim().isLength({ max: 512 }),
    body("desc").optional().trim().isLength({ max: 255 }),
  ],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    const source = await RssSource.findByPk(String(req.params.id));
    if (!source) {
      res.status(404).json({ message: "订阅源不存在" });
      return;
    }
    await source.update({
      name: req.body.name ?? source.name,
      url: req.body.url ?? source.url,
      avatar: req.body.avatar ?? source.avatar,
      desc: req.body.desc ?? source.desc,
    });
    // URL 变更后重新抓取
    if (req.body.url && req.body.url !== source.url) {
      fetchRssSource(source).catch(() => {});
    }
    res.json(source);
  }
);

// DELETE /api/rss/sources/:id - 删除订阅源及其文章（管理员）
router.delete(
  "/sources/:id",
  authenticate,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    const source = await RssSource.findByPk(String(req.params.id));
    if (!source) {
      res.status(404).json({ message: "订阅源不存在" });
      return;
    }
    await RssArticle.destroy({ where: { sourceId: source.id } });
    await source.destroy();
    res.json({ message: "已删除" });
  }
);

// POST /api/rss/refresh - 手动刷新所有 RSS（管理员）
router.post(
  "/refresh",
  authenticate,
  requireAdmin,
  async (_req: AuthRequest, res: Response) => {
    const result = await refreshAllRss();
    res.json({ message: "刷新完成", ...result });
  }
);

export default router;
