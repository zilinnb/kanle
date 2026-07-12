"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type MouseEvent as ReactMouseEvent,
  type TouchEvent as ReactTouchEvent,
} from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight, Volume2, VolumeX } from "lucide-react";
import type { PostImage } from "@/lib/mock-data";
import { getImageSrc, getVideoSrc } from "@/lib/post-image";

interface ImageViewerProps {
  images: PostImage[];
  initialIndex: number;
  originRect: DOMRect | null;
  onClose: () => void;
}

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const ANIM_MS = 220;

function touchDistance(a: { clientX: number; clientY: number }, b: { clientX: number; clientY: number }) {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

function toAbsolute(src: string): string {
  if (!src) return src;
  if (src.startsWith("http") || src.startsWith("//")) return src;
  if (src.startsWith("/_next/image")) {
    try {
      const u = new URL(src, window.location.origin);
      const raw = u.searchParams.get("url");
      if (raw) return toAbsolute(raw);
    } catch {
      /* ignore */
    }
  }
  try {
    return new URL(src, window.location.origin).href;
  } catch {
    return src;
  }
}

export default function ImageViewer({
  images,
  initialIndex,
  originRect,
  onClose,
}: ImageViewerProps) {
  const [index, setIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [opening, setOpening] = useState(true);
  const [closing, setClosing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [closeTransform, setCloseTransform] = useState<string | null>(null);
  // 实况图：是否切换为视频播放
  const [playLive, setPlayLive] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [muted, setMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  // 桌面端检测（hover + 精确指针）
  const [isDesktop, setIsDesktop] = useState(false);

  // 当前图片及其视频
  const current = images[index];
  const currentSrc = getImageSrc(current);
  const currentVideo = getVideoSrc(current);
  const live = !!currentVideo;

  // 切换图片时：桌面端自动播放实况，移动端重置为图片
  useEffect(() => {
    if (videoFadeOutTimerRef.current) {
      clearTimeout(videoFadeOutTimerRef.current);
      videoFadeOutTimerRef.current = null;
    }
    if (isDesktop && live) {
      setPlayLive(true);
    } else {
      setPlayLive(false);
    }
    setVideoLoaded(false);
  }, [index, isDesktop, live]);

  // 桌面端检测
  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoFadeOutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 停止实况：先淡出视频 → 300ms 后移除视频元素
  const stopLiveVideo = useCallback(() => {
    setVideoLoaded(false); // 触发 opacity 淡出
    if (videoFadeOutTimerRef.current) clearTimeout(videoFadeOutTimerRef.current);
    videoFadeOutTimerRef.current = setTimeout(() => {
      setPlayLive(false);
      videoFadeOutTimerRef.current = null;
    }, 300);
  }, []);

  // 同步 muted 状态到视频元素
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = muted;
    }
  }, [muted, playLive, videoLoaded]);

  // 视频挂载后手动播放（带声音），自动播放被阻止则静音重试
  useEffect(() => {
    if (playLive && videoRef.current) {
      const v = videoRef.current;
      v.currentTime = 0;
      v.muted = muted;
      v.play().catch(() => {
        v.muted = true;
        setMuted(true);
        v.play().catch(() => {});
      });
    }
  }, [playLive, index]);

  // 声音开关自动隐藏：视频播放后 3 秒淡出，触摸/点击重新显示
  const revealControls = useCallback(() => {
    setShowControls(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => setShowControls(false), 3000);
  }, []);

  useEffect(() => {
    if (playLive && videoLoaded) {
      revealControls();
    }
    return () => {
      if (controlsTimerRef.current) {
        clearTimeout(controlsTimerRef.current);
        controlsTimerRef.current = null;
      }
    };
  }, [playLive, videoLoaded, revealControls]);

  // 全局阻止右键/长按菜单（预览打开期间）
  useEffect(() => {
    const preventContext = (e: Event) => e.preventDefault();
    document.addEventListener("contextmenu", preventContext);
    return () => document.removeEventListener("contextmenu", preventContext);
  }, []);

  const dragRef = useRef({
    dragging: false,
    startX: 0,
    startY: 0,
    baseX: 0,
    baseY: 0,
    moved: false,
  });
  const pinchRef = useRef({
    active: false,
    startDist: 0,
    startScale: 1,
    midX: 0,
    midY: 0,
    startOffsetX: 0,
    startOffsetY: 0,
  });
  const swipeCloseRef = useRef({ active: false, delta: 0 });
  const horizontalSwipeRef = useRef({ active: false, delta: 0 });
  const scaleRef = useRef(1);
  const [interacting, setInteracting] = useState(false);
  // 移动端长按实况图
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressedRef = useRef(false);
  const liveRef = useRef(false);
  // 双击放大检测
  const lastTapTimeRef = useRef(0);
  const pendingCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const justDoubleTappedRef = useRef(false);
  useEffect(() => {
    liveRef.current = live;
  }, [live]);

  const clearPressTimer = useCallback(() => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  }, []);

  // Cleanup：组件卸载时清除定时器
  useEffect(() => {
    return () => {
      if (pressTimerRef.current) {
        clearTimeout(pressTimerRef.current);
        pressTimerRef.current = null;
      }
      if (videoFadeOutTimerRef.current) {
        clearTimeout(videoFadeOutTimerRef.current);
        videoFadeOutTimerRef.current = null;
      }
      if (pendingCloseRef.current) {
        clearTimeout(pendingCloseRef.current);
        pendingCloseRef.current = null;
      }
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
  }, []);

  const count = images.length;

  // 打开动画：挂载后下一帧切换到正常状态触发 transition
  useEffect(() => {
    let raf2 = 0;
    const raf = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setOpening(false));
    });
    return () => {
      cancelAnimationFrame(raf);
      if (raf2) cancelAnimationFrame(raf2);
    };
  }, []);

  const resetView = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
    setLoaded(false);
  }, []);

  // 双击放大/缩小到指定点（移动端双击 + 桌面端双击共用）
  const toggleZoomAtPoint = useCallback((clientX: number, clientY: number) => {
    if (scaleRef.current > MIN_SCALE) {
      setScale(MIN_SCALE);
      setOffset({ x: 0, y: 0 });
    } else {
      const cx = clientX - window.innerWidth / 2;
      const cy = clientY - window.innerHeight / 2;
      const s = 2;
      setScale(s);
      setOffset({ x: cx * (1 - s), y: cy * (1 - s) });
    }
  }, []);

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  const goPrev = useCallback(() => {
    if (count <= 1) return;
    setIndex((i) => (i - 1 + count) % count);
    resetView();
  }, [count, resetView]);

  const goNext = useCallback(() => {
    if (count <= 1) return;
    setIndex((i) => (i + 1) % count);
    resetView();
  }, [count, resetView]);

  // 关闭：计算从当前图片位置缩放回 origin 的 transform，播放动画后真正卸载
  const close = useCallback(() => {
    if (closing) return;
    const img = imgRef.current;
    if (img && originRect) {
      const rect = img.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const ox = originRect.left + originRect.width / 2;
        const oy = originRect.top + originRect.height / 2;
        const s = originRect.width / rect.width;
        setCloseTransform(`translate3d(${ox - cx}px, ${oy - cy}px, 0) scale(${s})`);
      }
    }
    setClosing(true);
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null;
      onClose();
    }, ANIM_MS);
  }, [closing, originRect, onClose]);

  // 取消关闭：双击放大时回滚关闭动画（动画进行中也可逆转）
  const cancelClose = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setClosing(false);
    setCloseTransform(null);
  }, []);

  // 键盘控制
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close, goPrev, goNext]);

  // 滚轮缩放（ref 绑定保证 non-passive，可 preventDefault）
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.12 : 0.89;
      setScale((s) => {
        const ns = Math.max(MIN_SCALE, Math.min(MAX_SCALE, s * factor));
        if (ns === MIN_SCALE) setOffset({ x: 0, y: 0 });
        return ns;
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // 触摸：双指缩放 + 单指拖拽 + 下滑关闭
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onTouchMove = (e: TouchEvent) => {
      if (pinchRef.current.active && e.touches.length === 2) {
        e.preventDefault();
        const dist = touchDistance(e.touches[0], e.touches[1]);
        const ns = Math.max(
          MIN_SCALE,
          Math.min(
            MAX_SCALE,
            pinchRef.current.startScale *
              (dist / (pinchRef.current.startDist || 1))
          )
        );
        const lx =
          (pinchRef.current.midX - pinchRef.current.startOffsetX) /
          (pinchRef.current.startScale || 1);
        const ly =
          (pinchRef.current.midY - pinchRef.current.startOffsetY) /
          (pinchRef.current.startScale || 1);
        setScale(ns);
        setOffset({
          x: pinchRef.current.midX - lx * ns,
          y: pinchRef.current.midY - ly * ns,
        });
        return;
      }
      if (dragRef.current.dragging && e.touches.length === 1) {
        const t = e.touches[0];
        const dx = t.clientX - dragRef.current.startX;
        const dy = t.clientY - dragRef.current.startY;
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
          dragRef.current.moved = true;
          // 移动取消长按
          if (pressTimerRef.current) {
            clearTimeout(pressTimerRef.current);
            pressTimerRef.current = null;
          }
        }
        // 未真正移动时不 preventDefault，确保 click 事件正常触发（按钮单击即可关闭）
        if (!dragRef.current.moved) return;

        // 水平滑动检测：在最小缩放、多图、尚未确定方向时，判断水平 vs 垂直意图
        if (
          swipeCloseRef.current.active &&
          count > 1 &&
          !horizontalSwipeRef.current.active &&
          Math.abs(dx) > 10 &&
          Math.abs(dx) > Math.abs(dy) * 1.5
        ) {
          horizontalSwipeRef.current.active = true;
          swipeCloseRef.current.active = false;
          setOffset({ x: 0, y: 0 });
        }

        // 水平滑动模式：带阻力的水平位移
        if (horizontalSwipeRef.current.active) {
          e.preventDefault();
          horizontalSwipeRef.current.delta = dx;
          const resistance = 0.35;
          setOffset({ x: dx * resistance, y: 0 });
          return;
        }

        if (swipeCloseRef.current.active) {
          e.preventDefault();
          swipeCloseRef.current.delta = dy;
          setOffset({ x: 0, y: dy > 0 ? dy : 0 });
          return;
        }
        e.preventDefault();
        setOffset({
          x: dragRef.current.baseX + dx,
          y: dragRef.current.baseY + dy,
        });
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) pinchRef.current.active = false;
      if (e.touches.length === 0) {
        setInteracting(false);
        // 长按结束：清除定时器，松手停止实况播放
        if (pressTimerRef.current) {
          clearTimeout(pressTimerRef.current);
          pressTimerRef.current = null;
        }
        if (longPressedRef.current) {
          longPressedRef.current = false;
          stopLiveVideo();
        }
        // 水平滑动完成：超过阈值则切换图片，否则回弹
        if (horizontalSwipeRef.current.active) {
          const delta = horizontalSwipeRef.current.delta;
          if (Math.abs(delta) > 50 && count > 1) {
            if (delta < 0) goNext();
            else goPrev();
          } else {
            setOffset({ x: 0, y: 0 });
          }
          horizontalSwipeRef.current.active = false;
          horizontalSwipeRef.current.delta = 0;
        } else if (swipeCloseRef.current.active && swipeCloseRef.current.delta > 110) {
          close();
        } else if (scaleRef.current === MIN_SCALE) {
          setOffset({ x: 0, y: 0 });
        }
        // 双击放大检测：未移动、未长按、最小缩放时判断两次触摸间隔
        if (
          !dragRef.current.moved &&
          !longPressedRef.current &&
          !horizontalSwipeRef.current.active &&
          scaleRef.current === MIN_SCALE
        ) {
          const now = Date.now();
          if (now - lastTapTimeRef.current < 280) {
            // 双击！取消待关闭定时器，切换缩放
            lastTapTimeRef.current = 0;
            if (pendingCloseRef.current) {
              clearTimeout(pendingCloseRef.current);
              pendingCloseRef.current = null;
            }
            // 关闭动画进行中时回滚（pending 已触发但双击仍在窗口内）
            if (closing) cancelClose();
            justDoubleTappedRef.current = true;
            const lastTouch = e.changedTouches[0];
            if (lastTouch) {
              const tx = lastTouch.clientX;
              const ty = lastTouch.clientY;
              requestAnimationFrame(() => {
                toggleZoomAtPoint(tx, ty);
              });
            }
          } else {
            lastTapTimeRef.current = now;
          }
        }
        swipeCloseRef.current.active = false;
        swipeCloseRef.current.delta = 0;
        dragRef.current.dragging = false;
      }
    };

    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchEnd);
    return () => {
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [close, cancelClose, count, goNext, goPrev, toggleZoomAtPoint]);

  // 桌面拖拽（放大时拖拽 + 最小缩放时水平滑动切换）
  useEffect(() => {
    const onMove = (e: globalThis.MouseEvent) => {
      if (!dragRef.current.dragging) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) dragRef.current.moved = true;
      if (horizontalSwipeRef.current.active) {
        horizontalSwipeRef.current.delta = dx;
        const resistance = 0.35;
        setOffset({ x: dx * resistance, y: 0 });
        return;
      }
      setOffset({
        x: dragRef.current.baseX + dx,
        y: dragRef.current.baseY + dy,
      });
    };
    const onUp = () => {
      if (horizontalSwipeRef.current.active) {
        const delta = horizontalSwipeRef.current.delta;
        if (Math.abs(delta) > 80 && count > 1) {
          if (delta < 0) goNext();
          else goPrev();
        } else {
          setOffset({ x: 0, y: 0 });
        }
        horizontalSwipeRef.current.active = false;
        horizontalSwipeRef.current.delta = 0;
      }
      dragRef.current.dragging = false;
      setInteracting(false);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [count, goNext, goPrev]);

  const onMouseDown = (e: ReactMouseEvent<HTMLDivElement>) => {
    revealControls();
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button")) return;
    if (scale <= MIN_SCALE) {
      // 最小缩放时允许水平拖拽切换多图
      if (count <= 1) return;
      setInteracting(true);
      dragRef.current = {
        dragging: true,
        startX: e.clientX,
        startY: e.clientY,
        baseX: offset.x,
        baseY: offset.y,
        moved: false,
      };
      horizontalSwipeRef.current = { active: true, delta: 0 };
      return;
    }
    setInteracting(true);
    dragRef.current = {
      dragging: true,
      startX: e.clientX,
      startY: e.clientY,
      baseX: offset.x,
      baseY: offset.y,
      moved: false,
    };
  };

  const onTouchStart = (e: ReactTouchEvent<HTMLDivElement>) => {
    revealControls();
    if ((e.target as HTMLElement).closest("button")) return;
    setInteracting(true);
    // 移动端长按实况图：单指触摸启动 500ms 定时器
    if (!isDesktop && liveRef.current && e.touches.length === 1) {
      longPressedRef.current = false;
      clearPressTimer();
      pressTimerRef.current = setTimeout(() => {
        longPressedRef.current = true;
        setPlayLive(true);
        setVideoLoaded(false);
      }, 500);
    }
    if (e.touches.length === 2) {
      clearPressTimer(); // 双指缩放取消长按
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      pinchRef.current = {
        active: true,
        startDist: touchDistance(t0, t1),
        startScale: scaleRef.current,
        midX: (t0.clientX + t1.clientX) / 2 - window.innerWidth / 2,
        midY: (t0.clientY + t1.clientY) / 2 - window.innerHeight / 2,
        startOffsetX: offset.x,
        startOffsetY: offset.y,
      };
      dragRef.current.dragging = false;
      swipeCloseRef.current.active = false;
    } else if (e.touches.length === 1) {
      const t = e.touches[0];
      dragRef.current = {
        dragging: true,
        startX: t.clientX,
        startY: t.clientY,
        baseX: offset.x,
        baseY: offset.y,
        moved: false,
      };
      swipeCloseRef.current = { active: scaleRef.current <= MIN_SCALE, delta: 0 };
      horizontalSwipeRef.current = { active: false, delta: 0 };
    }
  };

  // 点击背景关闭（拖拽产生的 click 不关闭）
  const onBgClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (dragRef.current.moved) return;
    if (closing) return;
    // 双击放大后触发的合成 click 不关闭（仅移动端需要）
    if (justDoubleTappedRef.current) {
      justDoubleTappedRef.current = false;
      return;
    }
    if (isDesktop) {
      // 桌面端：立即关闭，双击放大通过 cancelClose 回滚动画
      close();
    } else {
      // 移动端：短暂延迟，给双击放大留出取消窗口
      if (pendingCloseRef.current) clearTimeout(pendingCloseRef.current);
      pendingCloseRef.current = setTimeout(() => {
        pendingCloseRef.current = null;
        close();
      }, 200);
    }
  };

  // 计算 img transform
  let imgTransform: string;
  if (closing && closeTransform) {
    imgTransform = closeTransform;
  } else if (opening) {
    imgTransform = "scale(0.85)";
  } else {
    imgTransform = `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})`;
  }

  const imgOpacity = closing ? 0 : loaded ? 1 : 0;

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={containerRef}
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden select-none"
      style={{
        backgroundColor: "rgba(0,0,0,0.96)",
        opacity: opening ? 0 : closing ? 0 : 1,
        transition: `opacity ${ANIM_MS}ms ease`,
        touchAction: "none",
        WebkitTouchCallout: "none",
        WebkitUserSelect: "none",
        userSelect: "none",
      }}
      onContextMenu={(e) => e.preventDefault()}
      onClick={onBgClick}
      onDoubleClick={(e) => {
        if ((e.target as HTMLElement).closest("button")) return;
        if (pendingCloseRef.current) {
          clearTimeout(pendingCloseRef.current);
          pendingCloseRef.current = null;
        }
        // 关闭动画进行中时回滚（桌面端立即关闭后双击放大可逆转）
        if (closing) cancelClose();
        // justDoubleTappedRef 仅移动端需要（抑制双击后的合成 click）
        if (!isDesktop) justDoubleTappedRef.current = true;
        const cx = e.clientX;
        const cy = e.clientY;
        requestAnimationFrame(() => {
          toggleZoomAtPoint(cx, cy);
        });
      }}
      onTouchStart={onTouchStart}
      onMouseDown={onMouseDown}
    >
      {/* 右上角：关闭 */}
      <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            close();
          }}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm ring-1 ring-white/20 transition-colors hover:bg-black/60"
          aria-label="关闭"
        >
          <X className="h-5 w-5 pointer-events-none" />
        </button>
      </div>

      {/* 计数器（多图） */}
      {count > 1 && (
        <div className="pointer-events-none absolute left-0 right-0 top-3 z-10 text-center text-sm text-white/80">
          {index + 1} / {count}
        </div>
      )}

      {/* 左上角：实况图切换按钮（点击 Live 图标切换播放/暂停） */}
      {live && !closing && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (playLive) {
              stopLiveVideo();
            } else {
              if (videoFadeOutTimerRef.current) {
                clearTimeout(videoFadeOutTimerRef.current);
                videoFadeOutTimerRef.current = null;
              }
              setPlayLive(true);
              setVideoLoaded(false);
            }
            revealControls();
          }}
          className="absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1.5 text-xs font-medium text-white ring-1 ring-white/20 backdrop-blur-sm transition-colors hover:bg-black/70"
          aria-label={playLive ? "停止实况" : "播放实况"}
        >
          <svg
            className={`h-3 w-3 ${!playLive ? "animate-spin [animation-duration:5s]" : ""}`}
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
        </button>
      )}

      {/* 左右箭头（多图，桌面） */}
      {count > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goPrev();
            }}
            className="absolute left-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm ring-1 ring-white/20 transition-colors hover:bg-black/60"
            aria-label="上一张"
          >
            <ChevronLeft className="h-6 w-6 pointer-events-none" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goNext();
            }}
            className="absolute right-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm ring-1 ring-white/20 transition-colors hover:bg-black/60"
            aria-label="下一张"
          >
            <ChevronRight className="h-6 w-6 pointer-events-none" />
          </button>
        </>
      )}

      {/* 实况播放按钮（仅当前图为实况图时显示） */}
      {live && !closing && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (playLive) {
              stopLiveVideo();
            } else {
              if (videoFadeOutTimerRef.current) {
                clearTimeout(videoFadeOutTimerRef.current);
                videoFadeOutTimerRef.current = null;
              }
              setPlayLive(true);
              setVideoLoaded(false);
            }
            revealControls();
          }}
          className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/50 px-4 py-2 text-sm font-medium text-white ring-1 ring-white/20 backdrop-blur-sm transition-colors hover:bg-black/70"
        >
          {!playLive && (
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
            </span>
          )}
          {playLive ? "图片" : "实况"}
        </button>
      )}

      {/* 图片层（始终存在，可缩放/拖拽；实况视频播放时淡出） */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        key={index}
        src={toAbsolute(currentSrc)}
        alt="预览"
        draggable={false}
        onLoad={() => setLoaded(true)}
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
        style={{
          maxWidth: "100vw",
          maxHeight: "100vh",
          objectFit: "contain",
          transform: imgTransform,
          transformOrigin: "center center",
          opacity: playLive && videoLoaded ? 0 : imgOpacity,
          transition: interacting ? "none" : `transform ${ANIM_MS}ms ease, opacity 0.3s ease`,
          willChange: "transform, opacity",
          cursor: scale > MIN_SCALE ? "grab" : "default",
          WebkitTouchCallout: "none",
          WebkitUserSelect: "none",
          userSelect: "none",
        }}
      />

      {/* 实况视频层（叠加在图片上，无控件，播完自动回图片） */}
      {playLive && currentVideo && !closing && (
        <div className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center">
          <video
            ref={videoRef}
            key={`video-${index}`}
            src={toAbsolute(currentVideo)}
            playsInline
            muted={muted}
            className="pointer-events-auto"
            style={{
              maxWidth: "100vw",
              maxHeight: "100vh",
              objectFit: "contain",
              opacity: videoLoaded ? 1 : 0,
              transition: "opacity 0.3s ease",
              WebkitTouchCallout: "none",
              WebkitUserSelect: "none",
              userSelect: "none",
            }}
            onCanPlay={() => setVideoLoaded(true)}
            onLoadedMetadata={() => setVideoLoaded(true)}
            onEnded={() => {
              stopLiveVideo();
            }}
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.preventDefault()}
          />
        </div>
      )}

      {/* 声音开关（视频播放时显示，3秒后自动淡出，触摸重新出现） */}
      {playLive && videoLoaded && !closing && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setMuted((m) => !m);
            revealControls();
          }}
          className="absolute bottom-6 right-6 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white ring-1 ring-white/20 backdrop-blur-sm transition-all duration-300 hover:bg-black/70"
          style={{
            opacity: showControls ? 1 : 0,
            pointerEvents: showControls ? "auto" : "none",
          }}
          aria-label={muted ? "取消静音" : "静音"}
        >
          {muted ? (
            <VolumeX className="h-5 w-5 pointer-events-none" />
          ) : (
            <Volume2 className="h-5 w-5 pointer-events-none" />
          )}
        </button>
      )}
    </div>,
    document.body
  );
}
