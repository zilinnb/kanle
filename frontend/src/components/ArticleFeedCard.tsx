"use client";

import { useRouter } from "next/navigation";
import { Post, formatRelativeTime } from "@/lib/mock-data";
import { useSiteSettings, getImageUrl } from "@/lib/site-settings-store";

interface ArticleFeedCardProps {
  post: Post;
}

export default function ArticleFeedCard({ post }: ArticleFeedCardProps) {
  const router = useRouter();
  const detailUrl = `/articles/${post.shortId || post.id}`;
  const defaultCover = useSiteSettings((s) => s.defaultCover);
  const coverUrl = post.cover ? getImageUrl(post.cover) : (defaultCover ? getImageUrl(defaultCover) : "");
  const excerpt = post.excerpt || post.content?.replace(/<[^>]+>/g, "").trim().slice(0, 100) || "";

  return (
    <article
      className="cursor-pointer border-b border-wechat-border px-4 py-4 transition-colors hover:bg-wechat-bg/50 dark:hover:bg-white/[0.02]"
      onClick={() => router.push(detailUrl)}
    >
      {/* 文章标识 */}
      <div className="mb-1.5 flex items-center gap-2">
        <span className="rounded bg-wechat-bubble px-1.5 py-0.5 text-[11px] font-medium text-wechat-nickname">
          文章
        </span>
        {post.category && (
          <span className="text-[11px] text-wechat-time">{post.category}</span>
        )}
      </div>

      {/* 标题 */}
      <h2 className="mb-1 line-clamp-2 text-[16px] font-bold leading-snug text-wechat-text dark:text-white">
        {post.title || "无标题"}
      </h2>

      {/* 摘要 */}
      <p className="mb-2 line-clamp-2 text-[13px] leading-[20px] text-wechat-text-secondary">
        {excerpt}
      </p>

      {/* 封面图 + 时间 */}
      <div className="flex items-center justify-between gap-3">
        <span className="text-[12px] text-wechat-time">
          {formatRelativeTime(post.createdAt)}
        </span>
        {coverUrl && (
          <div className="h-14 w-20 shrink-0 overflow-hidden rounded">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coverUrl}
              alt={post.title || "封面"}
              className="h-full w-full object-cover"
            />
          </div>
        )}
      </div>
    </article>
  );
}
