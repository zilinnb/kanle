"use client";

import { useState, useRef, useEffect, ImgHTMLAttributes } from "react";

interface LazyImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt?: string;
  /** CDN 代理失败时的回退地址。不传则尝试从 src 中提取原始 URL。 */
  fallbackSrc?: string;
}

/**
 * 尝试从 CDN 代理 URL 中提取原始图片地址。
 * 支持 `src=encodedUrl`（百度）和 `url=encodedUrl`（weserv）两种格式。
 */
function extractOriginalUrl(proxiedUrl: string): string | null {
  try {
    const match = proxiedUrl.match(/[?&](?:src|url)=([^&]+)/);
    if (match) {
      const decoded = decodeURIComponent(match[1]);
      if (decoded.startsWith("http")) return decoded;
    }
  } catch {
    // ignore
  }
  return null;
}

export default function LazyImage({
  src,
  alt = "",
  className = "",
  fallbackSrc,
  onLoad,
  onError,
  ...props
}: LazyImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(src);
  const ref = useRef<HTMLImageElement>(null);

  // src 变化时重置状态
  useEffect(() => {
    setCurrentSrc(src);
    setLoaded(false);
  }, [src]);

  // 图片从浏览器缓存加载时 onLoad 可能在 React 注册前就触发，
  // 导致 loaded 永远 false → opacity-0 → 图片不可见。
  // 这里在 mount 和 src 变化时检查 img.complete 兜底。
  useEffect(() => {
    const img = ref.current;
    if (img?.complete && img.naturalWidth > 0) {
      setLoaded(true);
    }
  }, [currentSrc]);

  return (
    <img
      ref={ref}
      src={currentSrc}
      alt={alt}
      decoding="async"
      referrerPolicy="no-referrer"
      onLoad={(e) => {
        setLoaded(true);
        onLoad?.(e);
      }}
      onError={(e) => {
        const img = e.currentTarget;
        // 如果还没尝试过回退，尝试用原始 URL
        if (!img.dataset.fallbackTried) {
          img.dataset.fallbackTried = "true";
          const original =
            fallbackSrc || extractOriginalUrl(img.src);
          if (original && original !== img.src) {
            setCurrentSrc(original);
            return;
          }
        }
        setLoaded(true);
        onError?.(e);
      }}
      className={`transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"} ${className}`}
      {...props}
    />
  );
}
