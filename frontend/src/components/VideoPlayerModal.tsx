"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, RefreshCw, AlertCircle } from "lucide-react";
import type { PostVideo } from "@/lib/mock-data";
import { toAbsoluteUrl } from "@/lib/upload";
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

function formatLike(n?: number): string | null {
  if (typeof n !== "number" || n <= 0) return null;
  if (n >= 10000) return (n / 10000).toFixed(1) + "万";
  return String(n);
}

interface VideoPlayerModalProps {
  video: PostVideo;
  onClose: () => void;
  /** 动态 ID，用于调用 /posts/:id/refresh-video 持久化重新解析结果 */
  postId?: string;
  /** 解析成功后回调，把最新视频数据回传给父组件（更新卡片显示） */
  onRefreshed?: (freshVideo: PostVideo) => void;
}

// 四阶段状态机：
//   fetch  — 调用 /refresh 解析中（封面模糊背景 + 中央加载动画）
//   load   — 解析完成或已有有效 URL，<video> 加载中（封面模糊背景 + 中央加载动画）
//   play   — <video> 就绪播放（CustomVideoPlayer 接管缓冲指示）
//   error  — 解析或播放失败（封面模糊背景 + 错误信息 + 重试按钮）
type Phase = "fetch" | "load" | "play" | "error";

export default function VideoPlayerModal({ video, onClose, postId, onRefreshed }: VideoPlayerModalProps) {
  const [phase, setPhase] = useState<Phase>("fetch");
  const [errorMsg, setErrorMsg] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [freshVideo, setFreshVideo] = useState<PostVideo | null>(null);
  const [closing, setClosing] = useState(false);
  // 自动重试标记：链接过期时自动重新解析一次（跳过缓存），失败再显示错误
  const autoRetriedRef = useRef(false);
  // 记录初始是否已有有效 URL，用于决定是否跳过 /refresh
  const hasInitialValidUrl = Boolean(video.url && video.url.startsWith("http"));

  // 关闭：先播放退出动画，动画结束后再真正卸载
  const handleClose = useCallback(() => {
    if (closing) return;
    setClosing(true);
    setTimeout(onClose, 180);
  }, [closing, onClose]);

  const sourceUrl = video.sourceUrl || "";

  const doRefresh = useCallback(async () => {
    if (!sourceUrl && !postId) {
      setPhase("error");
      setErrorMsg("缺少视频源链接，无法重新解析");
      return;
    }
    setPhase("fetch");
    try {
      // 后端成功返回 ParsedVideo，失败返回 { message: string }
      let data: PostVideo | { message?: string } | null = null;
      let ok = false;

      if (postId) {
        // 优先使用持久化重新解析端点：重新解析 + 更新后端 + ISR 重验证
        // 30 秒缓存由后端管理，自动重试时通过 skipCache 绕过
        const url = autoRetriedRef.current
          ? `${API_URL}/posts/${postId}/refresh-video?skipCache=1`
          : `${API_URL}/posts/${postId}/refresh-video`;
        const resp = await fetch(url, { method: "POST" });
        data = await resp.json();
        ok = resp.ok;
      } else {
        // 无 postId 时回退到普通刷新（不持久化）
        const skipCache = autoRetriedRef.current ? "&skipCache=1" : "";
        const resp = await fetch(
          `${API_URL}/video/refresh?sourceUrl=${encodeURIComponent(sourceUrl)}${skipCache}`
        );
        data = await resp.json();
        ok = resp.ok;
      }

      if (!ok || !data) {
        setPhase("error");
        const errMsg = (data as { message?: string } | null)?.message;
        setErrorMsg(errMsg || "解析失败");
        return;
      }
      setFreshVideo(data as PostVideo);
      // 回传最新数据给父组件，让动态卡片信息（头像/昵称/标题/点赞）跟着更新
      if (onRefreshed) {
        try { onRefreshed(data as PostVideo); } catch { /* 父组件已卸载等，忽略 */ }
      }
      // 解析完成，进入 video 加载阶段
      setPhase("load");
    } catch {
      setPhase("error");
      setErrorMsg("网络错误，请稍后重试");
    }
  }, [sourceUrl, postId, onRefreshed]);

  // 挂载时懒加载判断：
  //   - 首次加载（refreshKey === 0）+ 已有有效 http URL → 直接进入 load 阶段，跳过 /refresh
  //   - 无有效 URL 或重试（refreshKey > 0）→ 调用 /refresh 重新解析
  useEffect(() => {
    if (hasInitialValidUrl && refreshKey === 0) {
      setPhase("load");
      return;
    }
    doRefresh();
  }, [doRefresh, refreshKey, hasInitialValidUrl]);

  // 加载超时保护：进入 load 阶段后，如果 10 秒内未进入 play 阶段，
  // 自动触发重新解析（跳过缓存），避免视频一直卡在加载状态。
  const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (phase === "load") {
      loadTimeoutRef.current = setTimeout(() => {
        // 仅在未重试过时触发自动重试，避免无限循环
        if (!autoRetriedRef.current) {
          autoRetriedRef.current = true;
          setRefreshKey((k) => k + 1);
        }
      }, 10000);
    } else {
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
        loadTimeoutRef.current = null;
      }
    }
    return () => {
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
        loadTimeoutRef.current = null;
      }
    };
  }, [phase]);

  // ESC 关闭
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleClose]);

  // 阻止背景滚动穿透
  useEffect(() => {
    const onTouchMove = (e: TouchEvent) => e.preventDefault();
    const onWheel = (e: WheelEvent) => e.preventDefault();
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("wheel", onWheel);
    };
  }, []);

  if (typeof document === "undefined") return null;

  const currentVideo = freshVideo || video;
  const cover = currentVideo.cover ? toAbsoluteUrl(currentVideo.cover) : undefined;
  const rawUrl = toAbsoluteUrl(currentVideo.url || "");
  const videoSrc = rawUrl.startsWith("http")
    ? `${API_URL}/video/proxy?url=${encodeURIComponent(rawUrl)}`
    : rawUrl;
  const likeText = formatLike(currentVideo.like);

  // 信息条跳转 URL（http 前缀补全）
  const infoHref = currentVideo.sourceUrl
    ? (currentVideo.sourceUrl.startsWith("http") ? currentVideo.sourceUrl : `https://${currentVideo.sourceUrl}`)
    : null;

  const handleBgClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) handleClose();
  };

  const handleVideoError = () => {
    // 链接过期时自动重新解析一次（跳过 refresh 缓存），失败再显示错误
    if (!autoRetriedRef.current) {
      autoRetriedRef.current = true;
      setRefreshKey((k) => k + 1);
      return;
    }
    setPhase("error");
    setErrorMsg("视频加载失败，链接可能已过期");
  };

  // 封面模糊背景层在非 play 阶段显示，提供视觉内容（抖音风格）
  const showCoverBg = phase !== "play" && !!cover;

  // 信息条内容
  const infoContent = (
    <>
      {currentVideo.avatar && (
        <img
          src={toAbsoluteUrl(currentVideo.avatar)}
          alt=""
          className="h-4 w-4 shrink-0 rounded-full object-cover"
        />
      )}
      {currentVideo.platform && (
        <span className="shrink-0 rounded bg-white/15 px-1.5 py-0.5 text-[11px]">
          {PLATFORM_LABELS[currentVideo.platform] || currentVideo.platform}
        </span>
      )}
      {currentVideo.title && (
        <span className="truncate text-white/90">{currentVideo.title}</span>
      )}
      {currentVideo.author && (
        <span className="shrink-0">· {currentVideo.author}</span>
      )}
      {likeText && (
        <span className="shrink-0 text-[12px]">♡ {likeText}</span>
      )}
    </>
  );

  const hasInfo = currentVideo.title || currentVideo.author || currentVideo.platform;

  return createPortal(
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center overflow-hidden select-none ${closing ? "animate-overlay-out" : "animate-overlay-in"}`}
      style={{
        backgroundColor: "rgba(0,0,0,0.98)",
        touchAction: "none",
        WebkitTouchCallout: "none",
        WebkitUserSelect: "none",
        userSelect: "none",
      }}
      onClick={handleBgClick}
    >
      {/* 右上角关闭 */}
      <button
        type="button"
        onClick={handleClose}
        className="absolute right-3 top-3 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm ring-1 ring-white/20 transition-colors hover:bg-black/60"
        aria-label="关闭"
      >
        <X className="h-5 w-5 pointer-events-none" />
      </button>

      {/* 内容区域 */}
      <div
        className={`relative w-full max-w-[420px] md:max-w-[640px] mx-4 ${closing ? "animate-modal-out" : "animate-modal-in"}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 视频容器（16:9） */}
        <div className="relative w-full overflow-hidden rounded-xl bg-black">
          {/* 封面模糊背景层：加载/错误时显示，放大+高斯模糊营造氛围 */}
          {showCoverBg && (
            <img
              src={cover}
              alt=""
              className="absolute inset-0 h-full w-full scale-110 object-cover opacity-50 blur-md"
            />
          )}

          {/* CustomVideoPlayer：load 阶段开始渲染，play 阶段淡入可见 */}
          {(phase === "load" || phase === "play") && (
            <div
              className="relative w-full transition-opacity duration-300"
              style={{ opacity: phase === "play" ? 1 : 0 }}
            >
              <CustomVideoPlayer
                src={videoSrc}
                poster={cover}
                autoPlay
                onError={handleVideoError}
                onLoaded={() => setPhase("play")}
                className="rounded-xl"
              />
            </div>
          )}

          {/* 加载覆盖层（fetch / load 阶段）：脉冲圆环 + 文字 */}
          {(phase === "fetch" || phase === "load") && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="flex flex-col items-center gap-3">
                <div className="relative flex h-12 w-12 items-center justify-center">
                  <div className="absolute h-full w-full rounded-full bg-white/10 animate-ping" />
                  <div className="relative h-10 w-10 rounded-full border-[3px] border-white/20 border-t-white animate-spin" />
                </div>
                <span className="text-xs text-white/70">
                  {phase === "fetch" ? "正在解析视频..." : "正在加载视频..."}
                </span>
              </div>
            </div>
          )}

          {/* 错误状态 */}
          {phase === "error" && (
            <div className="absolute inset-0 flex items-center justify-center" style={{ aspectRatio: "16 / 9" }}>
              <div className="flex flex-col items-center gap-3 text-white">
                <AlertCircle className="h-8 w-8 text-white/70" />
                <span className="text-sm text-white/80 text-center px-4">{errorMsg}</span>
                <button
                  type="button"
                  onClick={() => {
                    autoRetriedRef.current = false;
                    setRefreshKey((k) => k + 1);
                  }}
                  className="mt-1 flex items-center gap-1.5 rounded-full bg-white/15 px-4 py-1.5 text-sm text-white ring-1 ring-white/25 backdrop-blur-sm transition-colors hover:bg-white/25"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  重新解析
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 视频信息条：整体可点击跳转到 sourceUrl */}
        {hasInfo && (
          infoHref ? (
            <a
              href={infoHref}
              target="_blank"
              rel="noopener noreferrer"
              title="点击查看原视频"
              onClick={(e) => e.stopPropagation()}
              className="mt-2 flex items-center gap-1.5 text-[13px] text-white/70 transition-colors hover:text-white"
            >
              {infoContent}
            </a>
          ) : (
            <div className="mt-2 flex items-center gap-1.5 text-[13px] text-white/70">
              {infoContent}
            </div>
          )
        )}
      </div>
    </div>,
    document.body
  );
}
