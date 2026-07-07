"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { markManualOverride } from "@/lib/dark-mode-override";

/**
 * 管理后台主题切换按钮（白天/夜间模式）
 *
 * 参考 FloatingActions.tsx 的 useTheme + markManualOverride 模式，
 * 但使用 adm-* 色系和 lucide-react 图标，适配管理后台 UI。
 */
export default function ThemeToggleButton() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  useEffect(() => setMounted(true), []);

  const isDark = mounted && theme === "dark";

  return (
    <button
      onClick={() => {
        markManualOverride();
        setTheme(isDark ? "light" : "dark");
      }}
      className="flex h-9 w-9 items-center justify-center rounded-lg text-adm-text-secondary transition-colors hover:bg-adm-card-hover hover:text-adm-text"
      aria-label={isDark ? "切换到白天模式" : "切换到夜间模式"}
      title={isDark ? "白天模式" : "夜间模式"}
    >
      {isDark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
    </button>
  );
}
