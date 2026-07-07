"use client";

import { useState } from "react";

interface FadeImageProps {
  src: string;
  alt?: string;
  className?: string;
  onError?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
}

/**
 * 带渐显效果的 <img> 包装组件
 * 图片加载前 opacity-0，加载完成后 500ms 过渡到 opacity-100
 */
export default function FadeImage({ src, alt = "", className = "", onError }: FadeImageProps) {
  const [loaded, setLoaded] = useState(false);

  return (
    <img
      src={src}
      alt={alt}
      onLoad={() => setLoaded(true)}
      onError={onError}
      className={`transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"} ${className}`}
    />
  );
}
