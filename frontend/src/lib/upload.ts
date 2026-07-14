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

/** Upgrade http:// to https:// to avoid Mixed Content warnings on HTTPS pages */
export function toHttps(url: string): string {
  if (!url || typeof url !== "string") return url;
  if (url.startsWith("http://")) return "https://" + url.slice(7);
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
 * 将图片地址经过 CDN 代理加速。
 *
 * 百度图片代理格式（实测）：
 *   https://gimg0.baidu.com/gimg/app=2001&n=0&g=0n&fmt=jpeg&src=kanle.net/uploads/xxx.jpg
 *
 * src= 参数要求「域名+路径」格式（去掉 https://），直接编码拼接。
 * - 带 https:// → 404
 * - 相对路径 /uploads/xxx → 404（无法回源）
 * - 域名+路径 kanle.net/uploads/xxx → ✓ 成功
 * - URL编码后的完整URL https%3A%2F%2Fkanle.net%2F... → ✓ 也成功
 *
 * 为保持 URL 简洁且与百度缓存一致，采用「域名+路径」格式（不编码）。
 *
 * @param url 原图地址（相对或绝对）
 * @param cdnProxyUrl CDN 代理地址（来自 SiteSetting.cdnProxyUrl），为空则不代理
 */
export function cdnUrl(url: string, cdnProxyUrl?: string): string {
  if (!url || typeof url !== "string") return "";
  if (!cdnProxyUrl) return toHttps(toAbsoluteUrl(url));
  // CDN 代理需要带域名的完整 URL
  const absolute = toFullAbsoluteUrl(url);
  // 已被代理过或 data URI 直接返回
  if (absolute.startsWith("data:") || absolute.startsWith(cdnProxyUrl)) return absolute;
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
