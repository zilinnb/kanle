/**
 * 短视频解析路由
 * 代理调用统一接口 https://api.bugpk.com/api/short_videos?url={链接} 解析短视频，
 * 返回标准化的视频信息（直链/封面/标题/作者/头像/点赞/时间）。
 * 支持抖音/快手/小红书/微博；B站走 iframe 嵌入，不在此解析。
 */
import { Router, Request, Response } from "express";
import axios from "axios";
import { body, validationResult } from "express-validator";
import { authenticate, requireAdmin } from "../middleware/auth";

const router = Router();

export interface ParsedVideo {
  url: string;
  cover: string;
  title: string;
  author: string;
  avatar?: string;
  like?: number;
  time?: number;
  platform: string;
  sourceUrl: string;
  source: "parse";
}

/** 判断是否为 B 站链接（B站走 iframe 嵌入，不经过此接口） */
function isBilibili(url: string): boolean {
  return /bilibili\.com|b23\.tv/i.test(url);
}

/** 从 URL 推断平台字符串，仅用于前端展示角标 */
function inferPlatform(url: string): string {
  const u = url.toLowerCase();
  if (/douyin\.com|iesdouyin\.com|v\.douyin\.com/.test(u)) return "douyin";
  if (/kuaishou\.com|chenzhongtech\.com/.test(u)) return "kuaishou";
  if (/xiaohongshu\.com|xhslink\.com/.test(u)) return "xhs";
  if (/weibo\.(com|cn)|t\.cn/.test(u)) return "weibo";
  return "unknown";
}

/** 根据视频 CDN 域名推断 Referer，用于绕过防盗链 */
function inferReferer(hostname: string): string {
  const h = hostname.toLowerCase();
  // 抖音/字节系：douyinvod, bytecdntp, bytecdn, aweme, snssdk, zjcdn, bytegoofy, pstatp, ixigua, byteimg, douyinpic
  if (/douyin|douyinvod|snssdk|bytecdntp|bytecdn|aweme|zjcdn|bytegoofy|pstatp|ixigua|byteimg|douyinpic|byteoss/.test(h)) return "https://www.douyin.com";
  if (/kuaishou|kwaicdn|chenzhongtech|yximgs/.test(h)) return "https://www.kuaishou.com";
  if (/xhs|xhscdn|xiaohongshu/.test(h)) return "https://www.xiaohongshu.com";
  if (/weibo|sinacn|sinaimg/.test(h)) return "https://weibo.com";
  return "";
}

/** 检查是否为允许的视频 CDN 域名（防止被滥用为开放代理） */
function isAllowedVideoHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return /douyin|douyinvod|snssdk|bytecdntp|bytecdn|aweme|zjcdn|bytegoofy|pstatp|ixigua|byteimg|douyinpic|byteoss|kuaishou|kwaicdn|chenzhongtech|yximgs|xhs|xhscdn|xiaohongshu|weibo|sinacn|sinaimg|hdslb|bilivideo|bugpk/.test(h);
}

/**
 * 从 video_backup 中选择浏览器兼容性最好的视频 URL。
 * 优先选择 format=mp4 + codec=h264 的链接（Chrome/Safari/Firefox 均支持），
 * 其次选择任意 mp4 格式，最后回退到 inner.url。
 * 画质优先级：720p（移动端友好）> 1080p > 576p > 其他
 */
function selectBestVideoUrl(inner: any): string {
  const fallback = inner.url;
  const backups = inner.video_backup;
  if (!Array.isArray(backups) || backups.length === 0) {
    console.log("[video-parse] video_backup 为空，回退到 inner.url");
    return fallback;
  }

  const qualityPriority = ["720p", "1080p", "576p", "480p", "360p"];

  // 第一优先：h264 + mp4
  const h264mp4 = backups.filter(
    (v: any) => v.format === "mp4" && v.codec === "h264" && v.url
  );
  if (h264mp4.length > 0) {
    for (const q of qualityPriority) {
      const found = h264mp4.find((v: any) => v.quality === q);
      if (found) {
        console.log(`[video-parse] 选中 h264/mp4 ${q}，共 ${h264mp4.length} 个候选`);
        return found.url;
      }
    }
    console.log(`[video-parse] 选中 h264/mp4 首项，共 ${h264mp4.length} 个候选`);
    return h264mp4[0].url;
  }

  // 第二优先：任意 mp4
  const anyMp4 = backups.filter((v: any) => v.format === "mp4" && v.url);
  if (anyMp4.length > 0) {
    for (const q of qualityPriority) {
      const found = anyMp4.find((v: any) => v.quality === q);
      if (found) {
        console.log(`[video-parse] 选中 mp4 ${q}（非h264），共 ${anyMp4.length} 个候选`);
        return found.url;
      }
    }
    console.log(`[video-parse] 选中 mp4 首项（非h264），共 ${anyMp4.length} 个候选`);
    return anyMp4[0].url;
  }

  console.log("[video-parse] 未找到 mp4 格式，回退到 inner.url（可能是 h265/DASH）");
  return fallback;
}

/** 解析错误：携带 HTTP 状态码和消息 */
export class ParseError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * 公共解析函数：调用 bugpk 统一接口解析短视频链接，返回标准化的 ParsedVideo。
 * 供 POST /parse（发布时）、GET /refresh（播放时重新解析）和 POST /posts/:id/refresh-video 复用。
 * 抛出 ParseError（含 status），由路由层捕获并转换为 HTTP 响应。
 */
export async function parseVideoFromUrl(url: string): Promise<ParsedVideo> {
  // 协议校验
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new ParseError(400, "无效的 URL");
  }
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new ParseError(400, "仅支持 http/https 协议");
  }

  if (isBilibili(url)) {
    throw new ParseError(422, "B站视频请使用「嵌入代码」方式发布");
  }

  const apiUrl = `https://api.bugpk.com/api/short_videos?url=${encodeURIComponent(url)}`;

  let resp;
  try {
    resp = await axios.get(apiUrl, {
      timeout: 15000,
      maxRedirects: 5,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
  } catch (err: any) {
    if (err?.code === "ECONNABORTED") {
      throw new ParseError(504, "解析超时，请稍后重试");
    }
    throw new ParseError(502, "解析服务暂时不可用，请稍后重试");
  }

  const data = resp.data;
  const inner = data?.data;
  if (data?.code !== 200 || !inner?.url) {
    throw new ParseError(422, data?.msg || "解析失败，请检查链接或稍后重试");
  }

  const authorObj = typeof inner.author === "object" ? inner.author : null;
  const authorName = typeof inner.author === "string"
    ? inner.author
    : authorObj?.name || "";
  const authorAvatar = authorObj?.avatar || inner.avatar || undefined;
  const likeCount = typeof inner.like === "number"
    ? inner.like
    : inner.extra?.statistics?.digg_count;
  const createTime = typeof inner.time === "number"
    ? inner.time
    : inner.extra?.create_time;

  return {
    url: selectBestVideoUrl(inner),
    cover: inner.cover || "",
    title: inner.title || "",
    author: authorName,
    avatar: authorAvatar,
    like: typeof likeCount === "number" ? likeCount : undefined,
    time: typeof createTime === "number" ? createTime : undefined,
    platform: inferPlatform(url),
    sourceUrl: url,
    source: "parse",
  };
}

// POST /api/video/parse  body: { url }
router.post(
  "/parse",
  authenticate,
  requireAdmin,
  [body("url").isString().trim().notEmpty()],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ message: "请提供有效的视频链接" });
      return;
    }
    const url = req.body.url as string;
    try {
      const result = await parseVideoFromUrl(url);
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

// /refresh 端点的内存缓存：同一 sourceUrl 30 秒内返回缓存结果，避免重复解析
const refreshCache = new Map<string, { result: ParsedVideo; ts: number }>();
const REFRESH_CACHE_TTL = 30_000;

// GET /api/video/refresh?sourceUrl=...&skipCache=1
// 公开端点（无需认证）：播放解析视频时重新获取新鲜 URL，因为存储的 URL 会过期。
// skipCache=1 时跳过内存缓存，用于播放失败后自动重试获取新链接。
router.get("/refresh", async (req: Request, res: Response) => {
  const sourceUrl = req.query.sourceUrl as string;
  if (!sourceUrl || typeof sourceUrl !== "string") {
    res.status(400).json({ message: "缺少 sourceUrl 参数" });
    return;
  }

  const skipCache = req.query.skipCache === "1";

  // 命中缓存直接返回（skipCache 时跳过）
  if (!skipCache) {
    const cached = refreshCache.get(sourceUrl);
    if (cached && Date.now() - cached.ts < REFRESH_CACHE_TTL) {
      res.json(cached.result);
      return;
    }
  }

  try {
    const result = await parseVideoFromUrl(sourceUrl);
    refreshCache.set(sourceUrl, { result, ts: Date.now() });
    // 清理过期缓存项（防止内存泄漏）
    if (refreshCache.size > 50) {
      const now = Date.now();
      for (const [key, val] of refreshCache) {
        if (now - val.ts > REFRESH_CACHE_TTL) refreshCache.delete(key);
      }
    }
    res.json(result);
  } catch (err: any) {
    if (err instanceof ParseError) {
      res.status(err.status).json({ message: err.message });
    } else {
      res.status(502).json({ message: "解析服务暂时不可用，请稍后重试" });
    }
  }
});

// GET /api/video/proxy?url=...
// 视频代理：绕过 CDN 防盗链，通过后端转发视频流给浏览器。
// 支持 Range 请求（视频拖动进度条），自动添加 Referer 和 User-Agent。
router.get("/proxy", async (req: Request, res: Response) => {
  const url = req.query.url as string;
  if (!url || typeof url !== "string") {
    res.status(400).json({ message: "缺少 url 参数" });
    return;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    res.status(400).json({ message: "无效的 URL" });
    return;
  }

  if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
    res.status(400).json({ message: "仅支持 http/https" });
    return;
  }

  if (!isAllowedVideoHost(parsedUrl.hostname)) {
    res.status(403).json({ message: "不允许的域名" });
    return;
  }

  const referer = inferReferer(parsedUrl.hostname);
  const range = req.headers.range;

  const headers: Record<string, string> = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  };
  if (referer) headers["Referer"] = referer;
  if (range) headers["Range"] = range;

  try {
    const resp = await axios.get(url, {
      responseType: "stream",
      timeout: 15000,
      maxRedirects: 5,
      headers,
      // stream 模式下 axios 不会对 4xx/5xx 抛错，需手动 validateStatus
      validateStatus: () => true,
    });

    // 上游返回 4xx/5xx：链接过期或防盗链拒绝，不 pipe 错误响应体
    if (resp.status >= 400) {
      console.log(`[video-proxy] 上游 ${resp.status}：${parsedUrl.hostname}（链接可能已过期）`);
      // 消耗掉错误响应流，防止连接泄漏
      resp.data.destroy();
      if (!res.headersSent) {
        res.setHeader("Cache-Control", "no-store");
        res.status(502).json({ message: "视频链接已过期或被拒绝，请重新解析" });
      }
      return;
    }

    res.status(resp.status);
    const contentType = resp.headers["content-type"];
    const contentLength = resp.headers["content-length"];
    const contentRange = resp.headers["content-range"];
    if (contentType) res.setHeader("Content-Type", String(contentType));
    if (contentLength) res.setHeader("Content-Length", String(contentLength));
    if (contentRange) res.setHeader("Content-Range", String(contentRange));
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "public, max-age=86400");

    resp.data.pipe(res);

    // 客户端断开连接时清理上游流
    req.on("close", () => {
      resp.data.destroy();
    });
  } catch (err: any) {
    console.log(`[video-proxy] 请求异常：${parsedUrl.hostname} - ${err?.message || err}`);
    if (!res.headersSent) {
      res.status(502).json({ message: "视频代理失败" });
    }
  }
});

export default router;
