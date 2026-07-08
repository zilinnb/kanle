import { Router, Request, Response } from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import axios from "axios";
import { SiteSetting } from "../models";
import { authenticate, requireAdmin, AuthRequest } from "../middleware/auth";
import { getDoubanData, DoubanCollection, DoubanItem } from "../services/douban-service";

const router = Router();

// 豆瓣图片磁盘缓存目录
const CACHE_DIR = path.join(__dirname, "../../public/uploads/douban-cache");
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// 允许代理的豆瓣图片域名
const ALLOWED_HOSTS = [
  "img1.doubanio.com",
  "img2.doubanio.com",
  "img3.doubanio.com",
  "img9.doubanio.com",
  "img1.douban.com",
  "img2.douban.com",
  "img3.douban.com",
  "img5.douban.com",
  "img6.douban.com",
  "img7.douban.com",
  "img8.douban.com",
  "img9.douban.com",
];

async function getDoubanId(): Promise<string> {
  const setting = await SiteSetting.findByPk(1);
  return setting?.doubanId || "";
}

/**
 * 将豆瓣图片 URL 包装为代理 URL，绕过防盗链
 */
function wrapCoverUrl(cover: string): string {
  if (!cover) return "";
  // 已经是本地路径或代理 URL 则不处理
  if (cover.startsWith("/uploads/") || cover.startsWith("/api/")) return cover;
  try {
    const parsed = new URL(cover);
    if (!ALLOWED_HOSTS.some((h) => parsed.hostname === h)) return cover;
    return `/api/douban/proxy?url=${encodeURIComponent(cover)}`;
  } catch {
    return cover;
  }
}

/**
 * 将 DoubanCollection 中所有 cover URL 包装为代理 URL
 */
function wrapCollectionCovers(data: DoubanCollection): DoubanCollection {
  const wrap = (items: DoubanItem[]): DoubanItem[] =>
    items.map((item) => ({ ...item, cover: wrapCoverUrl(item.cover) }));

  return {
    ...data,
    movies: wrap(data.movies),
    books: wrap(data.books),
    music: wrap(data.music),
  };
}

/**
 * 获取图片的磁盘缓存路径
 */
function getCachePath(url: string): { cachePath: string; ext: string } {
  const hash = crypto.createHash("md5").update(url).digest("hex");
  let ext = ".jpg";
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname;
    const m = pathname.match(/\.(jpg|jpeg|png|webp|gif)$/i);
    if (m) ext = `.${m[1].toLowerCase()}`;
  } catch {}
  return { cachePath: path.join(CACHE_DIR, `${hash}${ext}`), ext };
}

// GET /api/douban/proxy — 代理豆瓣图片，绕过防盗链
// 磁盘缓存，首次请求下载，后续直接返回本地文件
router.get("/proxy", async (req: Request, res: Response) => {
  const targetUrl = req.query.url as string;
  if (!targetUrl) {
    res.status(400).json({ message: "缺少 url 参数" });
    return;
  }

  // 安全校验：只允许豆瓣图片域名
  try {
    const parsed = new URL(targetUrl);
    if (!ALLOWED_HOSTS.some((h) => parsed.hostname === h)) {
      res.status(403).json({ message: "不允许的图片域名" });
      return;
    }
  } catch {
    res.status(400).json({ message: "无效的 URL" });
    return;
  }

  const { cachePath, ext } = getCachePath(targetUrl);

  // 命中磁盘缓存 → 直接返回
  if (fs.existsSync(cachePath) && fs.statSync(cachePath).size > 0) {
    const mime =
      ext === ".png" ? "image/png"
      : ext === ".webp" ? "image/webp"
      : ext === ".gif" ? "image/gif"
      : "image/jpeg";
    res.setHeader("Content-Type", mime);
    res.setHeader("Cache-Control", "public, max-age=86400");
    fs.createReadStream(cachePath).pipe(res);
    return;
  }

  // 未命中缓存 → 从豆瓣下载
  try {
    const resp = await axios.get(targetUrl, {
      responseType: "arraybuffer",
      timeout: 10000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: "https://www.douban.com/",
        Accept: "image/webp,image/apng,image/*,*/*;q=0.8",
      },
    });

    if (resp.status !== 200) {
      res.status(502).json({ message: "豆瓣图片获取失败" });
      return;
    }

    const buffer = Buffer.from(resp.data);

    // 写入磁盘缓存
    try {
      fs.writeFileSync(cachePath, buffer);
    } catch {
      // 缓存写入失败不影响返回
    }

    const contentType = String(resp.headers["content-type"] || "image/jpeg");
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(buffer);
  } catch {
    res.status(502).json({ message: "图片下载失败" });
  }
});

type CollectionType = "movie" | "book" | "music";
const VALID_TYPES: CollectionType[] = ["movie", "book", "music"];
const VALID_STATUSES = ["all", "collect", "do", "wish"];

// GET /api/douban — 获取豆瓣数据（公开接口，有缓存）
// 所有图片 URL 包装为代理 URL 以绕过防盗链
//
// 不带查询参数：返回全量数据 { movies, books, music, syncedAt, doubanId }（DoubanPicker 等需要搜索的场景）
// 带 ?type= 时：返回分页结构，供侧边栏无限滚动使用：
//   { data, pagination, typeCounts, statusCounts, syncedAt, doubanId }
router.get("/", async (req: Request, res: Response) => {
  try {
    const doubanId = await getDoubanId();
    if (!doubanId) {
      // 无豆瓣 ID：两种形态都返回空
      if (req.query.type) {
        res.json({
          data: [],
          pagination: { page: 1, limit: 10, total: 0, hasMore: false },
          typeCounts: { movie: 0, book: 0, music: 0 },
          statusCounts: { all: 0, collect: 0, do: 0, wish: 0 },
          syncedAt: "",
          doubanId: "",
        });
      } else {
        res.json({
          movies: [],
          books: [],
          music: [],
          syncedAt: "",
          doubanId: "",
        });
      }
      return;
    }

    const data = await getDoubanData(doubanId);
    const wrapped = wrapCollectionCovers(data);

    // 无 type 参数 → 返回全量（向后兼容）
    if (!req.query.type) {
      res.json(wrapped);
      return;
    }

    // 分页模式
    const type = (req.query.type as string) as CollectionType;
    if (!VALID_TYPES.includes(type)) {
      res.status(400).json({ message: "无效的 type 参数" });
      return;
    }
    const status = (req.query.status as string) || "all";
    if (!VALID_STATUSES.includes(status)) {
      res.status(400).json({ message: "无效的 status 参数" });
      return;
    }

    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 10));

    const typeKey = type === "movie" ? "movies" : type === "book" ? "books" : "music";
    const allOfType: DoubanItem[] = wrapped[typeKey];

    // 各类型总数（用于 Tab 显示/默认选中）
    const typeCounts = {
      movie: wrapped.movies.length,
      book: wrapped.books.length,
      music: wrapped.music.length,
    };

    // 当前类型各状态计数（用于状态筛选按钮显示）
    const statusCounts = { all: allOfType.length, collect: 0, do: 0, wish: 0 };
    for (const item of allOfType) {
      statusCounts[item.status] = (statusCounts[item.status] || 0) + 1;
    }

    // 按状态筛选
    const filtered =
      status === "all" ? allOfType : allOfType.filter((item) => item.status === status);

    const total = filtered.length;
    const start = (page - 1) * limit;
    const pageItems = filtered.slice(start, start + limit);

    res.json({
      data: pageItems,
      pagination: { page, limit, total, hasMore: start + limit < total },
      typeCounts,
      statusCounts,
      syncedAt: wrapped.syncedAt,
      doubanId: wrapped.doubanId,
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message || "获取豆瓣数据失败" });
  }
});

// POST /api/douban/sync — 手动同步豆瓣数据（仅管理员）
router.post(
  "/sync",
  authenticate,
  requireAdmin,
  async (_req: AuthRequest, res: Response) => {
    try {
      const doubanId = await getDoubanId();
      if (!doubanId) {
        res.status(400).json({
          success: false,
          message: "请先在设置中填写豆瓣 ID",
        });
        return;
      }
      const data = await getDoubanData(doubanId, true);
      res.json({
        success: true,
        message: `同步成功：电影 ${data.movies.length} 部，图书 ${data.books.length} 本，音乐 ${data.music.length} 张`,
        data: wrapCollectionCovers(data),
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        message: err.message || "同步失败",
      });
    }
  }
);

export default router;
