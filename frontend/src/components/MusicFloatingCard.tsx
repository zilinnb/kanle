"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Music, Play, Pause, X } from "lucide-react";
import { useMusicPlayer } from "@/lib/music-player-store";
import { getGlobalAudio } from "@/lib/global-audio";
import { getImageUrl } from "@/lib/site-settings-store";
import LazyImage from "./LazyImage";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

function resolveCover(cover: string): string {
  return getImageUrl(cover);
}

/**
 * 全局悬浮音乐卡片：在 layout.tsx 中挂载，跨页面存在。
 * 当 activePostMusic 不为 null 时显示。
 * 支持拖拽（不超出屏幕），位置持久化到 localStorage。
 */
export default function MusicFloatingCard() {
  const activePostMusic = useMusicPlayer((s) => s.activePostMusic);
  const isPlaying = useMusicPlayer((s) => s.isPlaying);
  const isLoading = useMusicPlayer((s) => s.isLoading);
  const clear = useMusicPlayer((s) => s.clear);

  const [mounted, setMounted] = useState(false);
  const [cardPos, setCardPos] = useState({ x: 0, y: 0 });
  const [cardReady, setCardReady] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, startPosX: 0, startPosY: 0, moved: false, dragging: false });

  useEffect(() => {
    setMounted(true);
  }, []);

  // 打开卡片时初始化位置：优先使用上次保存的位置，否则默认左上角
  useEffect(() => {
    if (activePostMusic && !cardReady) {
      const w = 80;
      const h = 112;
      let posX: number;
      let posY: number;
      try {
        const saved = localStorage.getItem("music_card_pos");
        if (saved) {
          const parsed = JSON.parse(saved);
          posX = parsed.x;
          posY = parsed.y;
        } else {
          throw new Error("no saved pos");
        }
      } catch {
        const isDesktop = window.matchMedia("(min-width: 768px)").matches;
        posX = 16;
        posY = isDesktop ? 16 : 72;
      }
      const clampedX = Math.max(8, Math.min(window.innerWidth - w - 8, posX));
      const clampedY = Math.max(8, Math.min(window.innerHeight - h - 8, posY));
      setCardPos({ x: clampedX, y: clampedY });
      setCardReady(true);
    }
    if (!activePostMusic) {
      setCardReady(false);
    }
  }, [activePostMusic, cardReady]);

  // 窗口大小变化时重新约束卡片位置到屏幕内
  useEffect(() => {
    if (!activePostMusic || !cardReady) return;
    const handleResize = () => {
      const w = 80;
      const h = 112;
      setCardPos((prev) => ({
        x: Math.max(8, Math.min(window.innerWidth - w - 8, prev.x)),
        y: Math.max(8, Math.min(window.innerHeight - h - 8, prev.y)),
      }));
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [activePostMusic, cardReady]);

  const onPointerDown = (e: React.PointerEvent) => {
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPosX: cardPos.x,
      startPosY: cardPos.y,
      moved: false,
      dragging: true,
    };
    setDragging(true);
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current.dragging) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      dragRef.current.moved = true;
    }
    const newX = dragRef.current.startPosX + dx;
    const newY = dragRef.current.startPosY + dy;
    const w = 80;
    const h = 112;
    const clampedX = Math.max(8, Math.min(window.innerWidth - w - 8, newX));
    const clampedY = Math.max(8, Math.min(window.innerHeight - h - 8, newY));
    setCardPos({ x: clampedX, y: clampedY });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    dragRef.current.dragging = false;
    setDragging(false);
    if (dragRef.current.moved) {
      try {
        localStorage.setItem("music_card_pos", JSON.stringify(cardPos));
      } catch {
        // ignore
      }
    }
  };

  const handleClose = () => {
    const audio = getGlobalAudio();
    if (audio) {
      audio.pause();
      // 清除 src 并 reset，避免顶栏 togglePlay 复用过期的动态音乐 src
      audio.removeAttribute("src");
      audio.load();
    }
    clear();
  };

  const handlePlayPause = () => {
    const audio = getGlobalAudio();
    if (!audio || !activePostMusic) return;
    if (audio.paused) {
      audio.play().catch((e) => {
        console.error("[MusicFloatingCard] play failed:", e);
        useMusicPlayer.getState().setAudioError(true);
      });
    } else {
      audio.pause();
    }
  };

  if (!mounted || !activePostMusic) return null;

  const coverUrl = resolveCover(activePostMusic.cover || "");

  return createPortal(
    <div
      role="dialog"
      aria-label="音乐播放器"
      style={{
        left: cardPos.x,
        top: cardPos.y,
        transform: dragging ? "scale(1.02)" : "scale(1)",
        touchAction: "none",
      }}
      className="fixed z-[100] w-[80px] select-none overflow-hidden rounded-[6px] shadow-[0_3px_10px_rgba(0,0,0,0.15)] transition-transform duration-150"
    >
      {/* 整张卡片背景：封面图模糊放大铺满，让控制条磨砂后呈现封面颜色 */}
      {coverUrl ? (
        <LazyImage
          src={coverUrl}
          alt=""
          draggable={false}
          className="pointer-events-none absolute inset-0 h-full w-full scale-150 object-cover blur-2xl"
        />
      ) : (
        <div className="absolute inset-0 bg-neutral-800" />
      )}

      {/* 封面区域（可拖拽手柄） */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="relative aspect-square w-full cursor-grab overflow-hidden active:cursor-grabbing"
      >
        {coverUrl ? (
          <LazyImage
            src={coverUrl}
            alt=""
            draggable={false}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Music className="h-5 w-5 text-white/30" />
          </div>
        )}
      </div>

      {/* 底部磨砂控制条 — 播放/暂停 + 关闭 */}
      <div className="relative flex items-center justify-between bg-black/30 px-1.5 py-1 backdrop-blur-xl">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (isLoading) return;
            handlePlayPause();
          }}
          disabled={!activePostMusic.url}
          className="flex h-6 w-6 items-center justify-center text-white/80 outline-none transition-colors active:scale-90 disabled:opacity-40 focus:outline-none"
          aria-label={isLoading ? "加载中" : isPlaying ? "暂停" : "播放"}
        >
          {isLoading ? (
            <span className="h-3 w-3 rounded-full bg-white/90 animate-pulse" />
          ) : isPlaying ? (
            <Pause className="h-3.5 w-3.5" fill="currentColor" />
          ) : (
            <Play className="h-3.5 w-3.5 translate-x-[0.5px]" fill="currentColor" />
          )}
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleClose();
          }}
          className="flex h-6 w-6 items-center justify-center text-white outline-none transition-colors active:scale-90 focus:outline-none"
          aria-label="关闭"
        >
          <X className="h-3.5 w-3.5" strokeWidth={2.5} />
        </button>
      </div>
    </div>,
    document.body
  );
}
