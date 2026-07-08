"use client";

import { Star, ExternalLink } from "lucide-react";
import type { PostDouban } from "@/lib/mock-data";
import { toAbsoluteUrl } from "@/lib/upload";
import LazyImage from "@/components/LazyImage";

interface DoubanEmbedCardProps {
  item: PostDouban;
  className?: string;
}

const STATUS_STYLES: Record<string, string> = {
  collect: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
  do: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  wish: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
};

export default function DoubanEmbedCard({ item, className }: DoubanEmbedCardProps) {
  return (
    <a
      href={item.link}
      target="_blank"
      rel="noopener noreferrer"
      className={`mt-2 flex w-full max-w-[240px] items-stretch overflow-hidden rounded-[8px] bg-[#f2f2f2] transition-colors hover:bg-[#eaeaea] active:bg-[#e0e0e0] dark:bg-[#2a2a30] dark:hover:bg-[#33333a] dark:active:bg-[#3a3a42] md:max-w-[280px] ${className || ""}`}
    >
      {/* 左侧封面 */}
      <div className="relative h-[72px] w-[54px] shrink-0 overflow-hidden bg-black/5 dark:bg-white/5 md:h-[80px] md:w-[60px]">
        <LazyImage
          src={toAbsoluteUrl(item.cover)}
          alt=""
          className="h-full w-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      </div>
      {/* 右侧内容 */}
      <div className="flex min-w-0 flex-1 flex-col justify-center bg-white/35 px-3 dark:bg-white/[0.04]">
        <p className="line-clamp-1 text-[14px] font-medium leading-[20px] text-black/[0.87] dark:text-white/90 md:text-[15px] md:leading-[21px]">
          {item.title}
        </p>
        <div className="mt-1 flex items-center gap-1.5">
          {/* 评分星级 */}
          {item.rating > 0 && (
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  className={`h-2.5 w-2.5 ${n <= item.rating ? "fill-amber-400 text-amber-400" : "text-gray-300 dark:text-gray-600"}`}
                />
              ))}
            </div>
          )}
          {/* 状态徽章 */}
          {item.statusLabel && (
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS_STYLES[item.status] || "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-white/60"}`}
            >
              {item.statusLabel}
            </span>
          )}
        </div>
        {/* 简介 */}
        {item.intro && (
          <p className="mt-0.5 line-clamp-1 text-[12px] leading-[15px] text-black/50 dark:text-white/50 md:text-[13px] md:leading-[16px]">
            {item.intro}
          </p>
        )}
      </div>
    </a>
  );
}
