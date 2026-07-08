"use client";

import { useEffect, useState, useMemo } from "react";
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

interface DoubanData {
  movies: DoubanItem[];
  books: DoubanItem[];
  music: DoubanItem[];
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

// 各 Tab 下各状态对应的中文标签
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

// 状态徽章颜色
const STATUS_STYLES: Record<DoubanStatus, string> = {
  collect: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
  do: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  wish: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
};

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

export default function DoubanSidebar({ embedded = false }: { embedded?: boolean } = {}) {
  const [data, setData] = useState<DoubanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("movie");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const API_URL = getApiUrl();

  useEffect(() => {
    fetch(`${API_URL}/douban`)
      .then((res) => (res.ok ? res.json() : null))
      .then((d: DoubanData | null) => {
        setData(d);
        if (d) {
          if (d.movies.length > 0) setActiveTab("movie");
          else if (d.books.length > 0) setActiveTab("book");
          else if (d.music.length > 0) setActiveTab("music");
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [API_URL]);

  // 切换 Tab 时重置状态筛选
  const switchTab = (tab: Tab) => {
    setActiveTab(tab);
    setStatusFilter("all");
  };

  const allItems = useMemo(() => {
    if (!data) return [];
    return activeTab === "movie" ? data.movies : activeTab === "book" ? data.books : data.music;
  }, [data, activeTab]);

  // 按状态筛选
  const filteredItems = useMemo(() => {
    if (statusFilter === "all") return allItems;
    return allItems.filter((item) => item.status === statusFilter);
  }, [allItems, statusFilter]);

  // 各状态的计数
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: allItems.length };
    for (const item of allItems) {
      counts[item.status] = (counts[item.status] || 0) + 1;
    }
    return counts;
  }, [allItems]);

  const isEmpty =
    !loading && (!data || (!data.movies.length && !data.books.length && !data.music.length));

  const innerContent = isEmpty ? (
    <div className="flex flex-col items-center py-4 text-wechat-time">
      <Film className="mb-1 h-5 w-5" />
      <p className="text-xs">暂无豆瓣数据</p>
    </div>
  ) : (
    <>
      {/* 主分类 Tab */}
      <div className="mb-2 flex gap-1 rounded-lg bg-wechat-bubble p-1 dark:bg-white/5">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const count =
            tab.key === "movie"
              ? data?.movies.length
              : tab.key === "book"
              ? data?.books.length
              : data?.music.length;
          if (!count) return null;
          return (
            <button
              key={tab.key}
              onClick={() => switchTab(tab.key)}
              className={`flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                activeTab === tab.key
                  ? "bg-wechat-white text-wechat-text shadow-sm dark:bg-white/10 dark:text-white"
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
      {!loading && allItems.length > 0 && (
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

      {/* 列表 */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-2.5 px-2 py-1.5">
              <div className="h-10 w-8 shrink-0 animate-pulse rounded bg-wechat-bubble dark:bg-white/5" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-3/4 animate-pulse rounded bg-wechat-bubble dark:bg-white/5" />
                <div className="h-2.5 w-1/2 animate-pulse rounded bg-wechat-bubble dark:bg-white/5" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="py-4 text-center text-xs text-wechat-time">暂无数据</div>
      ) : (
        <ul className="space-y-0.5">
          {filteredItems.map((item, i) => (
            <li key={i}>
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
        </ul>
      )}
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
        {data?.syncedAt && (
          <span className="ml-auto text-[10px] text-wechat-time/60">
            {new Date(data.syncedAt).toLocaleDateString("zh-CN", {
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
