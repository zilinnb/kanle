"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * 灰色加载进度条
 *
 * 两个职责：
 * 1. 初始页面加载（含 Ctrl+Shift+R 硬刷新）：CSS 动画驱动的 #initial-loading-bar
 *    在 HTML 解析时立即显示，React 水合后添加 .complete 类完成并淡出。
 * 2. 路由导航：监听 usePathname() 变化，显示一条短暂的顶部进度条。
 */
export default function LoadingBar() {
  const pathname = usePathname();
  const [routeProgress, setRouteProgress] = useState(0);
  const [routeVisible, setRouteVisible] = useState(false);
  const routeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevPathRef = useRef<string | null>(null);

  // 初始页面加载：给 CSS 驱动的 #initial-loading-bar 添加 .complete 类淡出
  // 注意：不能 remove() 该节点——它是 React 管理的 DOM（layout.tsx JSX 中的 <div id="initial-loading-bar" />），
  // 手动删除会导致导航时 React 抛出 NotFoundError: removeChild
  useEffect(() => {
    const bar = document.getElementById("initial-loading-bar");
    if (bar) {
      bar.classList.add("complete");
    }
  }, []);

  // 路由导航：pathname 变化时显示短暂进度条
  useEffect(() => {
    if (prevPathRef.current === null) {
      prevPathRef.current = pathname;
      return;
    }
    if (prevPathRef.current === pathname) return;
    prevPathRef.current = pathname;

    setRouteProgress(40);
    setRouteVisible(true);

    if (routeTimerRef.current) clearTimeout(routeTimerRef.current);

    requestAnimationFrame(() => {
      setRouteProgress(75);
      routeTimerRef.current = setTimeout(() => {
        setRouteProgress(100);
        routeTimerRef.current = setTimeout(() => {
          setRouteVisible(false);
        }, 300);
      }, 200);
    });

    return () => {
      if (routeTimerRef.current) clearTimeout(routeTimerRef.current);
    };
  }, [pathname]);

  if (!routeVisible) return null;

  return (
    <div className="fixed top-0 left-0 z-[9999] h-[2px] w-full pointer-events-none">
      <div
        className="h-full bg-gray-400/50 transition-all duration-300 ease-out"
        style={{ width: `${routeProgress}%` }}
      />
    </div>
  );
}
