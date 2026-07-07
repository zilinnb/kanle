"use client";

import { Music, Video, X, Pencil } from "lucide-react";
import type { PostMusic, PostVideo } from "@/lib/mock-data";
import { toAbsoluteUrl } from "@/lib/upload";

interface CardPreviewProps {
  music: PostMusic | null;
  video: PostVideo | null;
  onRemoveMusic: () => void;
  onRemoveVideo: () => void;
  onEditMusic: () => void;
  onEditVideo: () => void;
}

export default function CardPreview({
  music,
  video,
  onRemoveMusic,
  onRemoveVideo,
  onEditMusic,
  onEditVideo,
}: CardPreviewProps) {
  const isEmpty = !music && !video;

  return (
    <div className="rounded-xl border border-adm-border bg-adm-card p-4">
      <label className="mb-3 block text-xs font-medium text-adm-text-secondary">
        附加卡片
      </label>
      {isEmpty ? (
        <p className="text-xs text-adm-text-tertiary">
          通过工具栏插入音乐或视频
        </p>
      ) : (
        <div className="space-y-3">
          {music && (
            <PreviewItem
              icon={<Music className="h-3.5 w-3.5" />}
              onRemove={onRemoveMusic}
              onEdit={onEditMusic}
            >
              <div className="flex gap-2">
                {music.cover && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={toAbsoluteUrl(music.cover)}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-adm-text">
                    {music.name || "未知歌曲"}
                  </p>
                  <p className="truncate text-[11px] text-adm-text-tertiary">
                    {music.artist || "未知艺术家"}
                  </p>
                </div>
              </div>
            </PreviewItem>
          )}

          {video && (
            <PreviewItem
              icon={<Video className="h-3.5 w-3.5" />}
              onRemove={onRemoveVideo}
              onEdit={onEditVideo}
            >
              <div className="flex gap-2">
                {video.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={toAbsoluteUrl(video.cover)}
                    alt=""
                    className="h-12 w-16 shrink-0 rounded object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-16 shrink-0 items-center justify-center rounded bg-adm-input">
                    <Video className="h-4 w-4 text-adm-text-tertiary" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-adm-text">
                    {video.title || "视频"}
                  </p>
                  {video.platform && (
                    <span className="mt-0.5 inline-block rounded bg-adm-input px-1 py-0.5 text-[10px] text-adm-text-tertiary">
                      {video.platform}
                    </span>
                  )}
                </div>
              </div>
            </PreviewItem>
          )}
        </div>
      )}
    </div>
  );
}

function PreviewItem({
  icon,
  children,
  onRemove,
  onEdit,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  onRemove: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="group relative rounded-lg border border-adm-border bg-adm-bg p-2">
      <div className="mb-1.5 flex items-center gap-1 text-adm-text-tertiary">
        {icon}
      </div>
      {children}
      <div className="absolute right-1 top-1 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={onEdit}
          className="rounded p-1 text-adm-text-tertiary transition-colors hover:bg-adm-card-hover hover:text-adm-text"
          title="编辑"
        >
          <Pencil className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="rounded p-1 text-adm-text-tertiary transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
          title="移除"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
