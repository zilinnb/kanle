"use client";

import { useEffect, useRef, useState, useCallback, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { getGlobalAudio } from "@/lib/global-audio";
import { useExitAnimation } from "@/lib/use-exit-animation";

interface LyricLine {
  timeMs: number;
  text: string;
}

interface LyricPanelProps {
  lines: LyricLine[];
  currentIndex: number;
  onClose: () => void;
}

function formatTime(s: number): string {
  if (!s || !isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export default function LyricPanel({ lines, currentIndex, onClose }: LyricPanelProps) {
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [dragTime, setDragTime] = useState<number | null>(null);

  const { closing, handleClose } = useExitAnimation(onClose, 220);

  // 获取 audio 元素并监听事件
  useEffect(() => {
    const audio = getGlobalAudio();
    if (!audio) return;
    audioRef.current = audio;

    const onTimeUpdate = () => {
      if (!draggingRef.current) setCurrentTime(audio.currentTime);
    };
    const onMeta = () => setDuration(audio.duration || 0);

    // 初始化当前值
    setCurrentTime(audio.currentTime);
    setDuration(audio.duration || 0);

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("durationchange", onMeta);
    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("durationchange", onMeta);
    };
  }, []);

  // 计算点击/拖拽位置对应的时间
  const calcTime = useCallback((clientX: number): number => {
    const audio = audioRef.current;
    const el = progressRef.current;
    if (!audio || !el) return 0;
    const rect = el.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return ratio * (audio.duration || 0);
  }, []);

  // pointer 拖拽 seek
  const onPointerDown = useCallback(
    (e: ReactPointerEvent) => {
      e.stopPropagation();
      draggingRef.current = true;
      const t = calcTime(e.clientX);
      setDragTime(t);

      const onMove = (ev: PointerEvent) => {
        setDragTime(calcTime(ev.clientX));
      };
      const onUp = (ev: PointerEvent) => {
        const finalTime = calcTime(ev.clientX);
        if (audioRef.current) {
          audioRef.current.currentTime = finalTime;
          setCurrentTime(finalTime);
        }
        draggingRef.current = false;
        setDragTime(null);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [calcTime]
  );

  // 当前行变化时自动滚动到中央
  useEffect(() => {
    if (currentIndex < 0) return;
    const el = lineRefs.current[currentIndex];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [currentIndex]);

  // Esc 关闭
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleClose]);

  if (typeof document === "undefined") return null;

  const displayTime = dragTime !== null ? dragTime : currentTime;
  const progress = duration > 0 ? (displayTime / duration) * 100 : 0;

  return createPortal(
    <div
      className={`fixed inset-0 z-[90] flex flex-col bg-gradient-to-b from-black/80 via-black/70 to-black/80 backdrop-blur-md ${
        closing ? "animate-overlay-out" : "animate-overlay-in"
      }`}
      onClick={handleClose}
    >
      {/* 顶部关闭栏 */}
      <div className="flex items-center justify-between px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <span className="text-sm font-medium text-white/70">歌词</span>
        <button
          type="button"
          onClick={handleClose}
          className="flex h-8 w-8 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="关闭歌词"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* 歌词滚动区 */}
      <div
        className="flex-1 overflow-y-auto scroll-smooth"
        onClick={(e) => e.stopPropagation()}
        style={{
          maskImage: "linear-gradient(to bottom, transparent 0%, black 20%, black 80%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 20%, black 80%, transparent 100%)",
        }}
      >
        {/* 顶部留白，使第一行能滚到中央 */}
        <div className="h-[40vh]" />

        <div className="space-y-4 px-6">
          {lines.map((line, i) => {
            const isActive = i === currentIndex;
            const text = line.text || "♪";
            return (
              <div
                key={i}
                ref={(el) => { lineRefs.current[i] = el; }}
                className={`text-center transition-all duration-300 ${
                  isActive
                    ? "scale-110 text-lg font-medium text-white opacity-100"
                    : "text-base text-white/40 opacity-100"
                }`}
                style={{
                  transform: isActive ? "scale(1.1)" : "scale(1)",
                }}
              >
                {text}
              </div>
            );
          })}
        </div>

        {/* 底部留白 */}
        <div className="h-[30vh]" />
      </div>

      {/* 底部进度条：可拖拽 seek */}
      <div className="px-6 pb-6 pt-2" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 text-xs text-white/60">
          <span className="tabular-nums w-9 text-right">{formatTime(displayTime)}</span>
          <div
            ref={progressRef}
            onPointerDown={onPointerDown}
            className="group relative h-1.5 flex-1 cursor-pointer rounded-full bg-white/20"
            style={{ touchAction: "none" }}
          >
            <div
              className="absolute left-0 top-0 h-full rounded-full bg-white transition-[width] duration-75"
              style={{ width: `${progress}%` }}
            />
            <div
              className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-md opacity-0 transition-opacity duration-150 group-hover:opacity-100"
              style={{ left: `${progress}%` }}
            />
          </div>
          <span className="tabular-nums w-9">{formatTime(duration)}</span>
        </div>
      </div>
    </div>,
    document.body
  );
}
