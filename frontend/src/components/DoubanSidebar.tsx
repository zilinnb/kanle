"use client";

import { useEffect, useState } from "react";
import { Film, Book, Music, Star, ExternalLink } from "lucide-react";
import { getApiUrl } from "@/lib/api-fetch";
import { toAbsoluteUrl } from "@/lib/upload";

interface DoubanItem {
  title: string;
  cover: string;
  link: string;
  rating: number;
  date: string;
  intro: string;
  comment: string;
}

interface DoubanData {
  movies: DoubanItem[];
  books: DoubanItem[];
  music: DoubanItem[];
  syncedAt: string;
  doubanId: string;
}

type Tab = "movie" | "book" | "music";

const TABS: { key: Tab; label: string; icon: typeof Film }[] = [
  { key: "movie", label: "电影", icon: Film },
  { key: "book", label: "图书", icon: Book },
  { key: "music", label: "音乐", icon: Music },
];

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

export default function DoubanSidebar() {
  const [data, setData] = useState<DoubanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("movie");

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

  const items =
    activeTab === "movie" ? data?.movies : activeTab === "book" ? data?.books : data?.music;

  const isEmpty =
    !loading &&
    (!data || (!data.movies.length && !data.books.length && !data.music.length));

  return (
    <div className="rounded-2xl bg-wechat-white p-4 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_40px_-12px_rgba(0,0,0,0.4)]">
      <div className="mb-3 flex items-center gap-1.5">
        <Film className="h-4 w-4 text-wechat-nickname" />
        <h3 className="text-sm font-semibold text-wechat-text">豆瓣</h3>
        {data?.syncedAt && (
          <span className="ml-auto text-[10px] text-wechat-time/60">
            {new Date(data.syncedAt).toLocaleDateString("zh-CN", {
              month: "numeric",
              day: "numeric",
            })}
          </span>
        )}
      </div>

      {isEmpty ? (
        <div className="flex flex-col items-center py-4 text-wechat-time">
          <Film className="mb-1 h-5 w-5" />
          <p className="text-xs">暂无豆瓣数据</p>
        </div>
      ) : (
        <>
          {/* Tab switcher */}
          <div className="mb-3 flex gap-1 rounded-lg bg-wechat-bubble p-1 dark:bg-white/5">
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
                  onClick={() => setActiveTab(tab.key)}
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

          {/* Items list */}
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
          ) : (
            <ul className="space-y-1">
              {items?.slice(0, 8).map((item, i) => (
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
                      {item.rating > 0 && (
                        <div className="mt-0.5">
                          <RatingStars rating={item.rating} />
                        </div>
                      )}
                      {item.date && (
                        <p className="mt-0.5 whitespace-nowrap text-[11px] text-wechat-time/70">
                          {formatDate(item.date)}
                        </p>
                      )}
                    </div>
                    <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-wechat-time transition-colors group-hover:text-wechat-text" />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
