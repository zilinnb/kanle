"use client";

import { useEffect } from "react";
import { useSiteSettings } from "@/lib/site-settings-store";

/** Mobile footer: only beian, at bottom of main content */
export default function Footer() {
  const beian = useSiteSettings((s) => s.beian);
  const beianUrl = useSiteSettings((s) => s.beianUrl);
  const loaded = useSiteSettings((s) => s.loaded);
  const fetchSettings = useSiteSettings((s) => s.fetchSettings);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  if (!loaded || !beian) return null;

  const href = beianUrl || "https://beian.miit.gov.cn";

  return (
    <footer className="px-4 pb-6 pt-2 text-center md:hidden">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[11px] text-wechat-time transition-colors hover:text-wechat-text-secondary"
      >
        {beian}
      </a>
    </footer>
  );
}
