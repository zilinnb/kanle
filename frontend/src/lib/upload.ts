const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
const BASE_URL = API_URL.replace(/\/api$/, "");
/** 站点公网域名（用于 CDN 代理时将相对路径转为绝对 URL） */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "";

export function toAbsoluteUrl(url: string) {
  if (!url || typeof url !== "string") return "";
  if (url.startsWith("http")) return url;
  // Uploaded images and API routes are served by the backend
  if (url.startsWith("/uploads/") || url.startsWith("/api/")) return `${BASE_URL}${url}`;
  return url;
}

/**
 * 将相对路径转为带域名的绝对 URL（用于 CDN 代理场景）。
 * 浏览器能自行解析相对路径，但 CDN 代理（如百度）需要完整 URL 才能回源。
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

/** Upgrade http:// to https:// to avoid Mixed Content warnings on HTTPS pages */
export function toHttps(url: string): string {
  if (!url || typeof url !== "string") return url;
  if (url.startsWith("http://")) return "https://" + url.slice(7);
  return url;
}

/**
 * 将图片地址经过 CDN 代理加速。
 * - 若 cdnProxyUrl 为空，返回原图（先转绝对地址，再升级 https）
 * - 若 cdnProxyUrl 有值，必须转为完整绝对 URL（带域名），
 *   因为 CDN 代理（如百度 gimg0）无法解析相对路径。
 *   格式：`${cdnProxyUrl}${encodeURIComponent(absoluteUrl)}`
 *   百度图片代理：https://gimg0.baidu.com/gimg/app=2001&n=0&g=0n&fmt=jpeg&src=原图地址
 *
 * @param url 原图地址（相对或绝对）
 * @param cdnProxyUrl CDN 代理地址（来自 SiteSetting.cdnProxyUrl），为空则不代理
 */
export function cdnUrl(url: string, cdnProxyUrl?: string): string {
  if (!url || typeof url !== "string") return "";
  if (!cdnProxyUrl) return toHttps(toAbsoluteUrl(url));
  // CDN 代理需要完整绝对 URL（带域名），否则代理服务器无法回源
  const absolute = toFullAbsoluteUrl(url);
  // 已被代理过或 data URI 直接返回
  if (absolute.startsWith("data:") || absolute.startsWith(cdnProxyUrl)) return absolute;
  return `${cdnProxyUrl}${encodeURIComponent(toHttps(absolute))}`;
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
  return toAbsoluteUrl(data.url);
}
