"use client";

import { useState, useCallback } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { Play, Video as VideoIcon, Pencil, Trash2 } from "lucide-react";
import type { PostVideo } from "@/lib/mock-data";
import { toAbsoluteUrl } from "@/lib/upload";
import { decodePayload, encodePayload } from "../embed-utils";
import { useEditorContext } from "../editor-context";
import VideoPanel from "@/components/admin/VideoPanel";

const PLATFORM_LABELS: Record<string, string> = {
  douyin: "抖音",
  kuaishou: "快手",
  xhs: "小红书",
  weibo: "微博",
  bilibili: "B站",
  upload: "上传",
  url: "直链",
};

/** 增强 B 站 iframe src */
function enhanceBilibiliSrc(rawSrc: string): string {
  const safeSrc = rawSrc.startsWith("//") ? `https:${rawSrc}` : rawSrc;
  try {
    const url = new URL(safeSrc);
    if (!url.searchParams.has("high_quality")) url.searchParams.set("high_quality", "1");
    if (!url.searchParams.has("danmaku")) url.searchParams.set("danmaku", "0");
    if (!url.searchParams.has("autoplay")) url.searchParams.set("autoplay", "0");
    return url.toString();
  } catch {
    return safeSrc;
  }
}

export default function VideoEmbedNodeView({
  node,
  deleteNode,
  updateAttributes,
  selected,
}: NodeViewProps) {
  const { token } = useEditorContext();
  const [showPanel, setShowPanel] = useState(false);
  const video = decodePayload<PostVideo>(node.attrs.payload);

  const handleEdit = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowPanel(true);
  }, []);

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    deleteNode();
  }, [deleteNode]);

  const handleConfirm = useCallback(
    (newVideo: PostVideo) => {
      updateAttributes({ payload: encodePayload(newVideo) });
      setShowPanel(false);
    },
    [updateAttributes]
  );

  if (!video) return null;

  const stopInteraction = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  // ── B站嵌入：iframe 预览 ──
  const renderBilibili = () => {
    if (!video.embedCode) return null;
    const srcMatch = video.embedCode.match(/src=["']([^"']+)["']/i);
    const src = srcMatch?.[1] || "";
    if (!src) return null;
    const enhancedSrc = enhanceBilibiliSrc(src);

    return (
      <div className="w-full max-w-[500px]">
        <div
          className="relative w-full overflow-hidden rounded-lg bg-black"
          style={{ paddingBottom: "56.25%" }}
        >
          <iframe
            src={enhancedSrc}
            frameBorder="0"
            className="absolute inset-0 h-full w-full pointer-events-none"
            allow="fullscreen; encrypted-media; picture-in-picture"
          />
        </div>
        {(video.title || video.author) && (
          <div className="mt-1.5 flex items-center gap-1.5 text-[12px] text-gray-500 dark:text-gray-400">
            <span className="rounded bg-gray-100 px-1 py-0.5 text-[10px] dark:bg-white/10">
              B站
            </span>
            {video.title && <span className="truncate">{video.title}</span>}
            {video.author && <span className="shrink-0">· {video.author}</span>}
          </div>
        )}
      </div>
    );
  };

  // ── 解析视频：封面 + 播放图标（静态预览）──
  const renderParse = () => {
    const cover = video.cover ? toAbsoluteUrl(video.cover) : undefined;
    return (
      <div className="w-full max-w-[360px]">
        <div
          className="relative w-full overflow-hidden rounded-lg bg-black select-none"
          style={{ aspectRatio: "16 / 9" }}
        >
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt={video.title || "视频封面"} className="w-full h-full object-cover pointer-events-none" />
          ) : (
            <div className="flex items-center justify-center bg-black/80 h-full">
              <VideoIcon className="h-8 w-8 text-white/50" />
            </div>
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/10">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm ring-1 ring-white/20">
              <Play className="h-5 w-5 fill-white text-white ml-0.5" />
            </div>
          </div>
        </div>
        {/* 信息条 */}
        {(video.title || video.author || video.platform) && (
          <div className="mt-1.5 flex items-center gap-1.5 text-[12px] text-gray-500 dark:text-gray-400">
            {video.avatar && (
              <img src={toAbsoluteUrl(video.avatar)} alt="" className="h-4 w-4 shrink-0 rounded-full object-cover" />
            )}
            {video.platform && (
              <span className="shrink-0 rounded bg-gray-100 px-1 py-0.5 text-[10px] dark:bg-white/10">
                {PLATFORM_LABELS[video.platform] || video.platform}
              </span>
            )}
            {video.title && <span className="truncate">{video.title}</span>}
            {video.author && <span className="shrink-0">· {video.author}</span>}
          </div>
        )}
      </div>
    );
  };

  // ── 上传/直链：video 元素预览 ──
  const renderInline = () => {
    const url = video.url ? toAbsoluteUrl(video.url) : "";
    const cover = video.cover ? toAbsoluteUrl(video.cover) : undefined;
    if (!url) return null;

    return (
      <div className="w-full max-w-[360px]">
        <div className="overflow-hidden rounded-lg bg-black" style={{ aspectRatio: "16 / 9" }}>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            src={url}
            poster={cover}
            className="h-full w-full object-contain pointer-events-none"
            controls={false}
            preload="metadata"
          />
        </div>
        {(video.title || video.author || video.platform) && (
          <div className="mt-1.5 flex items-center gap-1.5 text-[12px] text-gray-500 dark:text-gray-400">
            {video.platform && (
              <span className="shrink-0 rounded bg-gray-100 px-1 py-0.5 text-[10px] dark:bg-white/10">
                {PLATFORM_LABELS[video.platform] || video.platform}
              </span>
            )}
            {video.title && <span className="truncate">{video.title}</span>}
          </div>
        )}
      </div>
    );
  };

  return (
    <NodeViewWrapper
      as="div"
      className={`embed-node-wrapper relative ${selected ? "is-selected" : ""}`}
    >
      {/* 编辑/删除按钮（右上角） */}
      <div
        className="absolute right-2 top-2 z-10 flex gap-1 opacity-70 transition-opacity hover:opacity-100"
        contentEditable={false}
        onMouseDown={stopInteraction}
      >
        <button
          type="button"
          onClick={handleEdit}
          title="编辑视频"
          className="flex h-7 w-7 items-center justify-center rounded-md bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-black/80"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={handleDelete}
          title="删除视频"
          className="flex h-7 w-7 items-center justify-center rounded-md bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-red-500"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* 视频预览 */}
      <div data-drag-handle onMouseDown={stopInteraction}>
        {video.embedCode && renderBilibili()}
        {!video.embedCode && video.source === "parse" && renderParse()}
        {!video.embedCode && (video.source === "upload" || video.source === "url") && renderInline()}
        {!video.embedCode && !video.source && renderParse()}
      </div>

      {/* 编辑面板 */}
      {showPanel && (
        <VideoPanel
          open={showPanel}
          onClose={() => setShowPanel(false)}
          onConfirm={handleConfirm}
          initial={video}
          token={token}
        />
      )}
    </NodeViewWrapper>
  );
}
