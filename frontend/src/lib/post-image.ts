import type { PostImage } from "./mock-data";
import { toAbsoluteUrl } from "./upload";

export function isLivePhoto(img: PostImage): boolean {
  return typeof img === "object" && !!img?.video;
}

export function getImageSrc(img: PostImage): string {
  return typeof img === "string" ? img : img.src;
}

export function getVideoSrc(img: PostImage): string | undefined {
  return typeof img === "string" ? undefined : img.video;
}

// 将 PostImage[] 中的相对路径转为绝对路径（用于显示）
export function normalizeImages(
  images: PostImage[] | undefined | null
): PostImage[] {
  if (!images || !Array.isArray(images)) return [];
  return images.map((img) => {
    if (typeof img === "string") return toAbsoluteUrl(img);
    if (!img) return { src: "", video: undefined };
    return {
      src: toAbsoluteUrl(img.src),
      video: img.video ? toAbsoluteUrl(img.video) : undefined,
    };
  });
}

// 提取纯 src 数组（用于旧组件兼容、预加载等）
export function extractImageSrcs(images: PostImage[]): string[] {
  return images.map(getImageSrc);
}
