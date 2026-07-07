"use client";

import { useEffect } from "react";

/**
 * 滚动位置恢复
 *
 * 问题：桌面端用 #scroll-root 容器滚动（md:fixed md:overflow-y-auto），
 * 浏览器原生 scrollRestoration 只恢复 window，不恢复容器内部滚动。
 *
 * 方案：
 * - 滚动时（防抖）把位置写入 sessionStorage
 * - 页面加载后恢复到保存的位置
 *
 * @param storageKey sessionStorage 中存储滚动位置的 key，不同页面用不同 key
 * @param waitForFadeIn 是否等待 #profile-content 不再 opacity-0 后再恢复（profile 页面用）
 */
export default function ProfileScrollRestoration({
  storageKey = "profile-scroll-y",
  waitForFadeIn = true,
}: {
  storageKey?: string;
  waitForFadeIn?: boolean;
}) {
  useEffect(() => {
    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }

    const getScrollEl = (): HTMLElement | Window => {
      const isDesktop = window.matchMedia("(min-width: 768px)").matches;
      if (isDesktop) {
        const el = document.getElementById("scroll-root");
        if (el) return el;
      }
      return window;
    };

    // 保存滚动位置（防抖）
    let saveTimer: ReturnType<typeof setTimeout> | null = null;
    const saveScroll = () => {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        const el = getScrollEl();
        const y = el instanceof Window ? el.scrollY : el.scrollTop;
        try {
          sessionStorage.setItem(storageKey, String(y));
        } catch {}
      }, 150);
    };

    const scrollEl = getScrollEl();
    scrollEl.addEventListener("scroll", saveScroll, { passive: true });
    window.addEventListener("beforeunload", saveScroll);

    // 恢复滚动位置
    const restore = () => {
      try {
        const saved = sessionStorage.getItem(storageKey);
        if (!saved) return;
        const y = parseInt(saved, 10);
        if (isNaN(y) || y < 10) return;
        const el = getScrollEl();
        if (el instanceof Window) {
          window.scrollTo(0, y);
        } else {
          el.scrollTop = y;
        }
      } catch {}
    };

    if (waitForFadeIn) {
      // 轮询等待 ProfileFadeIn 完成（#profile-content 不再 opacity-0）
      let attempts = 0;
      const maxAttempts = 40; // 40 * 50ms = 2s
      const tryRestore = () => {
        const content = document.getElementById("profile-content");
        if (content && !content.classList.contains("opacity-0")) {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => restore());
          });
        } else if (attempts < maxAttempts) {
          attempts++;
          setTimeout(tryRestore, 50);
        } else {
          restore();
        }
      };
      tryRestore();
    } else {
      // 首页等常规页面：DOM ready 后立即恢复
      requestAnimationFrame(() => {
        requestAnimationFrame(() => restore());
      });
    }

    return () => {
      if (saveTimer) clearTimeout(saveTimer);
      scrollEl.removeEventListener("scroll", saveScroll);
      window.removeEventListener("beforeunload", saveScroll);
    };
  }, [storageKey, waitForFadeIn]);

  return null;
}
