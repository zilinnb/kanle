"use client";

import { useState, useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { markManualOverride } from "@/lib/dark-mode-override";

export default function FloatingActions({ liftAboveBottomBar = false }: { liftAboveBottomBar?: boolean }) {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  // 记录上次滚动位置，用于判断滚动方向
  const lastYRef = useRef(0);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    let rafId: number | null = null;
    const root = document.getElementById("scroll-root");

    const onScroll = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const y = Math.max(root?.scrollTop || 0, window.scrollY || 0);

        // 顶部一定隐藏
        if (y < 100) {
          setVisible(false);
          lastYRef.current = y;
          return;
        }

        const delta = y - lastYRef.current;
        // 5px 缓冲区，避免微小抖动导致频繁切换
        if (delta > 5) {
          // 下滑 → 显示
          setVisible(true);
          lastYRef.current = y;
        } else if (delta < -5) {
          // 上滑 → 隐藏
          setVisible(false);
          lastYRef.current = y;
        }
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    if (root) root.addEventListener("scroll", onScroll, { passive: true });
    lastYRef.current = Math.max(root?.scrollTop || 0, window.scrollY || 0);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", onScroll);
      if (root) root.removeEventListener("scroll", onScroll);
    };
  }, []);

  const isDark = mounted && theme === "dark";

  const btnClass =
    "misc-btn flex h-10 w-10 items-center justify-center rounded-xl border border-black/5 bg-white/70 text-black backdrop-blur-md shadow-sm transition-colors hover:bg-white/90 active:scale-90 dark:border-white/10 dark:bg-white/15 dark:text-white dark:hover:bg-white/25";

  return (
    <div
      id="misc"
      className={`fixed right-3 z-40 flex flex-col items-center gap-2 transition-[opacity,transform] duration-300 ease-out md:right-6 ${
        liftAboveBottomBar
          ? "bottom-[calc(env(safe-area-inset-bottom,0px)+5rem)] md:bottom-[calc(env(safe-area-inset-bottom,0px)+1.25rem)]"
          : "bottom-[calc(env(safe-area-inset-bottom,0px)+1.25rem)]"
      } ${
        visible
          ? "translate-y-0 opacity-100 pointer-events-auto"
          : "translate-y-4 opacity-0 pointer-events-none"
      }`}
    >
      {/* 主题切换：白天/夜间 */}
      <button
        type="button"
        id="btn-appearance"
        onClick={() => {
          markManualOverride();
          setTheme(isDark ? "light" : "dark");
        }}
        className={btnClass}
        aria-label={isDark ? "切换到白天模式" : "切换到夜间模式"}
        title={isDark ? "白天模式" : "夜间模式"}
      >
        {/* 月亮图标：白天模式时显示，点击切到夜间 */}
        <svg
          className={`ico-moon ${isDark ? "hidden" : "block"}`}
          viewBox="0 0 24 24"
          width="20"
          height="20"
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454l0 .008"></path>
        </svg>
        {/* 太阳图标：夜间模式时显示，点击切到白天 */}
        <svg
          className={`ico-sun ${isDark ? "block" : "hidden"}`}
          viewBox="0 0 24 24"
          width="20"
          height="20"
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M8 12a4 4 0 1 0 8 0a4 4 0 1 0 -8 0"></path>
          <path d="M3 12h1m8 -9v1m8 8h1m-9 8v1m-6.4 -15.4l.7 .7m12.1 -.7l-.7 .7m0 11.4l.7 .7m-12.1 -.7l.7 .7"></path>
        </svg>
      </button>

      {/* 返回顶部 */}
      <button
        type="button"
        id="btn-totop"
        onClick={() => {
          const root = document.getElementById("scroll-root");
          if (root && root.scrollTop > 0) {
            root.scrollTo({ top: 0, behavior: "smooth" });
          } else {
            window.scrollTo({ top: 0, behavior: "smooth" });
          }
        }}
        className={btnClass}
        aria-label="回到顶部"
        title="回到顶部"
      >
        <svg
          viewBox="0 0 24 24"
          width="20"
          height="20"
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 5l0 14"></path>
          <path d="M18 11l-6 -6"></path>
          <path d="M6 11l6 -6"></path>
        </svg>
      </button>
    </div>
  );
}
