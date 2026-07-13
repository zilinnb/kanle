const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
const BASE_URL = API_URL.replace(/\/api$/, "");

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
 * 将图片地址经过 CDN 代理加速。
 * - 若 cdnProxyUrl 为空，返回原图（先转绝对地址，再升级 https）
 * - 若 cdnProxyUrl 有值，直接拼接：`${cdnProxyUrl}${encodeURIComponent(absoluteUrl)}`
 *   百度图片代理格式：https://gimg0.baidu.com/gimg/app=2001&n=0&g=0n&fmt=jpeg&src=原图地址
 *   使用 encodeURIComponent 防止原图带 &/=/# 等特殊字符破坏代理 URL
 *
 * @param url 原图地址（相对或绝对）
 * @param cdnProxyUrl CDN 代理地址（来自 SiteSetting.cdnProxyUrl），为空则不代理
 */
export function cdnUrl(url: string, cdnProxyUrl?: string): string {
  if (!url || typeof url !== "string") return "";
  const absolute = toAbsoluteUrl(url);
  if (!cdnProxyUrl) return toHttps(absolute);
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
