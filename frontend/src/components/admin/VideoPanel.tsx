"use client";

import { useEffect, useState, useRef } from "react";
import { Loader2, X, Video, Upload, Link2, Code2, Play } from "lucide-react";
import type { PostVideo } from "@/lib/mock-data";
import { toAbsoluteUrl } from "@/lib/upload";
import AdminModal from "./AdminModal";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

interface VideoPanelProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (video: PostVideo) => void;
  initial?: PostVideo | null;
  token: string;
}

type Tab = "parse" | "upload" | "url" | "embed";

const TAB_LABELS: Record<Tab, string> = {
  parse: "解析链接",
  upload: "上传文件",
  url: "视频直链",
  embed: "B站嵌入",
};

const TAB_ICONS: Record<Tab, React.ReactNode> = {
  parse: <Link2 className="h-3.5 w-3.5" />,
  upload: <Upload className="h-3.5 w-3.5" />,
  url: <Play className="h-3.5 w-3.5" />,
  embed: <Code2 className="h-3.5 w-3.5" />,
};

export default function VideoPanel({
  open,
  onClose,
  onConfirm,
  initial,
  token,
}: VideoPanelProps) {
  const [tab, setTab] = useState<Tab>("parse");
  const [parseUrl, setParseUrl] = useState("");
  const [parsing, setParsing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [directUrl, setDirectUrl] = useState("");
  const [directCover, setDirectCover] = useState("");
  const [embedCode, setEmbedCode] = useState("");
  const [result, setResult] = useState<PostVideo | null>(null);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      if (initial) {
        setResult(initial);
        setEmbedCode(initial.embedCode ?? "");
        setDirectUrl(initial.source === "url" ? (initial.url ?? "") : "");
        setDirectCover(initial.cover ?? "");
      } else {
        resetAll();
      }
      setError("");
    }
  }, [open, initial]);

  const resetAll = () => {
    setParseUrl("");
    setDirectUrl("");
    setDirectCover("");
    setEmbedCode("");
    setResult(null);
    setError("");
  };

  const handleParse = async (overrideUrl?: string) => {
    const input = overrideUrl || parseUrl.trim();
    if (!input) return;
    setParsing(true);
    setError("");
    try {
      const urlMatch = input.match(/https?:\/\/[^\s，。！]+/i);
      const url = urlMatch ? urlMatch[0] : input;
      const res = await fetch(`${API_URL}/video/parse`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ url }),
      });
      if (res.ok) {
        const data = await res.json();
        setResult({ ...data, source: "parse" });
      } else {
        const err = await res.json().catch(() => ({ message: "解析失败" }));
        setError(err.message || "解析失败");
      }
    } catch {
      setError("网络错误，解析失败");
    } finally {
      setParsing(false);
    }
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("video", file);
      const res = await fetch(`${API_URL}/upload/video`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        setResult({ url: data.url, source: "upload", platform: "upload" });
      } else {
        const err = await res.json().catch(() => ({ message: "上传失败" }));
        setError(err.message || "上传失败");
      }
    } catch {
      setError("网络错误，上传失败");
    } finally {
      setUploading(false);
    }
  };

  const handleUseDirect = () => {
    if (!directUrl.trim()) return;
    setResult({
      url: directUrl.trim(),
      cover: directCover.trim() || undefined,
      source: "url",
      platform: "url",
    });
  };

  const handleUseEmbed = () => {
    if (!embedCode.trim()) return;
    setResult({
      embedCode: embedCode.trim(),
      source: "embed",
      platform: "bilibili",
    });
  };

  const handleConfirm = () => {
    if (result) onConfirm(result);
  };

  return (
    <AdminModal
      open={open}
      onClose={onClose}
      title="插入视频"
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
            disabled={!result}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:opacity-40 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
          >
            确认
          </button>
        </>
      }
    >
      {/* Tabs */}
      <div className="mb-4 flex gap-1 border-b border-adm-border pb-2">
        {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs transition-colors ${
              tab === t
                ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                : "text-adm-text-secondary hover:bg-adm-card-hover"
            }`}
          >
            {TAB_ICONS[t]}
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Body content */}
      <div>
        {error && (
          <p className="mb-3 text-xs text-red-500">{error}</p>
        )}

          {/* Parse */}
          {tab === "parse" && !result && (
            <div className="flex gap-2">
              <input
                type="text"
                value={parseUrl}
                onChange={(e) => setParseUrl(e.target.value)}
                onPaste={(e) => {
                  const text = e.clipboardData.getData("text");
                  const urlMatch = text.match(/https?:\/\/[^\s，。！]+/i);
                  if (urlMatch && urlMatch[0] !== text.trim()) {
                    e.preventDefault();
                    setParseUrl(urlMatch[0]);
                    handleParse(urlMatch[0]);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !parsing) handleParse();
                }}
                placeholder="粘贴抖音/快手/小红书/微博链接或分享文本"
                className="flex-1 rounded-lg border border-adm-border bg-adm-input px-3 py-2 text-sm text-adm-text placeholder:text-adm-text-tertiary focus:border-gray-400 focus:outline-none dark:focus:border-gray-500"
              />
              <button
                type="button"
                onClick={() => handleParse()}
                disabled={!parseUrl.trim() || parsing}
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:opacity-40 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
              >
                {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : "解析"}
              </button>
            </div>
          )}

          {/* Upload */}
          {tab === "upload" && !result && (
            <div className="space-y-2">
              <label className="flex h-28 cursor-pointer items-center justify-center rounded-lg border border-dashed border-adm-border bg-adm-input transition-colors hover:bg-adm-card-hover">
                <input
                  ref={fileRef}
                  type="file"
                  accept="video/mp4,video/quicktime,video/webm"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUpload(f);
                    e.target.value = "";
                  }}
                />
                {uploading ? (
                  <div className="flex items-center gap-2 text-xs text-adm-text-tertiary">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    上传中...
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1 text-xs text-adm-text-tertiary">
                    <Upload className="h-6 w-6" />
                    点击上传视频（MP4/MOV/WEBM，≤50MB）
                  </div>
                )}
              </label>
            </div>
          )}

          {/* URL */}
          {tab === "url" && !result && (
            <div className="space-y-2">
              <input
                type="text"
                value={directUrl}
                onChange={(e) => setDirectUrl(e.target.value)}
                placeholder="视频直链地址（https://...）"
                className="w-full rounded-lg border border-adm-border bg-adm-input px-3 py-2 text-sm text-adm-text placeholder:text-adm-text-tertiary focus:border-gray-400 focus:outline-none dark:focus:border-gray-500"
              />
              <input
                type="text"
                value={directCover}
                onChange={(e) => setDirectCover(e.target.value)}
                placeholder="封面地址（可选）"
                className="w-full rounded-lg border border-adm-border bg-adm-input px-3 py-2 text-sm text-adm-text placeholder:text-adm-text-tertiary focus:border-gray-400 focus:outline-none dark:focus:border-gray-500"
              />
              <button
                type="button"
                onClick={handleUseDirect}
                disabled={!directUrl.trim()}
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:opacity-40 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
              >
                使用
              </button>
            </div>
          )}

          {/* Embed */}
          {tab === "embed" && !result && (
            <div className="space-y-2">
              <textarea
                value={embedCode}
                onChange={(e) => setEmbedCode(e.target.value)}
                placeholder={'粘贴 B 站嵌入代码，例如：<iframe src="//player.bilibili.com/...">'}
                rows={3}
                className="w-full resize-none rounded-lg border border-adm-border bg-adm-input px-3 py-2 text-sm text-adm-text placeholder:text-adm-text-tertiary focus:border-gray-400 focus:outline-none dark:focus:border-gray-500"
              />
              <button
                type="button"
                onClick={handleUseEmbed}
                disabled={!embedCode.trim()}
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:opacity-40 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
              >
                使用
              </button>
            </div>
          )}

          {/* Preview */}
          {result && (
            <div className="space-y-3">
              <div className="relative flex items-center gap-3 rounded-lg border border-adm-border bg-adm-bg p-3">
                <div className="h-14 w-20 shrink-0 overflow-hidden rounded bg-adm-input">
                  {result.cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={toAbsoluteUrl(result.cover)}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Video className="h-5 w-5 text-adm-text-tertiary" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  {result.title && (
                    <p className="truncate text-sm font-medium text-adm-text">
                      {result.title}
                    </p>
                  )}
                  {result.author && (
                    <p className="truncate text-xs text-adm-text-tertiary">
                      {result.author}
                    </p>
                  )}
                  {result.platform && (
                    <span className="mt-1 inline-block rounded bg-adm-input px-1.5 py-0.5 text-[10px] text-adm-text-tertiary">
                      {result.platform}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={resetAll}
                className="text-xs text-adm-text-tertiary transition-colors hover:text-adm-text"
              >
                ← 重新选择
              </button>
            </div>
          )}
      </div>
    </AdminModal>
  );
}
