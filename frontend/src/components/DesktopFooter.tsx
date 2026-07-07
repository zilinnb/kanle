"use client";

import { useEffect } from "react";
import { useSiteSettings } from "@/lib/site-settings-store";

/** Desktop footer: fixed bottom-left corner, copyright + program name + beian */
export default function DesktopFooter() {
  const beian = useSiteSettings((s) => s.beian);
  const beianUrl = useSiteSettings((s) => s.beianUrl);
  const loaded = useSiteSettings((s) => s.loaded);
  const fetchSettings = useSiteSettings((s) => s.fetchSettings);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  if (!loaded) return null;

  const beianHref = beianUrl || "https://beian.miit.gov.cn";
  const year = new Date().getFullYear();

  return (
    <div className="fixed bottom-4 left-12 z-10 hidden md:block">
      <div className="space-y-0.5 text-left">
        <p className="text-[11px] leading-relaxed text-wechat-time">
          &copy; {year}{" "}
          <a
            href="https://kanle.net"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium transition-colors hover:text-wechat-text-secondary"
          >
            kanle
          </a>{" "}
          by 小予 · 程序由AI生成
        </p>
        {beian && (
          <a
            href={beianHref}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-[11px] leading-relaxed text-wechat-time transition-colors hover:text-wechat-text-secondary"
          >
            {beian}
          </a>
        )}
      </div>
    </div>
  );
}
