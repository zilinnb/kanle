"use client";

import { useState } from "react";
import Image from "next/image";
import { Play, Music2, Link as LinkIcon, ChevronRight, ChevronDown } from "lucide-react";
import type { Post, PostImage } from "@/lib/mock-data";
import { getImageSrc, normalizeImages } from "@/lib/post-image";
import { toAbsoluteUrl, toHttps } from "@/lib/upload";
import ImageViewer from "@/components/ImageViewer";
import VideoPlayerModal from "@/components/VideoPlayerModal";

interface ProfilePinnedStripProps {
  posts: Post[];
}

const VISIBLE_COUNT = 3;

type TileKind = "image" | "video" | "music" | "link" | "text";

interface TileInfo {
  kind: TileKind;
  cover: string;
  fallbackText: string;
  post: Post;
}

function resolveCover(url: string | undefined | null): string {
  if (!url) return "";
  return toHttps(toAbsoluteUrl(url));
}

function buildTile(post: Post): TileInfo {
  const contentText = (post.content || "").replace(/<[^>]*>/g, "").trim();

  if (post.images && post.images.length > 0) {
    return {
      kind: "image",
      cover: resolveCover(getImageSrc(post.images[0])),
      fallbackText: contentText,
      post,
    };
  }
  if (post.video) {
    return { kind: "video", cover: resolveCover(post.video.cover), fallbackText: contentText, post };
  }
  if (post.music) {
    return { kind: "music", cover: resolveCover(post.music.cover), fallbackText: post.music.name || contentText, post };
  }
  if (post.linkCard) {
    return { kind: "link", cover: resolveCover(post.linkCard.image), fallbackText: post.linkCard.title || contentText, post };
  }
  return { kind: "text", cover: "", fallbackText: contentText || "动态", post };
}

// 渐显缩略图：与首页 ImageGrid 中的 FadeImage 相同的渐显效果
function FadeThumb({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <Image
      src={src}
      alt={alt}
      fill
      onLoad={() => setLoaded(true)}
      style={{ transition: "transform 300ms, opacity 500ms" }}
      className={`object-cover group-hover:scale-105 ${
        loaded ? "opacity-100" : "opacity-0"
      }`}
      sizes="80px"
      unoptimized
    />
  );
}

export default function ProfilePinnedStrip({ posts }: ProfilePinnedStripProps) {
  const pinned = posts.filter((p) => p.pinned);
  const [expanded, setExpanded] = useState(false);
  const [viewer, setViewer] = useState<{ images: PostImage[]; index: number; rect: DOMRect | null } | null>(null);
  const [videoPost, setVideoPost] = useState<Post | null>(null);

  if (pinned.length === 0) return null;

  const tiles = pinned.map(buildTile);
  const visibleTiles = expanded ? tiles : tiles.slice(0, VISIBLE_COUNT);
  const hasMore = tiles.length > VISIBLE_COUNT;

  const openImage = (post: Post, el: HTMLElement) => {
    if (!post.images || post.images.length === 0) return;
    const rect = el.getBoundingClientRect();
    setViewer({ images: normalizeImages(post.images), index: 0, rect });
  };

  const openVideo = (post: Post) => {
    if (!post.video) return;
    setVideoPost(post);
  };

  return (
    <section className="px-4 py-2 sm:px-5 md:px-6">
      <div className="mb-2 flex items-center gap-1.5">
        <span className="text-[12px] font-medium text-wechat-time">置顶</span>
      </div>

      <div className={`flex flex-wrap gap-2 ${expanded ? "" : "overflow-hidden"}`}>
        {visibleTiles.map((tile) => (
          <PinnedTile
            key={tile.post.id}
            tile={tile}
            onOpenImage={(el) => openImage(tile.post, el)}
            onOpenVideo={() => openVideo(tile.post)}
          />
        ))}

        {hasMore && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="group relative aspect-square w-[72px] shrink-0 overflow-hidden rounded bg-wechat-bubble transition-colors hover:bg-wechat-hover dark:bg-white/5 dark:hover:bg-white/10 sm:w-[80px]"
            aria-label={expanded ? "收起置顶" : "展开更多置顶"}
          >
            <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-wechat-time">
              {expanded ? (
                <ChevronDown className="h-5 w-5 transition-transform group-hover:translate-y-0.5" />
              ) : (
                <>
                  <ChevronRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
                  <span className="text-[11px]">更多</span>
                </>
              )}
            </div>
          </button>
        )}
      </div>

      {viewer && (
        <ImageViewer
          images={viewer.images}
          initialIndex={viewer.index}
          originRect={viewer.rect}
          onClose={() => setViewer(null)}
        />
      )}

      {videoPost?.video && (
        <VideoPlayerModal
          video={videoPost.video}
          postId={videoPost.id}
          onClose={() => setVideoPost(null)}
        />
      )}
    </section>
  );
}

interface PinnedTileProps {
  tile: TileInfo;
  onOpenImage: (el: HTMLElement) => void;
  onOpenVideo: () => void;
}

function PinnedTile({ tile, onOpenImage, onOpenVideo }: PinnedTileProps) {
  const { kind, cover, fallbackText, post } = tile;

  const handleClick = (e: React.MouseEvent<HTMLElement>) => {
    if (kind === "video") {
      onOpenVideo();
    } else if (kind === "image") {
      onOpenImage(e.currentTarget);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="group relative aspect-square w-[72px] shrink-0 overflow-hidden rounded bg-wechat-bubble dark:bg-white/5 sm:w-[80px]"
    >
      {/* Cover */}
      {cover ? (
        <FadeThumb src={cover} alt="" />
      ) : kind === "text" ? (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 p-1.5 dark:from-white/5 dark:to-white/10">
          <span className="line-clamp-4 text-center text-[10px] leading-tight text-wechat-time">
            {fallbackText}
          </span>
        </div>
      ) : kind === "video" ? (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-gray-700 to-gray-900">
          <Play className="h-6 w-6 text-white/70" fill="currentColor" />
        </div>
      ) : kind === "music" ? (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-rose-50 to-purple-100 dark:from-rose-900/20 dark:to-purple-900/20">
          <Music2 className="h-6 w-6 text-rose-400/80" />
        </div>
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-sky-50 to-blue-100 dark:from-sky-900/20 dark:to-blue-900/20">
          <LinkIcon className="h-6 w-6 text-sky-400/80" />
        </div>
      )}

      {/* Type badge for music/link (video uses center play overlay) */}
      {cover && (kind === "music" || kind === "link") && (
        <div className="absolute left-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-black/50 text-white">
          {kind === "music" && <Music2 className="h-2 w-2" />}
          {kind === "link" && <LinkIcon className="h-2 w-2" />}
        </div>
      )}

      {/* Video play overlay */}
      {kind === "video" && cover && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-black/45 text-white">
            <Play className="h-3.5 w-3.5 fill-current" />
          </div>
        </div>
      )}

      {/* Bottom text label for music/link tiles with cover */}
      {cover && (kind === "music" || kind === "link") && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 py-1">
          <span className="line-clamp-1 text-[10px] text-white">{fallbackText}</span>
        </div>
      )}
    </button>
  );
}
