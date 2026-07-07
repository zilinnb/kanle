"use client";

import Image from "next/image";
import { useState, useCallback, useEffect, useRef, type MouseEvent as ReactMouseEvent, type TouchEvent as ReactTouchEvent } from "react";
import ImageViewer from "./ImageViewer";
import type { PostImage } from "@/lib/mock-data";
import { isLivePhoto, getImageSrc, getVideoSrc } from "@/lib/post-image";
import { Volume2, VolumeX } from "lucide-react";

interface ImageGridProps {
  images: PostImage[];
}

function FadeImage({
  src,
  alt,
  sizes,
  className = "",
}: {
  src: string;
  alt: string;
  sizes: string;
  className?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      onLoad={() => setLoaded(true)}
      className={`${className} transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"}`}
    />
  );
}

// 实况角标 — Apple 风格旋转图标 + "实况"文字，播放时淡出
function LiveBadge({ hidden }: { hidden: boolean }) {
  return (
    <span
      className={`pointer-events-none absolute left-1.5 top-1.5 z-20 flex items-center gap-1 rounded-full bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm transition-opacity duration-300 ${
        hidden ? "opacity-0" : "opacity-100"
      }`}
    >
      <svg
        className="h-3 w-3 animate-spin [animation-duration:5s]"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="5" />
        <path d="M15.9 20.11l0 .01" />
        <path d="M19.04 17.61l0 .01" />
        <path d="M20.77 14l0 .01" />
        <path d="M20.77 10l0 .01" />
        <path d="M19.04 6.39l0 .01" />
        <path d="M15.9 3.89l0 .01" />
        <path d="M12 3l0 .01" />
        <path d="M8.1 3.89l0 .01" />
        <path d="M4.96 6.39l0 .01" />
        <path d="M3.23 10l0 .01" />
        <path d="M3.23 14l0 .01" />
        <path d="M4.96 17.61l0 .01" />
        <path d="M8.1 20.11l0 .01" />
        <path d="M12 21l0 .01" />
      </svg>
      实况
    </span>
  );
}

const stopProp = (e: ReactMouseEvent | ReactTouchEvent) => e.stopPropagation();

export default function ImageGrid({ images }: ImageGridProps) {
  const [index, setIndex] = useState(-1);
  const [originRect, setOriginRect] = useState<DOMRect | null>(null);
  const [singleRatio, setSingleRatio] = useState<number | null>(null);

  // 实况图播放状态
  const [playingIndex, setPlayingIndex] = useState(-1);
  const [videoMounted, setVideoMounted] = useState(-1); // 视频元素挂载索引（-1=未挂载）
  const [videoOpacity, setVideoOpacity] = useState(false); // 视频淡入淡出
  const [muted, setMuted] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressedRef = useRef(false);
  const fadeOutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  // 检测桌面设备（有 hover + 精确指针）
  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const openViewer = useCallback((i: number, el: HTMLElement) => {
    setOriginRect(el.getBoundingClientRect());
    setIndex(i);
  }, []);

  const closeViewer = useCallback(() => {
    setIndex(-1);
    setOriginRect(null);
  }, []);

  const count = images.length;

  const clearPressTimer = useCallback(() => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  }, []);

  // 播放实况视频：挂载视频元素，等 onCanPlay 后再淡入（避免黑帧）
  const playVideo = useCallback((i: number) => {
    if (fadeOutTimerRef.current) {
      clearTimeout(fadeOutTimerRef.current);
      fadeOutTimerRef.current = null;
    }
    setVideoOpacity(false);
    setVideoMounted(i);
    setPlayingIndex(i);
  }, []);

  // 停止实况视频：先淡出 → 300ms 后卸载
  const stopVideo = useCallback(() => {
    setVideoOpacity(false);
    setPlayingIndex(-1);
    fadeOutTimerRef.current = setTimeout(() => {
      setVideoMounted(-1);
      fadeOutTimerRef.current = null;
    }, 300);
  }, []);

  // 视频挂载后自动播放
  useEffect(() => {
    if (playingIndex >= 0 && videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  }, [playingIndex, videoMounted]);

  // iOS 微信内 onCanPlay/onLoadedMetadata 不触发，用 setTimeout 兜底淡入
  useEffect(() => {
    if (playingIndex < 0) return;
    const ua = navigator.userAgent;
    if (/iphone/i.test(ua) && /micromessenger/i.test(ua)) {
      const timer = setTimeout(() => setVideoOpacity(true), 600);
      return () => clearTimeout(timer);
    }
  }, [playingIndex]);

  // 长按 500ms 触发实况播放（仅移动端；桌面端用 hover 触发）
  const startPress = useCallback(
    (i: number, hasVideo: boolean) => {
      if (!hasVideo) return;
      if (isDesktop) return; // 桌面端用 onMouseEnter 触发
      longPressedRef.current = false;
      clearPressTimer();
      pressTimerRef.current = setTimeout(() => {
        longPressedRef.current = true;
        playVideo(i);
      }, 500);
    },
    [clearPressTimer, playVideo, isDesktop]
  );

  const endPress = useCallback(() => {
    clearPressTimer();
    // 移动端：长按触发的播放，松手停止
    if (longPressedRef.current && playingIndex >= 0) {
      stopVideo();
      longPressedRef.current = false;
    }
    // 桌面端：鼠标离开停止播放
    if (isDesktop && playingIndex >= 0) {
      stopVideo();
    }
  }, [clearPressTimer, playingIndex, stopVideo, isDesktop]);

  // 带移动阈值的长按启动：记录起始位置
  const handleTouchStart = useCallback(
    (i: number, hasVideo: boolean, e: ReactTouchEvent<HTMLDivElement>) => {
      const t = e.touches[0];
      if (t) touchStartRef.current = { x: t.clientX, y: t.clientY };
      startPress(i, hasVideo);
    },
    [startPress]
  );

  // 移动超过 10px 才取消长按（避免微小手指抖动）
  const handleTouchMove = useCallback(
    (e: ReactTouchEvent<HTMLDivElement>) => {
      if (!touchStartRef.current) return;
      const t = e.touches[0];
      if (!t) return;
      const dx = t.clientX - touchStartRef.current.x;
      const dy = t.clientY - touchStartRef.current.y;
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        endPress();
        touchStartRef.current = null;
      }
    },
    [endPress]
  );

  const handleTouchEnd = useCallback(() => {
    touchStartRef.current = null;
    endPress();
  }, [endPress]);

  // 点击处理：进入预览（移动端吞掉长按后的 click；桌面端若在播放先停止）
  const handleClick = useCallback(
    (i: number, el: HTMLElement) => {
      if (longPressedRef.current) {
        longPressedRef.current = false;
        return;
      }
      if (isDesktop && playingIndex === i) {
        stopVideo();
      }
      openViewer(i, el);
    },
    [isDesktop, playingIndex, stopVideo, openViewer]
  );

  // Preload single image for aspect ratio
  useEffect(() => {
    if (count !== 1 || !images[0]) {
      setSingleRatio(null);
      return;
    }
    let cancelled = false;
    const probe = new window.Image();
    probe.onload = () => {
      if (!cancelled && probe.naturalWidth && probe.naturalHeight) {
        setSingleRatio(probe.naturalWidth / probe.naturalHeight);
      }
    };
    probe.onerror = () => {
      if (!cancelled) setSingleRatio(4 / 3);
    };
    probe.src = getImageSrc(images[0]);
    return () => {
      cancelled = true;
    };
  }, [count, images]);

  // Cleanup
  useEffect(() => {
    return () => {
      clearPressTimer();
      if (fadeOutTimerRef.current) clearTimeout(fadeOutTimerRef.current);
    };
  }, [clearPressTimer]);

  if (count === 0) return null;

  const display = images.slice(0, 9);
  const displayCount = display.length;
  const cols = displayCount === 2 || displayCount === 4 ? 2 : 3;

  // ===== Single image =====
  if (displayCount === 1) {
    const ratio = singleRatio ?? 4 / 3;
    const isLandscape = ratio >= 1;
    const widthValue = isLandscape
      ? "min(100%, var(--single-img-max, 280px))"
      : `min(100%, calc(var(--single-img-height, 240px) * ${ratio}))`;

    const img = display[0];
    const src = getImageSrc(img);
    const video = getVideoSrc(img);
    const live = isLivePhoto(img);
    const playing = playingIndex === 0;
    const videoHere = videoMounted === 0;

    return (
      <>
        <div className="mt-2" style={{ width: widthValue }}>
          <div
            className="group relative block w-full overflow-hidden rounded bg-wechat-bubble select-none"
            style={{
              paddingBottom: `${100 / ratio}%`,
              WebkitTouchCallout: "none",
              WebkitUserSelect: "none",
              userSelect: "none",
            }}
            onContextMenu={(e) => e.preventDefault()}
            onTouchStart={(e) => handleTouchStart(0, !!video, e)}
            onTouchEnd={handleTouchEnd}
            onTouchMove={handleTouchMove}
            onMouseEnter={() => {
              if (isDesktop && !!video) playVideo(0);
            }}
            onMouseLeave={endPress}
            onClick={(e) => handleClick(0, e.currentTarget)}
          >
            {/* 图片层（始终存在，底层）：播放时淡出+轻微缩小，营造"活过来"的视觉 */}
            <button
              type="button"
              className={`absolute inset-0 h-full w-full cursor-zoom-in transition-all duration-300 ${
                playing ? "scale-90 opacity-0" : "scale-100 opacity-100"
              }`}
            >
              <FadeImage
                src={src}
                alt="朋友圈图片"
                className="object-cover transition-transform duration-200 hover:scale-105"
                sizes="(max-width: 640px) 70vw, 320px"
              />
            </button>

            {/* 视频层（叠加在图片上）：从放大状态淡入到正常尺寸，与图片淡出同步 */}
            {videoHere && video && (
              <video
                ref={videoRef}
                src={video}
                muted={muted}
                playsInline
                preload="auto"
                onCanPlay={() => setVideoOpacity(true)}
                onPlaying={() => setVideoOpacity(true)}
                onEnded={stopVideo}
                className={`absolute inset-0 h-full w-full object-cover transition-all duration-300 ${
                  videoOpacity ? "opacity-100 scale-100" : "opacity-0 scale-110"
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleClick(0, e.currentTarget.parentElement!);
                }}
              />
            )}

            {/* 实况角标 */}
            {live && <LiveBadge hidden={playing} />}

            {/* 播放中：静音切换 */}
            {playing && (
              <button
                type="button"
                onMouseDown={stopProp}
                onMouseUp={stopProp}
                onTouchStart={stopProp}
                onTouchEnd={stopProp}
                onClick={(e) => {
                  e.stopPropagation();
                  setMuted((m) => !m);
                }}
                className="absolute bottom-1.5 right-1.5 z-30 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-black/70"
                aria-label={muted ? "取消静音" : "静音"}
              >
                {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
              </button>
            )}
          </div>
        </div>
        {index >= 0 && (
          <ImageViewer
            images={images}
            initialIndex={index}
            originRect={originRect}
            onClose={closeViewer}
          />
        )}
      </>
    );
  }

  // ===== Multiple images grid =====
  return (
    <>
      <div
        className={`mt-2 grid gap-[4px] ${
          cols === 2
            ? "max-w-[min(58vw,220px)] md:max-w-[min(52vw,280px)]"
            : "max-w-[min(72vw,270px)] md:max-w-[min(64vw,340px)]"
        }`}
        style={{
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
        }}
      >
        {display.map((img, i) => {
          const src = getImageSrc(img);
          const video = getVideoSrc(img);
          const live = isLivePhoto(img);
          const playing = playingIndex === i;
          const videoHere = videoMounted === i;
          return (
            <div
              key={i}
              className="group relative w-full overflow-hidden rounded-sm bg-wechat-bubble select-none"
              style={{
                paddingBottom: "100%",
                WebkitTouchCallout: "none",
                WebkitUserSelect: "none",
                userSelect: "none",
              }}
              onContextMenu={(e) => e.preventDefault()}
              onTouchStart={(e) => handleTouchStart(i, !!video, e)}
              onTouchEnd={handleTouchEnd}
              onTouchMove={handleTouchMove}
              onMouseEnter={() => {
                if (isDesktop && !!video) playVideo(i);
              }}
              onMouseLeave={endPress}
              onClick={(e) => handleClick(i, e.currentTarget)}
            >
              {/* 图片层：播放时淡出+轻微缩小 */}
              <button
                type="button"
                className={`absolute inset-0 h-full w-full cursor-zoom-in transition-all duration-300 ${
                  playing ? "scale-90 opacity-0" : "scale-100 opacity-100"
                }`}
              >
                <FadeImage
                  src={src}
                  alt={`朋友圈图片 ${i + 1}`}
                  className="object-cover transition-transform duration-200 hover:scale-105"
                  sizes={
                    cols === 2
                      ? "(max-width: 640px) 25vw, 140px"
                      : "(max-width: 640px) 20vw, 115px"
                  }
                />
              </button>

              {/* 视频层：从放大状态淡入到正常尺寸 */}
              {videoHere && video && (
                <video
                  ref={i === videoMounted ? videoRef : undefined}
                  src={video}
                  muted={muted}
                  playsInline
                  preload="auto"
                  onCanPlay={() => setVideoOpacity(true)}
                  onPlaying={() => setVideoOpacity(true)}
                  onEnded={stopVideo}
                  className={`absolute inset-0 h-full w-full object-cover transition-all duration-300 ${
                    videoOpacity ? "opacity-100 scale-100" : "opacity-0 scale-110"
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClick(i, e.currentTarget.parentElement!);
                  }}
                />
              )}

              {/* 实况角标 */}
              {live && <LiveBadge hidden={playing} />}

              {/* 播放中：静音切换 */}
              {playing && (
                <button
                  type="button"
                  onMouseDown={stopProp}
                  onMouseUp={stopProp}
                  onTouchStart={stopProp}
                  onTouchEnd={stopProp}
                  onClick={(e) => {
                    e.stopPropagation();
                    setMuted((m) => !m);
                  }}
                  className="absolute bottom-1 right-1 z-30 flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-black/70"
                  aria-label={muted ? "取消静音" : "静音"}
                >
                  {muted ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
                </button>
              )}
            </div>
          );
        })}
      </div>
      {index >= 0 && (
        <ImageViewer
          images={images}
          initialIndex={index}
          originRect={originRect}
          onClose={closeViewer}
        />
      )}
    </>
  );
}
