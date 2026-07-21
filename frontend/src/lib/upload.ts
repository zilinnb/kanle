const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
const BASE_URL = API_URL.replace(/\/api$/, "");
/** 站点公网域名（用于 CDN 代理时拼接 src 参数） */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "";

export function toAbsoluteUrl(url: string) {
  if (!url || typeof url !== "string") return "";
  if (url.startsWith("http")) return url;
  // Uploaded images and API routes are served by the backend
  if (url.startsWith("/uploads/") || url.startsWith("/api/")) return `${BASE_URL}${url}`;
  return url;
}

/** Upgrade http:// to https:// to avoid Mixed Content warnings on HTTPS pages.
 *  Local dev servers (localhost / 127.0.0.1) are skipped — they run HTTP only. */
export function toHttps(url: string): string {
  if (!url || typeof url !== "string") return url;
  if (url.startsWith("http://")) {
    if (url.startsWith("http://localhost") || url.startsWith("http://127.0.0.1")) {
      return url;
    }
    return "https://" + url.slice(7);
  }
  return url;
}

/**
 * 从完整 URL 中提取「域名+路径」部分（去掉协议 https://）。
 * 例如：https://kanle.net/uploads/a.jpg → kanle.net/uploads/a.jpg
 * 百度 CDN 代理的 src= 参数要求此格式（带 https:// 会 404）。
 */
function stripProtocol(url: string): string {
  return url.replace(/^https?:\/\//, "");
}

/**
 * 将相对路径转为带域名的完整 URL（含协议）。
 * 浏览器能自行解析相对路径，但 CDN 代理需要带域名才能回源。
 */
function toFullAbsoluteUrl(url: string): string {
  if (!url || typeof url !== "string") return "";
  if (url.startsWith("http")) return url;
  if (url.startsWith("data:")) return url;
  // 有 BASE_URL（开发环境）优先用 BASE_URL
  if (BASE_URL) return `${BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
  // 生产环境 BASE_URL 为空，用 NEXT_PUBLIC_SITE_URL
  if (SITE_URL) {
    const base = SITE_URL.replace(/\/$/, "");
    return `${base}${url.startsWith("/") ? "" : "/"}${url}`;
  }
  return url;
}

/**
 * 判断 URL 是否是 CDN 代理 URL（百度 gimg0）。
 * 用于决定是否跳过 next/image 优化（CDN URL 不需要再被 next/image 处理）。
 */
export function isCdnUrl(url: string): boolean {
  return !!url && url.includes("gimg0.baidu.com/gimg/");
}

/** 不支持百度 CDN 代理的域名（百度 CDN 无法回源这些域名的图片） */
const CDN_BLOCKED_DOMAINS = ["doubanio.com", "douban.com"];

/**
 * 将图片地址经过 CDN 代理加速。
 *
 * 百度图片代理格式（实测）：
 *   https://gimg0.baidu.com/gimg/app=2001&n=0&g=0n&fmt=jpeg&src=kanle.net/uploads/xxx.jpg
 *
 * src= 参数要求「域名+路径」格式（去掉 https://），直接拼接。
 * - 带 https:// → 404
 * - 相对路径 /uploads/xxx → 404（无法回源）
 * - 域名+路径 kanle.net/uploads/xxx → ✓ 成功
 *
 * 注意：豆瓣图片（doubanio.com）无法通过百度 CDN 代理，跳过。
 *
 * @param url 原图地址（相对或绝对）
 * @param cdnProxyUrl CDN 代理地址（来自 SiteSetting.cdnProxyUrl），为空则不代理
 */
export function cdnUrl(url: string, cdnProxyUrl?: string): string {
  if (!url || typeof url !== "string") return "";
  if (!cdnProxyUrl) return toHttps(toAbsoluteUrl(url));
  // 已被代理过或 data URI 直接返回
  if (url.startsWith("data:") || url.startsWith(cdnProxyUrl)) return url;
  // 豆瓣等不支持代理的域名，直接用原始 URL
  if (CDN_BLOCKED_DOMAINS.some((d) => url.includes(d))) {
    return toHttps(toAbsoluteUrl(url));
  }
  // CDN 代理需要带域名的完整 URL
  const absolute = toFullAbsoluteUrl(url);
  // 去掉 https:// 协议，拼接成「域名+路径」格式
  const srcParam = stripProtocol(toHttps(absolute));
  return `${cdnProxyUrl}${srcParam}`;
}

export async function uploadImage(file: File, token: string): Promise<string> {
  const form = new FormData();
  form.append("image", file);
  const res = await fetch(`${API_URL}/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "上传失败" }));
    throw new Error(err.message || "上传失败");
  }
  const data = await res.json();
  // 返回相对路径（/uploads/xxx.jpg），由前端渲染时通过 getImageUrl/cdnUrl 应用 CDN 代理
  return data.url;
}
