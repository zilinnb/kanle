"use client";

import Link from "next/link";
import { FileText } from "lucide-react";
import { getImageUrl } from "@/lib/site-settings-store";
import LazyImage from "@/components/LazyImage";
import type { ArticleEmbedData } from "../editor/embed-utils";

interface ArticleEmbedCardProps {
  article: ArticleEmbedData;
  className?: string;
}

export default function ArticleEmbedCard({ article, className }: ArticleEmbedCardProps) {
  const url = `/articles/${article.shortId || article.id}`;
  return (
    <Link
      href={url}
      className={`mt-2 flex w-full max-w-[360px] items-stretch overflow-hidden rounded-[8px] border border-wechat-border bg-wechat-bubble transition-colors hover:bg-wechat-hover md:max-w-[400px] ${className || ""}`}
    >
      {/* 左侧封面 */}
      <div className="relative h-[72px] w-[54px] shrink-0 overflow-hidden bg-black/5 dark:bg-white/5 md:h-[80px] md:w-[60px]">
        {article.cover ? (
          <LazyImage
            src={getImageUrl(article.cover)}
            alt=""
            className="h-full w-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-wechat-time">
            <FileText className="h-5 w-5" />
          </div>
        )}
      </div>
      {/* 右侧内容 */}
      <div className="flex min-w-0 flex-1 flex-col justify-center px-3 py-1">
        <p className="line-clamp-1 text-[14px] font-medium leading-[20px] text-wechat-text dark:text-white/90 md:text-[15px] md:leading-[21px]">
          {article.title || "文章"}
        </p>
        {article.excerpt && (
          <p className="mt-0.5 line-clamp-1 text-[12px] leading-[15px] text-wechat-time dark:text-white/50 md:text-[13px] md:leading-[16px]">
            {article.excerpt}
          </p>
        )}
      </div>
    </Link>
  );
}
