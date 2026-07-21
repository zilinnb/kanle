"use client";

import { Film, Star } from "lucide-react";
import type { PostDouban } from "@/lib/mock-data";
import { getImageUrl } from "@/lib/site-settings-store";
import LazyImage from "@/components/LazyImage";

const STATUS_STYLES: Record<string, string> = {
  collect: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
  do: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  wish: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
};

interface DoubanEmbedCardProps {
  item: PostDouban;
  className?: string;
  /**
   * 渲染样式：
   * - "article"（默认）：使用 link-card CSS 类，适用于文章正文（.article-content）内联渲染
   * - "feed"：影单风格放大版，竖版海报+标题+评分星星+状态标签，用于首页动态
   */
  variant?: "article" | "feed";
}

export default function DoubanEmbedCard({ item, className, variant = "article" }: DoubanEmbedCardProps) {
  const descParts: string[] = [];
  if (item.rating > 0) {
    descParts.push(`★ ${item.rating}`);
  }
  if (item.statusLabel) {
    descParts.push(item.statusLabel);
  }
  const desc = descParts.join(" · ") || item.intro || "";

  if (variant === "feed") {
    // 首页动态样式：影单风格，与链接卡片/音乐卡片尺寸一致
    return (
      <a
        href={item.link}
        target="_blank"
        rel="noopener noreferrer"
        className={`mt-2 flex w-full max-w-[240px] items-stretch overflow-hidden rounded-[8px] bg-[#f2f2f2] transition-colors hover:bg-[#eaeaea] active:bg-[#e0e0e0] dark:bg-[#2a2a30] dark:hover:bg-[#33333a] dark:active:bg-[#3a3a42] md:max-w-[280px] ${className || ""}`}
      >
        {/* 左侧竖版海报 */}
        <div className="flex h-[72px] w-[48px] shrink-0 items-center justify-center overflow-hidden bg-black/[0.02] dark:bg-white/[0.02] md:h-[80px] md:w-[54px]">
          {item.cover ? (
            <LazyImage
              src={getImageUrl(item.cover)}
              alt={item.title}
              className="h-full w-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <Film className="h-5 w-5 text-black/30 dark:text-white/30 md:h-6 md:w-6" />
          )}
        </div>
        {/* 右侧内容 */}
        <div className="flex min-w-0 flex-1 flex-col justify-center bg-white/35 px-3 dark:bg-white/[0.04]">
          <p className="line-clamp-1 text-[14px] font-medium leading-[20px] text-black/[0.87] dark:text-white/90 md:text-[15px] md:leading-[21px]">
            {item.title}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {item.rating > 0 && (
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star
                    key={n}
                    className={`h-3 w-3 ${n <= item.rating ? "fill-amber-400 text-amber-400" : "text-gray-300 dark:text-gray-600"}`}
                  />
                ))}
              </div>
            )}
            {item.statusLabel && (
              <span className={`rounded px-1 py-0.5 text-[10px] font-medium leading-tight ${STATUS_STYLES[item.status] || "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-400"}`}>
                {item.statusLabel}
              </span>
            )}
          </div>
          {item.intro && (
            <p className="mt-0.5 line-clamp-1 text-[12px] leading-[15px] text-black/50 dark:text-white/50 md:text-[13px] md:leading-[16px]">
              {item.intro}
            </p>
          )}
        </div>
      </a>
    );
  }

  // 文章正文样式：使用 link-card CSS 类
  return (
    <a
      href={item.link}
      target="_blank"
      rel="noopener noreferrer"
      className={`link-card ${className || ""}`}
    >
      {item.cover ? (
        <span className="link-card-image">
          <LazyImage
            src={getImageUrl(item.cover)}
            alt=""
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        </span>
      ) : (
        <span className="link-card-image link-card-image-placeholder">
          <Film className="h-5 w-5" />
        </span>
      )}
      <span className="link-card-body">
        <span className="link-card-title">{item.title}</span>
        {desc && <span className="link-card-desc">{desc}</span>}
      </span>
    </a>
  );
}
