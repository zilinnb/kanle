"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Upload,
  Trash2,
  Copy,
  Check,
  ImageIcon,
  Video,
  Music,
  FileText,
  X,
  Cloud,
  HardDrive,
  Loader2,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { apiFetch, getApiUrl, getToken } from "@/lib/api-fetch";
import { toAbsoluteUrl } from "@/lib/upload";
import { useExitAnimation } from "@/lib/use-exit-animation";

interface MediaItem {
  id: string;
  filename: string;
  url: string;
  storageType: "upyun" | "local";
  mimeType: string;
  size: number;
  category: "image" | "video" | "audio" | "file";
  uploaderId: string;
  uploaderName: string;
  /** 实况图配对视频 URL（仅 image 类型可能非空） */
  livePhotoVideo: string | null;
  /** 实况图配对图片 URL（仅 video 类型可能非空；列表已过滤，前端一般拿不到） */
  livePhotoImage: string | null;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

type CategoryFilter = "all" | "image" | "video" | "audio" | "file";

const CATEGORY_TABS: { value: CategoryFilter; label: string; icon: typeof ImageIcon }[] = [
  { value: "all", label: "全部", icon: FileText },
  { value: "image", label: "图片", icon: ImageIcon },
  { value: "video", label: "视频", icon: Video },
  { value: "audio", label: "音频", icon: Music },
  { value: "file", label: "文件", icon: FileText },
];

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getMediaIcon(category: string) {
  switch (category) {
    case "image": return ImageIcon;
    case "video": return Video;
    case "audio": return Music;
    default: return FileText;
  }
}

export default function AdminMedia() {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchMedia = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "24" });
      if (category !== "all") params.set("category", category);
      const res = await apiFetch(`/media?${params.toString()}`);
      const data = await res.json();
      setMedia(data.data || []);
      setPagination(data.pagination || null);
    } catch {
      setMedia([]);
    } finally {
      setLoading(false);
    }
  }, [page, category]);

  useEffect(() => {
    fetchMedia();
  }, [fetchMedia]);

  const handleUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    const API_URL = getApiUrl();
    const token = getToken();
    let successCount = 0;
    let failCount = 0;

    for (const file of Array.from(files)) {
      try {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch(`${API_URL}/media/upload`, {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: form,
        });
        if (res.ok) successCount++;
        else failCount++;
      } catch {
        failCount++;
      }
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";

    if (successCount > 0) {
      // 刷新列表
      if (page !== 1) {
        setPage(1);
      } else {
        fetchMedia();
      }
    }
  }, [page, fetchMedia]);

  const handleImport = useCallback(async () => {
    if (!confirm("将扫描服务器 /uploads/ 目录并导入所有未登记的文件，同时建立实况图配对关系。继续？")) return;
    setImporting(true);
    setImportMsg(null);
    try {
      const res = await apiFetch("/media/import", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setImportMsg(data.message || "导入完成");
        // 刷新列表
        if (page !== 1) {
          setPage(1);
        } else {
          fetchMedia();
        }
      } else {
        setImportMsg(data.message || "导入失败");
      }
    } catch (err: any) {
      setImportMsg(err.message || "导入失败");
    } finally {
      setImporting(false);
      // 5 秒后清空提示
      setTimeout(() => setImportMsg(null), 5000);
    }
  }, [page, fetchMedia]);

  const handleDelete = async (item: MediaItem) => {
    if (!confirm(`确定删除「${item.filename}」吗？此操作不可恢复。`)) return;
    setDeleting(true);
    try {
      const res = await apiFetch(`/media/${item.id}`, { method: "DELETE" });
      if (res.ok) {
        setSelected(null);
        // 如果当前页只剩一个，回到上一页
        if (media.length === 1 && page > 1) {
          setPage(page - 1);
        } else {
          fetchMedia();
        }
      }
    } catch {
      // 忽略
    } finally {
      setDeleting(false);
    }
  };

  const handleCopyUrl = (url: string) => {
    const absolute = toAbsoluteUrl(url);
    navigator.clipboard.writeText(absolute).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleCategoryChange = (cat: CategoryFilter) => {
    setCategory(cat);
    setPage(1);
  };

  return (
    <div className="p-4 sm:p-6">
      {/* 头部 */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-adm-text">媒体库</h1>
          <p className="mt-1 text-sm text-adm-text-tertiary">
            管理所有上传的图片、视频、音频和文件
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleImport}
            disabled={importing}
            className="flex items-center gap-2 rounded-lg border border-adm-border bg-adm-card px-3 py-2.5 text-sm font-medium text-adm-text-secondary transition-colors hover:bg-adm-hover disabled:opacity-50"
            title="扫描服务器 /uploads/ 目录，导入历史文件并建立实况图配对"
          >
            {importing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                导入中...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                导入历史文件
              </>
            )}
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 rounded-lg bg-adm-primary px-4 py-2.5 text-sm font-medium text-adm-primary-text transition-colors hover:opacity-90 disabled:opacity-50"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                上传中...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                上传文件
              </>
            )}
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleUpload(e.target.files)}
        />
      </div>

      {/* 导入结果提示 */}
      {importMsg && (
        <div className="mb-4 rounded-lg border border-adm-border bg-adm-input/60 px-4 py-2.5 text-sm text-adm-text-secondary">
          {importMsg}
        </div>
      )}

      {/* 类型筛选 */}
      <div className="mb-4 flex flex-wrap gap-2">
        {CATEGORY_TABS.map((tab) => {
          const Icon = tab.icon;
          const active = category === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => handleCategoryChange(tab.value)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-adm-primary text-adm-primary-text"
                  : "bg-adm-card text-adm-text-secondary border border-adm-border hover:bg-adm-hover"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 媒体网格 */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="aspect-square animate-pulse rounded-lg bg-adm-input"
            />
          ))}
        </div>
      ) : media.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-adm-text-tertiary">
          <ImageIcon className="mb-3 h-12 w-12 opacity-30" />
          <p className="text-sm">暂无媒体文件</p>
          <p className="mt-1 text-xs">点击右上角「上传文件」开始上传</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {media.map((item) => (
              <MediaCard
                key={item.id}
                item={item}
                onClick={() => setSelected(item)}
              />
            ))}
          </div>

          {/* 分页 */}
          {pagination && pagination.totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="rounded-lg border border-adm-border bg-adm-card px-3 py-1.5 text-sm text-adm-text-secondary transition-colors hover:bg-adm-hover disabled:opacity-40"
              >
                上一页
              </button>
              <span className="text-sm text-adm-text-tertiary">
                {page} / {pagination.totalPages}（共 {pagination.total} 个）
              </span>
              <button
                onClick={() => setPage(Math.min(pagination.totalPages, page + 1))}
                disabled={!pagination.hasMore}
                className="rounded-lg border border-adm-border bg-adm-card px-3 py-1.5 text-sm text-adm-text-secondary transition-colors hover:bg-adm-hover disabled:opacity-40"
              >
                下一页
              </button>
            </div>
          )}
        </>
      )}

      {/* 详情弹窗 */}
      {selected && (
        <MediaDetailModal
          item={selected}
          onClose={() => setSelected(null)}
          onCopyUrl={handleCopyUrl}
          onDelete={handleDelete}
          copied={copied}
          deleting={deleting}
        />
      )}
    </div>
  );
}

/** 媒体卡片 */
function MediaCard({ item, onClick }: { item: MediaItem; onClick: () => void }) {
  const Icon = getMediaIcon(item.category);
  const isImage = item.category === "image";
  const isVideo = item.category === "video";
  const isAudio = item.category === "audio";
  const isLivePhoto = !!item.livePhotoVideo;
  const thumbUrl = toAbsoluteUrl(item.url);

  return (
    <button
      onClick={onClick}
      className="group relative aspect-square overflow-hidden rounded-lg border border-adm-border bg-adm-card transition-colors hover:border-adm-primary"
    >
      {/* 缩略图 / 图标 */}
      {isImage ? (
        <img
          src={thumbUrl}
          alt={item.filename}
          className="h-full w-full object-cover transition-transform group-hover:scale-105"
          loading="lazy"
        />
      ) : isVideo ? (
        <div className="relative flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900">
          <video
            src={thumbUrl}
            className="h-full w-full object-cover"
            preload="metadata"
            muted
          />
          {/* 视频播放标识 */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm transition-transform group-hover:scale-110">
              <Video className="h-4 w-4 text-white" />
            </div>
          </div>
        </div>
      ) : isAudio ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-slate-800 dark:to-slate-900">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/40 dark:to-pink-900/40">
            <Music className="h-6 w-6 text-purple-500 dark:text-purple-300" />
          </div>
          <div className="flex items-end gap-0.5">
            {[3, 6, 4, 8, 5, 7, 3].map((h, i) => (
              <div
                key={i}
                className="w-0.5 rounded-full bg-purple-300 dark:bg-purple-700"
                style={{ height: `${h * 2}px` }}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900">
          <Icon className="h-8 w-8 text-adm-text-tertiary" />
        </div>
      )}

      {/* 实况图徽标 */}
      {isLivePhoto && (
        <div className="absolute left-1 top-1 flex items-center gap-0.5 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
          <Sparkles className="h-2.5 w-2.5" />
          实况
        </div>
      )}

      {/* 存储类型角标 */}
      <div className="absolute right-1 top-1 flex items-center gap-0.5 rounded-full bg-black/50 px-1.5 py-0.5 text-[10px] text-white backdrop-blur-sm">
        {item.storageType === "upyun" ? (
          <Cloud className="h-2.5 w-2.5" />
        ) : (
          <HardDrive className="h-2.5 w-2.5" />
        )}
      </div>

    </button>
  );
}

/** 详情弹窗 */
function MediaDetailModal({
  item,
  onClose,
  onCopyUrl,
  onDelete,
  copied,
  deleting,
}: {
  item: MediaItem;
  onClose: () => void;
  onCopyUrl: (url: string) => void;
  onDelete: (item: MediaItem) => void;
  copied: boolean;
  deleting: boolean;
}) {
  const Icon = getMediaIcon(item.category);
  const isImage = item.category === "image";
  const isVideo = item.category === "video";
  const isAudio = item.category === "audio";
  const isLivePhoto = !!item.livePhotoVideo;
  const fullUrl = toAbsoluteUrl(item.url);
  const liveVideoUrl = item.livePhotoVideo ? toAbsoluteUrl(item.livePhotoVideo) : null;

  const { closing, handleClose } = useExitAnimation(onClose, 200);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 ${
        closing ? "animate-overlay-out" : "animate-overlay-in"
      }`}
      onClick={handleClose}
    >
      <div
        className={`relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-adm-card shadow-2xl ${
          closing ? "animate-modal-out" : "animate-modal-in"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 关闭按钮 */}
        <button
          onClick={handleClose}
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm transition-colors hover:bg-black/50"
        >
          <X className="h-4 w-4" />
        </button>

        {/* 预览区 */}
        <div className="flex min-h-[200px] items-center justify-center bg-black/5 dark:bg-black/30">
          {isLivePhoto && liveVideoUrl ? (
            // 实况图：左右分屏显示图片和视频
            <div className="grid w-full grid-cols-1 gap-px bg-adm-border sm:grid-cols-2">
              <div className="flex flex-col bg-black/5 dark:bg-black/30">
                <div className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-medium text-adm-text-tertiary">
                  <ImageIcon className="h-3 w-3" />
                  图片
                </div>
                <div className="flex flex-1 items-center justify-center">
                  <img
                    src={fullUrl}
                    alt={item.filename}
                    className="max-h-[400px] w-full object-contain"
                  />
                </div>
              </div>
              <div className="flex flex-col bg-black/5 dark:bg-black/30">
                <div className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-medium text-adm-text-tertiary">
                  <Video className="h-3 w-3" />
                  视频
                </div>
                <div className="flex flex-1 items-center justify-center">
                  <video
                    src={liveVideoUrl}
                    controls
                    className="max-h-[400px] w-full"
                  />
                </div>
              </div>
            </div>
          ) : isImage ? (
            <img
              src={fullUrl}
              alt={item.filename}
              className="max-h-[400px] w-full object-contain"
            />
          ) : isVideo ? (
            <video
              src={fullUrl}
              controls
              className="max-h-[400px] w-full"
            />
          ) : isAudio ? (
            <div className="flex w-full flex-col items-center gap-4 p-8">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/40 dark:to-pink-900/40">
                <Music className="h-10 w-10 text-purple-500 dark:text-purple-300" />
              </div>
              <audio src={fullUrl} controls className="w-full" />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 p-12">
              <Icon className="h-16 w-16 text-adm-text-tertiary" />
              <p className="text-sm text-adm-text-tertiary">无法预览此文件类型</p>
            </div>
          )}
        </div>

        {/* 信息区 */}
        <div className="flex-1 overflow-y-auto border-t border-adm-border p-4">
          <h3 className="mb-3 text-sm font-semibold text-adm-text">
            {item.filename}
          </h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-adm-text-tertiary">文件类型</span>
              <span className="text-adm-text-secondary">{item.mimeType}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-adm-text-tertiary">文件大小</span>
              <span className="text-adm-text-secondary">{formatSize(item.size)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-adm-text-tertiary">存储位置</span>
              <span className="flex items-center gap-1 text-adm-text-secondary">
                {item.storageType === "upyun" ? (
                  <><Cloud className="h-3 w-3" /> 又拍云</>
                ) : (
                  <><HardDrive className="h-3 w-3" /> 本地</>
                )}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-adm-text-tertiary">上传者</span>
              <span className="text-adm-text-secondary">{item.uploaderName || "未知"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-adm-text-tertiary">上传时间</span>
              <span className="text-adm-text-secondary">{formatDate(item.createdAt)}</span>
            </div>
            <div className="flex items-start justify-between gap-2">
              <span className="shrink-0 text-adm-text-tertiary">URL</span>
              <span className="break-all text-adm-text-secondary">{fullUrl}</span>
            </div>
            {isLivePhoto && liveVideoUrl && (
              <div className="flex items-start justify-between gap-2">
                <span className="flex shrink-0 items-center gap-1 text-adm-text-tertiary">
                  <Sparkles className="h-3 w-3" />
                  实况视频
                </span>
                <span className="break-all text-adm-text-secondary">{liveVideoUrl}</span>
              </div>
            )}
          </div>

          {/* 操作按钮 */}
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => onCopyUrl(item.url)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-adm-border bg-adm-input px-3 py-2 text-sm font-medium text-adm-text-secondary transition-colors hover:bg-adm-hover"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-green-500" />
                  已复制
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  复制 URL
                </>
              )}
            </button>
            <button
              onClick={() => onDelete(item)}
              disabled={deleting}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400"
            >
              {deleting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              删除
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
