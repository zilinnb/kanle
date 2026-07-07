"use client";

import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import type { ComponentProps } from "react";
import { useEffect, useRef } from "react";
import { useSiteSettings } from "@/lib/site-settings-store";
import { getManualOverrideTime } from "@/lib/dark-mode-override";

/**
 * 夜间模式自动调度器：后端开启时段调度时按时间切换，否则不干预主题
 * （由 next-themes 的 defaultTheme="light" 默认浅色）。
 *
 * 注意：next-themes 0.4.x 的 setTheme 依赖 theme state，引用会随主题变化而变化，
 * 因此用 useRef 稳定引用，避免 useEffect 因 setTheme 变化而重新执行，
 * 否则用户手动切换后会被立即覆盖。
 */
function DarkModeScheduler() {
  const darkModeEnabled = useSiteSettings((s) => s.darkModeEnabled);
  const darkModeStartTime = useSiteSettings((s) => s.darkModeStartTime);
  const darkModeEndTime = useSiteSettings((s) => s.darkModeEndTime);
  const { setTheme } = useTheme();
  const setThemeRef = useRef(setTheme);

  // 保持 setThemeRef 最新，但不触发下方的调度 useEffect
  useEffect(() => {
    setThemeRef.current = setTheme;
  }, [setTheme]);

  useEffect(() => {
    // 后端未开启时段调度时，不干预主题，由用户手动选择（默认浅色）
    if (!darkModeEnabled) return;

    const check = () => {
      // 2 小时内有手动覆盖，跳过自动调度，尊重用户临时选择
      if (Date.now() - getManualOverrideTime() < 7200000) return;

      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

      const start = darkModeStartTime;
      const end = darkModeEndTime;
      let isDark: boolean;
      if (start <= end) {
        // 同日时段，如 09:00-18:00
        isDark = hhmm >= start && hhmm < end;
      } else {
        // 跨午夜时段，如 18:00-06:00
        isDark = hhmm >= start || hhmm < end;
      }
      setThemeRef.current(isDark ? "dark" : "light");
    };

    check();
    const interval = setInterval(check, 60000);
    return () => clearInterval(interval);
  }, [darkModeEnabled, darkModeStartTime, darkModeEndTime]);

  return null;
}

/**
 * Safari 浏览器底部栏颜色同步：跟随网站主题动态更新 <meta name="theme-color">
 * 浅色模式 = 白色 (#ffffff)，夜间模式 = 深色页面背景 (#18181c)
 */
function ThemeColorSync() {
  const { theme } = useTheme();
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    if (!meta) return;
    meta.content = theme === "dark" ? "#18181c" : "#ffffff";
  }, [theme]);
  return null;
}

export default function ThemeProvider({
  children,
  ...props
}: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      disableTransitionOnChange
      {...props}
    >
      <DarkModeScheduler />
      <ThemeColorSync />
      {children}
    </NextThemesProvider>
  );
}
