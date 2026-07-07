"use client";

import { useEffect, useState } from "react";
import { Loader2, Link2 } from "lucide-react";
import type { LinkCard } from "@/lib/mock-data";
import { toAbsoluteUrl } from "@/lib/upload";
import AdminModal from "./AdminModal";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

interface LinkCardPanelProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (card: LinkCard) => void;
  initial?: LinkCard | null;
  token: string;
}

export default function LinkCardPanel({
  open,
  onClose,
  onConfirm,
  initial,
  token,
}: LinkCardPanelProps) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<LinkCard | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open && initial) {
      setUrl(initial.url || "");
      setPreview(initial);
    } else if (open) {
      setUrl("");
      setPreview(null);
    }
    setError("");
  }, [open, initial]);

  const handleFetch = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setLoading(true);
    setError("");
    setPreview(null);
    try {
      const res = await fetch(
        `${API_URL}/url-preview?url=${encodeURIComponent(trimmed)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setPreview(data);
      } else {
        const err = await res.json().catch(() => ({ message: "获取链接信息失败" }));
        setError(err.message || "获取链接信息失败");
      }
    } catch {
      setError("网络错误，获取链接信息失败");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (preview) {
      onConfirm(preview);
    }
  };

  return (
    <AdminModal
      open={open}
      onClose={onClose}
      title="插入链接卡片"
      width="sm"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-adm-border px-4 py-2 text-sm text-adm-text-secondary transition-colors hover:bg-adm-card-hover"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!preview}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:opacity-40 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
          >
            确认
          </button>
        </>
      }
    >
      <div className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !loading) handleFetch();
          }}
          placeholder="https://example.com"
          className="flex-1 rounded-lg border border-adm-border bg-adm-input px-3 py-2 text-sm text-adm-text placeholder:text-adm-text-tertiary focus:border-gray-400 focus:outline-none dark:focus:border-gray-500"
        />
        <button
          type="button"
          onClick={handleFetch}
          disabled={loading || !url.trim()}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:opacity-40 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "获取"}
        </button>
      </div>

      {error && (
        <p className="mt-2 text-xs text-red-500">{error}</p>
      )}

      {preview && (
        <div className="mt-4 rounded-lg border border-adm-border bg-adm-bg p-3">
          <div className="flex gap-3">
            {preview.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={toAbsoluteUrl(preview.image)}
                alt=""
                className="h-16 w-16 shrink-0 rounded-lg object-cover"
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-adm-text">
                {preview.title || preview.url}
              </p>
              {preview.description && (
                <p className="mt-1 line-clamp-2 text-xs text-adm-text-tertiary">
                  {preview.description}
                </p>
              )}
              <p className="mt-1 truncate text-[11px] text-adm-text-tertiary">
                {preview.siteName || preview.url}
              </p>
            </div>
          </div>
        </div>
      )}

      {!preview && !loading && !error && (
        <div className="mt-4 flex flex-col items-center justify-center py-8 text-adm-text-tertiary">
          <Link2 className="h-8 w-8 mb-2 opacity-40" />
          <p className="text-xs">输入链接后点击"获取"预览</p>
        </div>
      )}
    </AdminModal>
  );
}
