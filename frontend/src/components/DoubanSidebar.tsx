"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Film, Book, Music, Star, ExternalLink } from "lucide-react";
import { getApiUrl } from "@/lib/api-fetch";
import { toAbsoluteUrl } from "@/lib/upload";

type DoubanStatus = "collect" | "do" | "wish";

interface DoubanItem {
  title: string;
  cover: string;
  link: string;
  rating: number;
  date: string;
  intro: string;
  comment: string;
  status: DoubanStatus;
  statusLabel: string;
}

interface PaginatedDouban {
  data: DoubanItem[];
  pagination: { page: number; limit: number; total: number; hasMore: boolean };
  typeCounts: { movie: number; book: number; music: number };
  statusCounts: { all: number; collect: number; do: number; wish: number };
  syncedAt: string;
  doubanId: string;
}

type Tab = "movie" | "book" | "music";
type StatusFilter = "all" | DoubanStatus;

const TABS: { key: Tab; label: string; icon: typeof Film }[] = [
  { key: "movie", label: "电影", icon: Film },
  { key: "book", label: "图书", icon: Book },
  { key: "music", label: "音乐", icon: Music },
];

const STATUS_FILTERS: Record<Tab, { key: DoubanStatus; label: string }[]> = {
  movie: [
    { key: "collect", label: "看过" },
    { key: "do", label: "在看" },
    { key: "wish", label: "想看" },
  ],
  book: [
    { key: "collect", label: "读过" },
    { key: "do", label: "在读" },
    { key: "wish", label: "想读" },
  ],
  music: [
    { key: "collect", label: "听过" },
    { key: "do", label: "在听" },
    { key: "wish", label: "想听" },
  ],
};

const STATUS_STYLES: Record<DoubanStatus, string> = {
  collect: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
  do: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  wish: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
};

const PAGE_LIMIT = 10;

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const m = dateStr.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${parseInt(m[2])}月${parseInt(m[3])}日`;
  return dateStr;
}

function RatingStars({ rating }: { rating: number }) {
  if (rating <= 0) return null;
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`h-2.5 w-2.5 ${n <= rating ? "fill-amber-400 text-amber-400" : "text-gray-300 dark:text-gray-600"}`}
        />
      ))}
    </div>
  );
}

/** 骨架屏项：对齐真实豆瓣条目布局（封面 h-12 w-9 + 标题 + 元信息） */
function DoubanSkeleton({ count = 3 }: { count?: number }) {
  return (
    <>
      {[...Array(count)].map((_, i) => (
        <div key={i} className="flex items-start gap-2.5 rounded-lg px-2 py-1.5">
          <div className="h-12 w-9 shrink-0 animate-pulse rounded-md bg-wechat-bubble dark:bg-white/5" />
          <div className="flex-1 space-y-1.5 pt-0.5">
            <div className="h-3 w-3/4 animate-pulse rounded bg-wechat-bubble dark:bg-white/5" />
            <div className="h-2.5 w-1/2 animate-pulse rounded bg-wechat-bubble dark:bg-white/5" />
          </div>
        </div>
      ))}
    </>
  );
}

export default function DoubanSidebar({
  embedded = false,
  onDataStatus,
}: {
  embedded?: boolean;
  onDataStatus?: (hasData: boolean) => void;
} = {}) {
  const API_URL = getApiUrl();

  const [items, setItems] = useState<DoubanItem[]>([]);
  const [typeCounts, setTypeCounts] = useState<{ movie: number; book: number; music: number } | null>(null);
  const [statusCounts, setStatusCounts] = useState<{ all: number; collect: number; do: number; wish: number } | null>(null);
  const [syncedAt, setSyncedAt] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("movie");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true); // 首屏/切换加载
  const [loadingMore, setLoadingMore] = useState(false); // 加载更多

  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingMoreRef = useRef(false);
  // 记录当前 tab+status，用于 append 请求的竞态守卫
  const reqKeyRef = useRef<string>("");

  // 加载更多（append）：由 IntersectionObserver 触发，用 reqKey 守卫竞态
  const loadMore = useCallback(() => {
    if (loadingMoreRef.current || !hasMore || loading) return;
    const tab = activeTab;
    const status = statusFilter;
    const reqKey = `${tab}:${status}`;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    fetch(`${API_URL}/douban?type=${tab}&status=${status}&page=${page + 1}&limit=${PAGE_LIMIT}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((d: PaginatedDouban | null) => {
        if (!d) return;
        // tab/status 已变 → 丢弃
        if (reqKeyRef.current !== reqKey) return;
        setTypeCounts(d.typeCounts);
        setStatusCounts(d.statusCounts);
        setSyncedAt(d.syncedAt);
        setHasMore(d.pagination.hasMore);
        setPage(d.pagination.page);
        setItems((prev) => [...prev, ...d.data]);
      })
      .catch(() => {})
      .finally(() => {
        setLoadingMore(false);
        loadingMoreRef.current = false;
      });
  }, [activeTab, statusFilter, page, hasMore, loading, API_URL]);

  // 首屏 / 切换 tab / 切换 status：重置并请求第 1 页
  // 用 AbortController 取消上一个未完成的请求，避免旧响应覆盖新状态
  useEffect(() => {
    const controller = new AbortController();
    const reqKey = `${activeTab}:${statusFilter}`;
    reqKeyRef.current = reqKey;
    setLoading(true);
    setHasMore(false);
    setPage(1);
    fetch(`${API_URL}/douban?type=${activeTab}&status=${statusFilter}&page=1&limit=${PAGE_LIMIT}`, {
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((d: PaginatedDouban | null) => {
        if (!d || controller.signal.aborted) return;
        setTypeCounts(d.typeCounts);
        setStatusCounts(d.statusCounts);
        setSyncedAt(d.syncedAt);
        setHasMore(d.pagination.hasMore);
        setPage(d.pagination.page);
        setItems(d.data);
        // 首屏请求后：若当前 tab 无数据但其他 tab 有，自动切到第一个有数据的 tab
        if (d.typeCounts[activeTab] === 0) {
          const fallback = (["movie", "book", "music"] as Tab[]).find(
            (t) => d.typeCounts[t] > 0
          );
          if (fallback && fallback !== activeTab) {
            setActiveTab(fallback);
            setStatusFilter("all");
            return;
          }
        }
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [activeTab, statusFilter, API_URL]);

  // IntersectionObserver：滚动到底部自动加载
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: "50px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  const switchTab = (tab: Tab) => {
    if (tab === activeTab) return;
    setActiveTab(tab);
    setStatusFilter("all");
  };

  const totalCount = typeCounts ? typeCounts.movie + typeCounts.book + typeCounts.music : 0;
  const isEmpty = !loading && totalCount === 0;

  // 通知父组件数据状态（有数据/无数据）
  useEffect(() => {
    if (!loading) {
      onDataStatus?.(totalCount > 0);
    }
  }, [loading, totalCount, onDataStatus]);

  const innerContent = isEmpty ? (
    <div className="flex flex-col items-center py-4 text-wechat-time">
      <Film className="mb-1 h-5 w-5" />
      <p className="text-xs">暂无豆瓣数据</p>
    </div>
  ) : (
    <>
      {/* 主分类 Tab + 状态筛选 — embedded 模式下 sticky 固定在弹窗滚动区顶部 */}
      <div className={embedded ? "sticky top-0 z-10 -mx-2 bg-wechat-white px-2 pt-1 pb-1 dark:bg-[#232328]" : ""}>
        {/* 主分类 Tab */}
        <div className={`mb-2 flex gap-1 ${embedded ? "" : "rounded-lg bg-wechat-bubble p-1 dark:bg-white/5"}`}>
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const count = typeCounts ? typeCounts[tab.key] : 0;
            if (typeCounts && count === 0) return null;
            return (
              <button
                key={tab.key}
                onClick={() => switchTab(tab.key)}
                className={`flex items-center gap-1 text-xs font-medium transition-colors ${
                  embedded ? "rounded-md px-2.5 py-1" : "flex-1 justify-center rounded-md px-2 py-1.5"
                } ${
                  activeTab === tab.key
                    ? embedded
                      ? "bg-wechat-bubble text-wechat-text dark:bg-white/10"
                      : "bg-wechat-white text-wechat-text shadow-sm dark:bg-white/10 dark:text-white"
                    : "text-wechat-time hover:text-wechat-text"
                }`}
              >
                <Icon className="h-3 w-3" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* 状态筛选 */}
        {statusCounts && statusCounts.all > 0 && (
          <div className="mb-3 flex gap-1">
            <button
              onClick={() => setStatusFilter("all")}
              className={`flex-1 rounded-md px-1 py-1 text-[10px] font-medium transition-colors ${
                statusFilter === "all"
                  ? "bg-wechat-text text-wechat-white dark:bg-white dark:text-black"
                  : "bg-wechat-bubble text-wechat-time hover:text-wechat-text dark:bg-white/5"
              }`}
            >
              全部 {statusCounts.all}
            </button>
            {STATUS_FILTERS[activeTab].map((sf) => {
              const count = statusCounts[sf.key] || 0;
              if (count === 0) return null;
              return (
                <button
                  key={sf.key}
                  onClick={() => setStatusFilter(sf.key)}
                  className={`flex-1 rounded-md px-1 py-1 text-[10px] font-medium transition-colors ${
                    statusFilter === sf.key
                      ? "bg-wechat-text text-wechat-white dark:bg-white dark:text-black"
                      : "bg-wechat-bubble text-wechat-time hover:text-wechat-text dark:bg-white/5"
                  }`}
                >
                  {sf.label} {count}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 列表 */}
      {loading && items.length === 0 ? (
        <div className="space-y-0.5">
          <DoubanSkeleton count={5} />
        </div>
      ) : items.length === 0 ? (
        <div className="py-4 text-center text-xs text-wechat-time">暂无数据</div>
      ) : (
        <ul className={`space-y-0.5 transition-opacity duration-200 ${loading ? "opacity-40" : "opacity-100"}`}>
          {items.map((item, i) => (
            <li key={`${item.link}-${i}`}>
              <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-start gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-wechat-hover dark:hover:bg-white/5"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={toAbsoluteUrl(item.cover)}
                  alt={item.title}
                  loading="lazy"
                  className="h-12 w-9 shrink-0 rounded-md object-cover bg-wechat-bubble dark:bg-white/5"
                />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-[13px] font-medium leading-snug text-wechat-nickname">
                    {item.title}
                  </p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    {item.rating > 0 && <RatingStars rating={item.rating} />}
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS_STYLES[item.status]}`}
                    >
                      {item.statusLabel}
                    </span>
                    {item.date && (
                      <span className="whitespace-nowrap text-[11px] text-wechat-time/70">
                        {formatDate(item.date)}
                      </span>
                    )}
                  </div>
                </div>
                <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-wechat-time transition-colors group-hover:text-wechat-text" />
              </a>
            </li>
          ))}
          {loadingMore && <DoubanSkeleton count={3} />}
        </ul>
      )}
      <div ref={sentinelRef} className="h-1" />
    </>
  );

  if (embedded) {
    return <div>{innerContent}</div>;
  }

  return (
    <div className="rounded-2xl bg-wechat-white p-4 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_40px_-12px_rgba(0,0,0,0.4)]">
      <div className="mb-3 flex items-center gap-1.5">
        <Film className="h-4 w-4 text-wechat-nickname" />
        <h3 className="text-sm font-semibold text-wechat-text">影单</h3>
        {syncedAt && (
          <span className="ml-auto text-[10px] text-wechat-time/60">
            {new Date(syncedAt).toLocaleDateString("zh-CN", {
              month: "numeric",
              day: "numeric",
            })}
          </span>
        )}
      </div>
      {innerContent}
    </div>
  );
}
