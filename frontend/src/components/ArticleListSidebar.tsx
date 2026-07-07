"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BookText } from "lucide-react";
import { usePathname } from "next/navigation";
import { useSiteSettings } from "@/lib/site-settings-store";
import { toAbsoluteUrl } from "@/lib/upload";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

interface ArticleListItem {
  id: string;
  shortId?: string;
  title?: string;
  excerpt?: string;
  category?: string;
  cover?: string;
  createdAt: string;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDay = Math.floor(diffMs / 86400000);
  if (diffDay < 1) return "今天";
  if (diffDay < 7) return `${diffDay}天前`;
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

export default function ArticleListSidebar() {
  const [articles, setArticles] = useState<ArticleListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const sidebarScrollRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const currentId = pathname?.split("/").pop() || "";
  const defaultCover = useSiteSettings((s) => s.defaultCover);

  useEffect(() => {
    fetch(`${API_URL}/posts?type=article&page=1&limit=20`)
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((data) => setArticles(data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || window.innerWidth < 1024) return;
    const scrollRoot = document.getElementById("scroll-root");
    const sidebar = sidebarScrollRef.current;
    if (!scrollRoot || !sidebar) return;

    let rafId: number | null = null;
    const sync = () => {
      rafId = null;
      sidebar.scrollTop = scrollRoot.scrollTop;
    };
    const onScroll = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(sync);
    };

    scrollRoot.addEventListener("scroll", onScroll, { passive: true });
    sync();
    return () => {
      scrollRoot.removeEventListener("scroll", onScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [loading]);

  return (
    <aside className="hidden lg:block lg:fixed lg:top-6 lg:right-[calc(50%+324px)] lg:w-[220px] xl:w-[260px]">
      <div
        ref={sidebarScrollRef}
        className="no-scrollbar space-y-4 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto lg:overscroll-contain"
      >
        <div className="rounded-2xl bg-wechat-white p-4 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_40px_-12px_rgba(0,0,0,0.4)]">
          <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-wechat-text">
            <BookText className="h-4 w-4 text-wechat-nickname" />
            文章列表
          </h3>
          {loading ? (
            <div className="space-y-1">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="px-2 py-2">
                  <div className="h-3 w-3/4 animate-pulse rounded bg-wechat-bubble dark:bg-white/5" />
                  <div className="mt-1.5 h-2.5 w-full animate-pulse rounded bg-wechat-bubble dark:bg-white/5" />
                </div>
              ))}
            </div>
          ) : articles.length === 0 ? (
            <div className="flex flex-col items-center py-4 text-wechat-time">
              <BookText className="mb-1 h-5 w-5" />
              <p className="text-xs">暂无文章</p>
            </div>
          ) : (
            <ul className="space-y-1">
              {articles.map((article) => {
                const href = `/articles/${article.shortId || article.id}`;
                const isActive = article.id === currentId || article.shortId === currentId;
                return (
                  <li key={article.id}>
                    <Link
                      href={href}
                      className={`group flex gap-2 rounded-lg p-1.5 transition-colors ${
                        isActive
                          ? "bg-wechat-nickname/10"
                          : "hover:bg-wechat-hover dark:hover:bg-white/5"
                      }`}
                    >
                      {(article.cover || defaultCover) && (
                        <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded-md bg-wechat-bubble dark:bg-white/5">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={toAbsoluteUrl(article.cover || defaultCover)}
                            alt=""
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p
                          className={`line-clamp-2 text-[13px] font-medium leading-snug ${
                            isActive
                              ? "text-wechat-nickname"
                              : "text-wechat-text group-hover:text-wechat-nickname"
                          }`}
                        >
                          {article.title || "(无标题)"}
                        </p>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <span className="text-[11px] text-wechat-time/70">
                            {formatDate(article.createdAt)}
                          </span>
                          {article.category && (
                            <span className="rounded bg-wechat-bubble px-1 py-0.5 text-[10px] text-wechat-time dark:bg-white/5">
                              {article.category}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </aside>
  );
}
