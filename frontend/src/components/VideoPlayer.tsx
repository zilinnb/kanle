"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import { Play } from "lucide-react";
import type { PostVideo } from "@/lib/mock-data";
import { toAbsoluteUrl } from "@/lib/upload";
import { useAutoplayOnVisible } from "@/lib/use-autoplay-on-visible";
import VideoPlayerModal from "./VideoPlayerModal";
import CustomVideoPlayer from "./CustomVideoPlayer";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

const PLATFORM_LABELS: Record<string, string> = {
  douyin: "抖音",
  kuaishou: "快手",
  xhs: "小红书",
  weibo: "微博",
  bilibili: "B站",
  upload: "上传",
  url: "直链",
};

/** 格式化点赞数 */
function formatLike(n?: number): string | null {
  if (typeof n !== "number" || n <= 0) return null;
  if (n >= 10000) return (n / 10000).toFixed(1) + "万";
  return String(n);
}

/**
 * 视频信息条（平台角标 + 标题 + 作者 + 点赞）
 * 整体可点击跳转到 sourceUrl（新标签打开），无 sourceUrl 时为普通 div
 */
function VideoInfoBar({ video }: { video: PostVideo }) {
  if (!video.title && !video.author && !video.platform) return null;
  const likeText = formatLike(video.like);
  const sourceUrl = video.sourceUrl;
  const href = sourceUrl
    ? (sourceUrl.startsWith("http") ? sourceUrl : `https://${sourceUrl}`)
    : null;

  const content = (
    <>
      {video.avatar && (
        <img
          src={toAbsoluteUrl(video.avatar)}
          alt=""
          className="h-4 w-4 shrink-0 rounded-full object-cover"
        />
      )}
      {video.platform && (
        <span className="shrink-0 rounded bg-wechat-bubble px-1 py-0.5 text-[10px] dark:bg-white/10">
          {PLATFORM_LABELS[video.platform] || video.platform}
        </span>
      )}
      {video.title && <span className="truncate text-wechat-text">{video.title}</span>}
      {video.author && <span className="shrink-0">· {video.author}</span>}
      {likeText && <span className="shrink-0 text-[11px]">♡ {likeText}</span>}
    </>
  );

  if (!href) {
    return (
      <div className="mt-1.5 flex items-center gap-1.5 text-[12px] text-wechat-time">
        {content}
      </div>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title="点击查看原视频"
      onClick={(e) => e.stopPropagation()}
      className="mt-1.5 flex items-center gap-1.5 text-[12px] text-wechat-time transition-colors hover:text-wechat-text"
    >
      {content}
    </a>
  );
}

/**
 * 动态视频渲染组件
 * - B站嵌入（embedCode）→ 16:9 iframe，桌面端加宽至 500px，不自动播放
 * - 解析视频（source=parse）→ 显示封面缩略图 + 播放按钮，点击打开弹窗重新解析播放
 * - 上传/直链 → 内联播放（URL 不过期）
 *
 * 解析视频会维护 local state：Modal 重新解析拿到新数据后通过 onRefreshed 回传，
 * 更新卡片显示（头像/昵称/标题/点赞等），让数据"活起来"而非发布时的静态快照。
 * 同时博主登录时静默回写到后端 Post.video，刷新页面后仍保留最新数据。
 */
interface VideoPlayerProps {
  video: PostVideo;
  /** 动态 ID，用于解析后回写后端持久化最新视频数据 */
  postId?: string;
}

export default function VideoPlayer({ video, postId }: VideoPlayerProps) {
  const [modalOpen, setModalOpen] = useState(false);
  // local state：Modal 解析成功后更新，让卡片信息跟着刷新
  const [videoData, setVideoData] = useState<PostVideo>(video);

  // 解析成功后：更新 local state（后端 /posts/:id/refresh-video 已负责持久化 + ISR 重验证）
  const handleRefreshed = useCallback((fresh: PostVideo) => {
    setVideoData(fresh);
    // 通知 PostList 触发 router.refresh()，让页面其他位置同步最新数据
    window.dispatchEvent(new CustomEvent("post-published"));
  }, []);

  // ── B站嵌入：iframe（进入视口自动播放，离开暂停）──
  if (video.embedCode) {
    const srcMatch = video.embedCode.match(/src=["']([^"']+)["']/i);
    const src = srcMatch?.[1] || "";
    const isBilibili = /bilibili\.com|player\.bilibili/i.test(src);
    if (!isBilibili) return null;

    return <BilibiliEmbed rawSrc={src} video={video} />;
  }

  // ── 解析视频：尝试内联自动播放，URL 失效则回退到封面+弹窗 ──
  if (videoData.source === "parse") {
    return (
      <>
        <ParsedInlineVideo
          video={videoData}
          postId={postId}
          onOpenModal={() => setModalOpen(true)}
          onRefreshed={handleRefreshed}
        />
        {modalOpen && (
          <VideoPlayerModal
            video={videoData}
            postId={postId}
            onClose={() => setModalOpen(false)}
            onRefreshed={handleRefreshed}
          />
        )}
      </>
    );
  }

  // ── 上传/直链视频：内联播放（URL 不过期）──
  return <InlineVideo video={videoData} />;
}

/** 上传/直链视频的内联播放器（使用 CustomVideoPlayer 统一体验） */
function InlineVideo({ video }: { video: PostVideo }) {
  const directUrl = toAbsoluteUrl(video.url || "");
  const cover = video.cover ? toAbsoluteUrl(video.cover) : undefined;
  const containerRef = useRef<HTMLDivElement>(null);
  useAutoplayOnVisible(containerRef);

  return (
    <div ref={containerRef} className="mt-2 max-w-[300px]">
      <CustomVideoPlayer
        src={directUrl}
        poster={cover}
        autoPlay={false}
        className="rounded-lg"
      />
      <VideoInfoBar video={video} />
    </div>
  );
}

/** B 站嵌入：进入视口时加载带 autoplay=1 的 iframe，离开时暂停（重新加载 autoplay=0） */
function BilibiliEmbed({ rawSrc, video }: { rawSrc: string; video: PostVideo }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { visible } = useAutoplayOnVisible(containerRef, { threshold: 0.5 });

  // 进入视口：autoplay=1 + muted=1；离开视口：autoplay=0
  const src = useMemo(() => {
    const base = rawSrc.startsWith("//") ? `https:${rawSrc}` : rawSrc;
    try {
      const url = new URL(base);
      url.searchParams.set("high_quality", "1");
      url.searchParams.set("danmaku", "0");
      url.searchParams.set("autoplay", visible ? "1" : "0");
      url.searchParams.set("muted", visible ? "1" : "0");
      return url.toString();
    } catch {
      return base;
    }
  }, [rawSrc, visible]);

  return (
    <div ref={containerRef} className="mt-2 max-w-[340px] md:max-w-[500px]">
      <div
        className="relative w-full overflow-hidden rounded-lg bg-black"
        style={{ paddingBottom: "56.25%" }}
      >
        {visible && (
          <iframe
            src={src}
            frameBorder="0"
            className="absolute inset-0 h-full w-full"
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          />
        )}
      </div>
      {(video.title || video.author) && (
        <div className="mt-1.5 flex items-center gap-1.5 text-[12px] text-wechat-time">
          <span className="rounded bg-wechat-bubble px-1 py-0.5 text-[10px] dark:bg-white/10">
            B站
          </span>
          {video.title && <span className="truncate text-wechat-text">{video.title}</span>}
          {video.author && <span className="shrink-0">· {video.author}</span>}
        </div>
      )}
    </div>
  );
}

/**
 * 解析视频：进入视口时用已有 URL 尝试内联自动播放（静音）。
 * 如果 URL 过期加载失败，自动回退到封面缩略图 + 播放按钮，点击打开弹窗重新解析。
 */
interface ParsedInlineVideoProps {
  video: PostVideo;
  postId?: string;
  onOpenModal: () => void;
  onRefreshed: (fresh: PostVideo) => void;
}

function ParsedInlineVideo({ video, postId, onOpenModal, onRefreshed }: ParsedInlineVideoProps) {
  const directUrl = toAbsoluteUrl(video.url || "");
  const cover = video.cover ? toAbsoluteUrl(video.cover) : undefined;
  const containerRef = useRef<HTMLDivElement>(null);
  const [fallbackToThumbnail, setFallbackToThumbnail] = useState(false);
  useAutoplayOnVisible(containerRef);

  // URL 失效：回退到封面缩略图 + 播放按钮
  if (fallbackToThumbnail || !directUrl) {
    return (
      <div ref={containerRef} className="mt-2 max-w-[300px] md:max-w-[360px]">
        <button
          type="button"
          onClick={onOpenModal}
          className="relative block w-full overflow-hidden rounded-lg bg-black select-none"
          style={{ WebkitTouchCallout: "none" }}
        >
          {cover ? (
            <img
              src={cover}
              alt={video.title || "视频封面"}
              className="w-full object-cover"
              style={{ aspectRatio: "16 / 9" }}
            />
          ) : (
            <div
              className="flex items-center justify-center bg-black/80"
              style={{ aspectRatio: "16 / 9" }}
            >
              <Play className="h-8 w-8 text-white/50 md:h-10 md:w-10" />
            </div>
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/10 transition-colors hover:bg-black/20">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm ring-1 ring-white/20 md:h-14 md:w-14">
              <Play className="h-5 w-5 fill-white text-white ml-0.5 md:h-6 md:w-6" />
            </div>
          </div>
        </button>
        <VideoInfoBar video={video} />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="mt-2 max-w-[300px] md:max-w-[360px]">
      <CustomVideoPlayer
        src={directUrl}
        poster={cover}
        autoPlay={false}
        onError={() => setFallbackToThumbnail(true)}
        className="rounded-lg"
      />
      <VideoInfoBar video={video} />
    </div>
  );
}
