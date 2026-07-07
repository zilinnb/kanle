"use client";

import { useEffect, useState } from "react";

/**
 * 归档页面淡入容器
 *
 * 核心思路：先加载，再动画。
 * 1. SSR 阶段渲染 opacity-0（内容不可见，但浏览器已完成 DOM 构建）
 * 2. React 水合后，等封面图加载完毕（或 600ms 超时兜底）
 * 3. 双 rAF 确保浏览器已绘制完初始隐藏态、布局稳定
 * 4. 切换为 profile-fade-in 类，触发 CSS 动画
 *
 * 这样动画播在已完全准备好的页面上，和淡出一样丝滑。
 */
export default function ProfileFadeIn({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  // 动画结束后移除 profile-fade-in 类：清除 transform / will-change，
  // 否则祖先的 transform 会成为 fixed 子元素（如文章底部栏）的包含块，
  // 导致 fixed bottom-0 相对于 ProfileFadeIn 定位而非视口，底部栏不可见。
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const trigger = () => {
      if (cancelled) return;
      requestAnimationFrame(() => {
        if (cancelled) return;
        requestAnimationFrame(() => {
          if (!cancelled) setReady(true);
        });
      });
    };

    const coverImg = document.querySelector<HTMLImageElement>('img[alt="朋友圈封面"]');
    if (coverImg && !coverImg.complete) {
      const onDone = () => trigger();
      coverImg.addEventListener("load", onDone, { once: true });
      coverImg.addEventListener("error", onDone, { once: true });
      const fallback = setTimeout(trigger, 600);
      return () => {
        cancelled = true;
        coverImg.removeEventListener("load", onDone);
        coverImg.removeEventListener("error", onDone);
        clearTimeout(fallback);
      };
    }

    trigger();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      id="profile-content"
      className={`flex flex-1 flex-col ${ready ? (done ? "" : "profile-fade-in") : "opacity-0"}`}
      onAnimationEnd={() => setDone(true)}
    >
      {children}
    </div>
  );
}
