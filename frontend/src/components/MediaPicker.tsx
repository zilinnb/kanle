"use client";

import { useState, useEffect, useCallback } from "react";
import {
  X,
  ImageIcon,
  Video,
  Music,
  FileText,
  Loader2,
  Cloud,
  HardDrive,
  Check,
} from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";
import { getImageUrl } from "@/lib/site-settings-store";

export interface PickerMediaItem {
  id: string;
  filename: string;
  url: string;
  storageType: "upyun" | "local";
  mimeType: string;
  size: number;
  category: "image" | "video" | "audio" | "file";
  livePhotoVideo?: string | null;
  livePhotoImage?: string | null;
  createdAt: string;
}

interface MediaPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (item: PickerMediaItem) => void;
  category?: "image" | "video" | "audio";
  title?: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function CategoryIcon({ item }: { item: PickerMediaItem }) {
  if (item.category === "image" && item.livePhotoVideo) {
    return <ImageIcon className="h-4 w-4 text-green-500" />;
  }
  if (item.category === "image") return <ImageIcon className="h-4 w-4 text-blue-500" />;
  if (item.category === "video") return <Video className="h-4 w-4 text-purple-500" />;
  if (item.category === "audio") return <Music className="h-4 w-4 text-amber-500" />;
  return <FileText className="h-4 w-4 text-gray-500" />;
}

export default function MediaPicker({
  open,
  onClose,
  onSelect,
  category,
  title = "从媒体库选择",
}: MediaPickerProps) {
  const [items, setItems] = useState<PickerMediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fetchItems = useCallback(
    async (pageNum: number, replace: boolean) => {
      if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);
      try {
        const params = new URLSearchParams({
          page: String(pageNum),
          limit: "24",
        });
        if (category) params.set("category", category);
        const res = await apiFetch(`/media?${params.toString()}`);
        if (!res.ok) throw new Error("加载失败");
        const data = await res.json();
        const next: PickerMediaItem[] = data.data || [];
        setItems((prev) => (replace ? next : [...prev, ...next]));
        setHasMore(data.pagination?.hasMore || false);
        setPage(pageNum);
      } catch {
        // ignore
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [category]
  );

  useEffect(() => {
    if (open) {
      setSelectedId(null);
      fetchItems(1, true);
    }
  }, [open, fetchItems]);

  const handleSelect = (item: PickerMediaItem) => {
    setSelectedId(item.id);
    setTimeout(() => {
      onSelect(item);
      onClose();
    }, 120);
  };

  if (!open) return null;

  return (
    <div className="mt-2 animate-slide-down rounded-xl border border-adm-border bg-adm-card shadow-lg dark:shadow-black/20">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-adm-border px-4 py-2.5">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-adm-text">{title}</h3>
          <p className="text-xs text-adm-text-tertiary">
            {category ? `仅显示${category === "image" ? "图片" : category === "video" ? "视频" : "音频"}` : "全部媒体"}
          </p>
        </div>
        <button
          onClick={onClose}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-adm-text-tertiary transition-colors hover:bg-adm-card-hover hover:text-adm-text"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Grid */}
      <div className="max-h-[260px] overflow-y-auto p-3 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5">
        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-adm-text-tertiary" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex h-32 flex-col items-center justify-center gap-1.5 text-adm-text-tertiary">
            <ImageIcon className="h-8 w-8 opacity-40" />
            <p className="text-xs">媒体库暂无内容</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
            {items.map((item) => {
              const fullUrl = getImageUrl(item.url);
              const isSelected = selectedId === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  className={`group relative flex flex-col overflow-hidden rounded-lg border bg-adm-input text-left transition-all ${
                    isSelected
                      ? "border-adm-primary ring-2 ring-adm-primary/30"
                      : "border-adm-border hover:border-adm-text-tertiary"
                  }`}
                >
                  {/* Preview */}
                  <div className="relative aspect-square w-full overflow-hidden bg-adm-input">
                    {item.category === "image" ? (
                      <img
                        src={fullUrl}
                        alt={item.filename}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      />
                    ) : item.category === "video" ? (
                      <div className="flex h-full w-full items-center justify-center bg-adm-input">
                        <Video className="h-6 w-6 text-adm-text-tertiary" />
                      </div>
                    ) : item.category === "audio" ? (
                      <div className="flex h-full w-full items-center justify-center bg-adm-input">
                        <Music className="h-6 w-6 text-adm-text-tertiary" />
                      </div>
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-adm-input">
                        <FileText className="h-6 w-6 text-adm-text-tertiary" />
                      </div>
                    )}
                    {/* 选中标识 */}
                    {isSelected && (
                      <div className="absolute inset-0 flex items-center justify-center bg-adm-primary/20">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-adm-primary text-white">
                          <Check className="h-3.5 w-3.5" />
                        </div>
                      </div>
                    )}
                    {/* 实况图标识 */}
                    {item.livePhotoVideo && (
                      <span className="absolute left-1 top-1 rounded bg-black/60 px-1 py-0.5 text-[9px] font-medium text-white">
                        实况
                      </span>
                    )}
                    {/* 存储标识 */}
                    <span className="absolute right-1 top-1 flex items-center gap-0.5 rounded bg-black/60 px-1 py-0.5 text-[9px] text-white">
                      {item.storageType === "upyun" ? (
                        <Cloud className="h-2.5 w-2.5" />
                      ) : (
                        <HardDrive className="h-2.5 w-2.5" />
                      )}
                    </span>
                  </div>
                  {/* Info */}
                  <div className="flex items-center gap-1 px-1.5 py-1">
                    <CategoryIcon item={item} />
                    <span className="min-w-0 flex-1 truncate text-[10px] text-adm-text-secondary">
                      {item.filename}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer — 加载更多 */}
      {hasMore && !loading && (
        <div className="border-t border-adm-border px-4 py-2">
          <button
            onClick={() => fetchItems(page + 1, false)}
            disabled={loadingMore}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs text-adm-text-secondary transition-colors hover:bg-adm-card-hover disabled:opacity-50"
          >
            {loadingMore ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : null}
            {loadingMore ? "加载中..." : "加载更多"}
          </button>
        </div>
      )}
    </div>
  );
}
