"use client";

import { useEffect } from "react";

/**
 * 全局表情图片渐显控制器
 *
 * 监听所有 class="inline-emoji" 的 <img> 元素：
 * - 图片加载完成时添加 .emoji-loaded 类，触发 CSS opacity 过渡
 * - 覆盖 SSR 初始图片、React 后续渲染、contentEditable 插入、缓存加载等场景
 */
export default function EmojiFadeController() {
  useEffect(() => {
    const CLASS = "inline-emoji";
    const LOADED = "emoji-loaded";

    const markLoaded = (img: HTMLImageElement) => {
      if (img.classList.contains(LOADED)) return;
      if (img.complete && img.naturalWidth > 0) {
        img.classList.add(LOADED);
      }
    };

    const onLoad = (e: Event) => {
      const t = e.target as Element;
      if (t && t.tagName === "IMG" && t.classList.contains(CLASS)) {
        t.classList.add(LOADED);
      }
    };

    document.addEventListener("load", onLoad, true);

    document.querySelectorAll<HTMLImageElement>(`img.${CLASS}`).forEach(markLoaded);

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.addedNodes.forEach((node) => {
          if (node.nodeType !== Node.ELEMENT_NODE) return;
          const el = node as HTMLElement;
          if (el.tagName === "IMG" && el.classList.contains(CLASS)) {
            markLoaded(el as HTMLImageElement);
          } else {
            el.querySelectorAll<HTMLImageElement>(`img.${CLASS}`).forEach(markLoaded);
          }
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      document.removeEventListener("load", onLoad, true);
      observer.disconnect();
    };
  }, []);

  return null;
}
