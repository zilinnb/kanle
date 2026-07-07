"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Loader2,
  RotateCcw,
  RotateCw,
} from "lucide-react";

interface CustomVideoPlayerProps {
  src: string;
  poster?: string;
  autoPlay?: boolean;
  onError?: () => void;
  onLoaded?: () => void;
  className?: string;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  if (h > 0) return `${String(h).padStart(2, "0")}:${mm}:${ss}`;
  return `${mm}:${ss}`;
}

export default function CustomVideoPlayer({
  src,
  poster,
  autoPlay = true,
  onError,
  onLoaded,
  className = "",
}: CustomVideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastClickRef = useRef<number>(0);
  const seekingRef = useRef(false);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [seeking, setSeeking] = useState(false);
  const [hoverProgress, setHoverProgress] = useState<number | null>(null);
  const [isTouch, setIsTouch] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [ready, setReady] = useState(false);

  // ── 触摸设备检测 ──
  useEffect(() => {
    setIsTouch(
      typeof navigator !== "undefined" &&
        (navigator.maxTouchPoints > 0 || "ontouchstart" in window)
    );
  }, []);

  // ── 全屏状态监听 ──
  useEffect(() => {
    const onFsChange = () => {
      const doc = document as Document & { webkitFullscreenElement?: Element | null };
      setFullscreen(Boolean(document.fullscreenElement || doc.webkitFullscreenElement));
    };
    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("webkitfullscreenchange", onFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("webkitfullscreenchange", onFsChange);
    };
  }, []);

  // ── 控件自动隐藏 ──
  const showControls = useCallback(() => {
    setControlsVisible(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => {
      // 仅在播放中且非拖拽时隐藏
      if (videoRef.current && !videoRef.current.paused && !seekingRef.current) {
        setControlsVisible(false);
      }
    }, 3000);
  }, []);

  const hideControlsImmediately = useCallback(() => {
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    if (videoRef.current && !videoRef.current.paused && !seekingRef.current) {
      setControlsVisible(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    };
  }, []);

  // ── 播放/暂停 ──
  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      setBuffering(true);
      v.play().catch(() => setBuffering(false));
    } else {
      v.pause();
    }
  }, []);

  // ── 全屏 ──
  const enterFullscreen = useCallback(async () => {
    const el = containerRef.current;
    const v = videoRef.current;
    if (!el) return;
    // iOS Safari：video 元素原生全屏（系统接管控件）
    if (v && "webkitEnterFullscreen" in v && typeof (v as any).webkitEnterFullscreen === "function") {
      try {
        (v as any).webkitEnterFullscreen();
        return;
      } catch {
        // 回退到容器全屏
      }
    }
    try {
      if (el.requestFullscreen) await el.requestFullscreen();
      else if ((el as any).webkitRequestFullscreen) (el as any).webkitRequestFullscreen();
      else if ((el as any).mozRequestFullScreen) (el as any).mozRequestFullScreen();
      else if ((el as any).msRequestFullscreen) (el as any).msRequestFullscreen();
    } catch {
      // 全屏失败：忽略
    }
  }, []);

  const exitFullscreen = useCallback(async () => {
    try {
      if (document.exitFullscreen) await document.exitFullscreen();
      else if ((document as any).webkitExitFullscreen) (document as any).webkitExitFullscreen();
      else if ((document as any).mozCancelFullScreen) (document as any).mozCancelFullScreen();
      else if ((document as any).msExitFullscreen) (document as any).msExitFullscreen();
    } catch {
      // 忽略
    }
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (fullscreen) exitFullscreen();
    else enterFullscreen();
  }, [fullscreen, enterFullscreen, exitFullscreen]);

  // ── 视频区域单击/双击 ──
  const handleVideoClick = useCallback(() => {
    const now = Date.now();
    const diff = now - lastClickRef.current;
    if (diff < 300 && diff > 0) {
      // 双击：桌面全屏，移动端忽略
      lastClickRef.current = 0;
      if (!isTouch) toggleFullscreen();
      return;
    }
    lastClickRef.current = now;
    // 延迟 250ms 判断是否双击
    setTimeout(() => {
      if (lastClickRef.current === now) {
        togglePlay();
        lastClickRef.current = 0;
      }
    }, 250);
  }, [isTouch, toggleFullscreen, togglePlay]);

  // ── 进度条拖拽（Pointer Events）──
  const getTimeFromPointer = useCallback((clientX: number): number => {
    const bar = progressRef.current;
    const v = videoRef.current;
    if (!bar || !v || !duration) return 0;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    return ratio * duration;
  }, [duration]);

  const handleProgressPointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    seekingRef.current = true;
    setSeeking(true);
    const t = getTimeFromPointer(e.clientX);
    if (videoRef.current) videoRef.current.currentTime = t;
    setCurrentTime(t);
  }, [getTimeFromPointer]);

  const handleProgressPointerMove = useCallback((e: React.PointerEvent) => {
    // 悬停预览（非拖拽）
    if (!seekingRef.current) {
      const bar = progressRef.current;
      if (!bar) return;
      const rect = bar.getBoundingClientRect();
      const ratio = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
      setHoverProgress(ratio);
      return;
    }
    const t = getTimeFromPointer(e.clientX);
    if (videoRef.current) videoRef.current.currentTime = t;
    setCurrentTime(t);
  }, [getTimeFromPointer]);

  const handleProgressPointerUp = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    try {
      (e.target as Element).releasePointerCapture(e.pointerId);
    } catch {
      // 忽略
    }
    seekingRef.current = false;
    setSeeking(false);
    setHoverProgress(null);
    showControls();
  }, [showControls]);

  const handleProgressPointerLeave = useCallback(() => {
    if (!seekingRef.current) setHoverProgress(null);
  }, []);

  // ── 跳转 ±10 秒 ──
  const seekBy = useCallback((delta: number) => {
    const v = videoRef.current;
    if (!v || !duration) return;
    v.currentTime = Math.min(Math.max(v.currentTime + delta, 0), duration);
    showControls();
  }, [duration, showControls]);

  // ── 音量 ──
  const handleVolumePointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
  }, []);

  const handleVolumePointerMove = useCallback((e: React.PointerEvent) => {
    if (e.buttons !== 1) return; // 仅左键按下时
    const bar = e.currentTarget as Element;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    const v = videoRef.current;
    if (v) {
      v.volume = ratio;
      v.muted = ratio === 0;
      setVolume(ratio);
      setMuted(ratio === 0);
    }
  }, []);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }, []);

  // ── 键盘控制 ──
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case " ":
      case "k":
        e.preventDefault();
        togglePlay();
        break;
      case "ArrowLeft":
        e.preventDefault();
        seekBy(-5);
        break;
      case "ArrowRight":
        e.preventDefault();
        seekBy(5);
        break;
      case "f":
        e.preventDefault();
        toggleFullscreen();
        break;
      case "m":
        e.preventDefault();
        toggleMute();
        break;
    }
    showControls();
  }, [togglePlay, seekBy, toggleFullscreen, toggleMute, showControls]);

  // ── 视频事件 ──
  const onLoadedMetadata = () => {
    const v = videoRef.current;
    if (!v) return;
    setDuration(v.duration || 0);
    setVolume(v.volume);
    setMuted(v.muted);
    setReady(true);
    onLoaded?.();
  };

  const onTimeUpdate = () => {
    if (seekingRef.current) return;
    const v = videoRef.current;
    if (!v) return;
    setCurrentTime(v.currentTime);
  };

  const onProgress = () => {
    const v = videoRef.current;
    if (!v || !v.buffered.length) return;
    setBuffered(v.buffered.end(v.buffered.length - 1));
  };

  const handleVideoError = () => {
    setBuffering(false);
    onError?.();
  };

  // ── 播放进度比例（用于渲染）──
  const playedRatio = useMemo(() => {
    if (!duration) return 0;
    return Math.min(currentTime / duration, 1);
  }, [currentTime, duration]);

  const bufferedRatio = useMemo(() => {
    if (!duration) return 0;
    return Math.min(buffered / duration, 1);
  }, [buffered, duration]);

  const VolumeIcon = muted || volume === 0 ? VolumeX : Volume2;

  return (
    <div
      ref={containerRef}
      className={`relative w-full bg-black overflow-hidden select-none group ${className}`}
      style={{
        aspectRatio: "16 / 9",
        touchAction: "none",
        WebkitTouchCallout: "none",
        WebkitUserSelect: "none",
        userSelect: "none",
      }}
      onMouseMove={showControls}
      onMouseLeave={hideControlsImmediately}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* 视频元素 */}
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        autoPlay={autoPlay}
        playsInline
        preload="auto"
        onLoadedMetadata={onLoadedMetadata}
        onTimeUpdate={onTimeUpdate}
        onProgress={onProgress}
        onPlay={() => {
          setPlaying(true);
          setBuffering(false);
          showControls();
        }}
        onPause={() => {
          setPlaying(false);
          setControlsVisible(true);
          if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
        }}
        onWaiting={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
        onCanPlay={() => setBuffering(false)}
        onEnded={() => {
          setPlaying(false);
          setControlsVisible(true);
        }}
        onError={handleVideoError}
        onClick={handleVideoClick}
        className="absolute inset-0 h-full w-full object-contain bg-black"
        style={{ outline: "none" }}
      />

      {/* 中央缓冲指示 */}
      {buffering && ready && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-white/90" />
        </div>
      )}

      {/* 中央播放按钮（暂停时） */}
      {!playing && !buffering && ready && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            togglePlay();
          }}
          className="absolute inset-0 flex items-center justify-center"
          aria-label="播放"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm ring-1 ring-white/30 transition-transform hover:scale-110">
            <Play className="h-6 w-6 fill-white text-white ml-0.5" />
          </div>
        </button>
      )}

      {/* 控件栏 */}
      <div
        className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-8 pb-2 px-2 sm:px-3 transition-opacity duration-300 ${
          controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 进度条 */}
        <div
          ref={progressRef}
          className="group/progress relative h-4 flex items-center cursor-pointer"
          onPointerDown={handleProgressPointerDown}
          onPointerMove={handleProgressPointerMove}
          onPointerUp={handleProgressPointerUp}
          onPointerLeave={handleProgressPointerLeave}
        >
          {/* 悬停时间提示 */}
          {hoverProgress !== null && (
            <div
              className="absolute -top-7 pointer-events-none rounded bg-black/80 px-1.5 py-0.5 text-[10px] text-white"
              style={{ left: `calc(${hoverProgress * 100}% - 18px)` }}
            >
              {formatTime(hoverProgress * duration)}
            </div>
          )}
          {/* 轨道 */}
          <div className="relative h-1 w-full rounded-full bg-white/25 transition-all group-hover/progress:h-1.5">
            {/* 缓冲 */}
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-white/35"
              style={{ width: `${bufferedRatio * 100}%` }}
            />
            {/* 已播放 */}
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-[#00a1d6]"
              style={{ width: `${playedRatio * 100}%` }}
            />
            {/* 手柄 */}
            <div
              className={`absolute top-1/2 h-3 w-3 -translate-y-1/2 -translate-x-1/2 rounded-full bg-white shadow transition-opacity ${
                seeking || hoverProgress !== null ? "opacity-100" : "opacity-0 group-hover/progress:opacity-100"
              }`}
              style={{ left: `${playedRatio * 100}%` }}
            />
          </div>
        </div>

        {/* 控制按钮 */}
        <div className="mt-1 flex items-center gap-2 text-white">
          {/* 播放/暂停 */}
          <button
            type="button"
            onClick={togglePlay}
            className="flex h-7 w-7 items-center justify-center rounded transition-colors hover:text-white/80"
            aria-label={playing ? "暂停" : "播放"}
          >
            {playing ? <Pause className="h-4 w-4 fill-white" /> : <Play className="h-4 w-4 fill-white" />}
          </button>

          {/* 后退 5s（移动端隐藏） */}
          {!isTouch && (
            <button
              type="button"
              onClick={() => seekBy(-5)}
              className="flex h-7 w-7 items-center justify-center rounded transition-colors hover:text-white/80"
              aria-label="后退5秒"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          )}

          {/* 前进 5s（移动端隐藏） */}
          {!isTouch && (
            <button
              type="button"
              onClick={() => seekBy(5)}
              className="flex h-7 w-7 items-center justify-center rounded transition-colors hover:text-white/80"
              aria-label="前进5秒"
            >
              <RotateCw className="h-4 w-4" />
            </button>
          )}

          {/* 时间 */}
          <span className="text-[11px] tabular-nums text-white/90 whitespace-nowrap">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          <div className="flex-1" />

          {/* 音量（桌面） */}
          {!isTouch && (
            <div
              className="flex items-center"
              onMouseEnter={() => setShowVolumeSlider(true)}
              onMouseLeave={() => setShowVolumeSlider(false)}
            >
              <button
                type="button"
                onClick={toggleMute}
                className="flex h-7 w-7 items-center justify-center rounded transition-colors hover:text-white/80"
                aria-label={muted ? "取消静音" : "静音"}
              >
                <VolumeIcon className="h-4 w-4" />
              </button>
              <div
                className={`overflow-hidden transition-all duration-200 ${
                  showVolumeSlider ? "w-16 opacity-100" : "w-0 opacity-0"
                }`}
              >
                <div
                  className="relative h-4 flex items-center cursor-pointer ml-1"
                  onPointerDown={handleVolumePointerDown}
                  onPointerMove={handleVolumePointerMove}
                >
                  <div className="relative h-1 w-full rounded-full bg-white/25">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-white"
                      style={{ width: `${(muted ? 0 : volume) * 100}%` }}
                    />
                    <div
                      className="absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 -translate-x-1/2 rounded-full bg-white"
                      style={{ left: `${(muted ? 0 : volume) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 静音（移动端） */}
          {isTouch && (
            <button
              type="button"
              onClick={toggleMute}
              className="flex h-7 w-7 items-center justify-center rounded transition-colors hover:text-white/80"
              aria-label={muted ? "取消静音" : "静音"}
            >
              <VolumeIcon className="h-4 w-4" />
            </button>
          )}

          {/* 全屏 */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="flex h-7 w-7 items-center justify-center rounded transition-colors hover:text-white/80"
            aria-label={fullscreen ? "退出全屏" : "全屏"}
          >
            {fullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
