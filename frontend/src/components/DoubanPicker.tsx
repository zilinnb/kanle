"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { Film, Book, Music, Search, Star, X } from "lucide-react";
import type { PostDouban } from "@/lib/mock-data";
import { getApiUrl } from "@/lib/api-fetch";
import { toAbsoluteUrl } from "@/lib/upload";
import { useExitAnimation } from "@/lib/use-exit-animation";

interface DoubanPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (item: PostDouban) => void;
}

interface DoubanItem {
  title: string;
  cover: string;
  link: string;
  rating: number;
  intro: string;
  status: string;
  statusLabel: string;
}

interface DoubanData {
  movies: DoubanItem[];
  books: DoubanItem[];
  music: DoubanItem[];
}

type Tab = "movie" | "book" | "music";

const TABS: { key: Tab; label: string; icon: typeof Film }[] = [
  { key: "movie", label: "电影", icon: Film },
  { key: "book", label: "图书", icon: Book },
  { key: "music", label: "音乐", icon: Music },
];

const STATUS_STYLES: Record<string, string> = {
  collect: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
  do: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  wish: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
};

export default function DoubanPicker({ open, onClose, onSelect }: DoubanPickerProps) {
  const [data, setData] = useState<DoubanData | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("movie");
  const [search, setSearch] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const { closing, handleClose } = useExitAnimation(onClose, 200);

  const API_URL = getApiUrl();

  useEffect(() => {
    if (!open) return;
    setLoading(true);
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
  }, [open, API_URL]);

  const allItems = useMemo(() => {
    if (!data) return [];
    return activeTab === "movie" ? data.movies : activeTab === "book" ? data.books : data.music;
  }, [data, activeTab]);

  const filteredItems = useMemo(() => {
    if (!search.trim()) return allItems;
    const q = search.toLowerCase();
    return allItems.filter((item) => item.title.toLowerCase().includes(q));
  }, [allItems, search]);

  const handleSelect = (item: DoubanItem) => {
    onSelect({
      title: item.title.split("\n")[0].split("/")[0].trim(),
      cover: item.cover,
      link: item.link,
      rating: item.rating,
      intro: item.intro,
      status: item.status,
      statusLabel: item.statusLabel,
    });
    handleClose();
  };

  return (
    <div
      className={`fixed inset-0 z-[200] flex items-center justify-center bg-black/50 ${closing ? "animate-overlay-out" : "animate-overlay-in"}`}
      onClick={handleClose}
    >
      <div
        className={`flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white dark:bg-[#1a1a1f] ${closing ? "animate-modal-out" : "animate-modal-in"}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-black/5 px-5 py-4 dark:border-white/5">
          <h3 className="text-base font-semibold text-black dark:text-white">选择豆瓣条目</h3>
          <button
            onClick={handleClose}
            className="rounded-full p-1 text-black/40 hover:bg-black/5 hover:text-black/60 dark:text-white/40 dark:hover:bg-white/5 dark:hover:text-white/60"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-black/5 px-3 py-2 dark:border-white/5">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const count =
              tab.key === "movie"
                ? data?.movies.length
                : tab.key === "book"
                ? data?.books.length
                : data?.music.length;
            if (count === 0) return null;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? "bg-black/5 text-black dark:bg-white/10 dark:text-white"
                    : "text-black/40 hover:text-black/60 dark:text-white/40 dark:hover:text-white/60"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
                {count ? <span className="text-xs opacity-50">{count}</span> : null}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="border-b border-black/5 px-5 py-3 dark:border-white/5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/30 dark:text-white/30" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索标题..."
              className="w-full rounded-xl border border-black/10 bg-black/[0.02] py-2.5 pl-10 pr-3 text-sm text-black placeholder:text-black/30 focus:border-black/20 focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white dark:placeholder:text-white/30 dark:focus:border-white/20"
            />
          </div>
        </div>

        {/* List */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl p-2">
                  <div className="h-14 w-10 shrink-0 animate-pulse rounded bg-black/5 dark:bg-white/5" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-3/4 animate-pulse rounded bg-black/5 dark:bg-white/5" />
                    <div className="h-2.5 w-1/2 animate-pulse rounded bg-black/5 dark:bg-white/5" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-black/30 dark:text-white/30">
              <Film className="mb-2 h-8 w-8" />
              <p className="text-sm">暂无数据</p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredItems.map((item, i) => (
                <button
                  key={i}
                  onClick={() => handleSelect(item)}
                  className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={toAbsoluteUrl(item.cover)}
                    alt=""
                    loading="lazy"
                    className="h-14 w-10 shrink-0 rounded object-cover bg-black/5 dark:bg-white/5"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-sm font-medium text-black dark:text-white">
                      {item.title.split("\n")[0].split("/")[0].trim()}
                    </p>
                    <div className="mt-0.5 flex items-center gap-1.5">
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
                      {item.statusLabel && (
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS_STYLES[item.status] || ""}`}
                        >
                          {item.statusLabel}
                        </span>
                      )}
                    </div>
                    {item.intro && (
                      <p className="mt-0.5 line-clamp-1 text-xs text-black/40 dark:text-white/40">
                        {item.intro}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
