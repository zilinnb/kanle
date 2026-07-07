"use client";

import { useState, useRef, useEffect } from "react";
import { Play, Pause, SkipBack, RotateCcw, Check } from "lucide-react";

interface LyricEditorProps {
  /** 音频预览地址（上传后的文件 URL 或直链） */
  audioUrl: string;
  /** LRC 文本（可为纯歌词，无时间戳） */
  value: string;
  onChange: (v: string) => void;
}

function formatTime(sec: number): string {
  const mm = String(Math.floor(sec / 60)).padStart(2, "0");
  const ss = String(Math.floor(sec % 60)).padStart(2, "0");
  const xx = String(Math.floor((sec % 1) * 100)).padStart(2, "0");
  return `${mm}:${ss}.${xx}`;
}

const TIME_STAMP_REGEX = /^\[\d{2}:\d{2}\.\d{2,3}\]\s*/;

export default function LyricEditor({ audioUrl, value, onChange }: LyricEditorProps) {
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // 切换音频源时重置状态
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setCurrentLineIndex(0);
  }, [audioUrl]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;
    if (audio.paused) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  };

  // 标记当前行：取当前音频时间，插入到 currentLineIndex 行首
  const markCurrentLine = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const time = audio.currentTime;
    const mm = String(Math.floor(time / 60)).padStart(2, "0");
    const ss = String(Math.floor(time % 60)).padStart(2, "0");
    const xx = String(Math.floor((time % 1) * 100)).padStart(2, "0");
    const stamp = `[${mm}:${ss}.${xx}]`;

    const lines = value.split("\n");
    if (currentLineIndex >= lines.length) return;
    // 移除已有时间戳再插入新的
    lines[currentLineIndex] = lines[currentLineIndex].replace(TIME_STAMP_REGEX, "");
    lines[currentLineIndex] = `${stamp}${lines[currentLineIndex]}`;
    onChange(lines.join("\n"));
    const next = Math.min(currentLineIndex + 1, lines.length);
    setCurrentLineIndex(next);

    // textarea 滚动到下一行附近
    if (textareaRef.current && next < lines.length) {
      const lineHeight = 20;
      textareaRef.current.scrollTop = next * lineHeight;
    }
  };

  const goPrevLine = () => {
    setCurrentLineIndex((i) => Math.max(0, i - 1));
  };

  const resetMarks = () => {
    if (!value) return;
    const lines = value.split("\n").map((l) => l.replace(TIME_STAMP_REGEX, ""));
    onChange(lines.join("\n"));
    setCurrentLineIndex(0);
  };

  // 键盘快捷键：空格播放/暂停，回车标记当前行
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // 仅当 textarea 未聚焦时响应空格（避免冲突）
      if (e.code === "Space" && document.activeElement !== textareaRef.current) {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioUrl]);

  const lineCount = value ? value.split("\n").filter((l) => l.trim()).length : 0;
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="rounded-xl border border-wechat-border bg-wechat-bubble/50 p-3 dark:border-white/10 dark:bg-white/[0.03]">
      {/* 隐藏的音频元素 */}
      <audio
        ref={audioRef}
        src={audioUrl || undefined}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onEnded={() => setIsPlaying(false)}
        preload="metadata"
      />

      {/* 音频预览栏 */}
      <div className="mb-3 flex items-center gap-2">
        <button
          type="button"
          onClick={togglePlay}
          disabled={!audioUrl}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-500 text-white transition-colors hover:bg-green-600 disabled:opacity-40"
          aria-label={isPlaying ? "暂停" : "播放"}
        >
          {isPlaying ? (
            <Pause className="h-4 w-4" fill="currentColor" />
          ) : (
            <Play className="h-4 w-4" fill="currentColor" />
          )}
        </button>
        <span className="shrink-0 text-xs tabular-nums text-wechat-time dark:text-gray-400">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-wechat-border dark:bg-white/10">
          <div
            className="h-full rounded-full bg-green-500 transition-[width] duration-150"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* 行号指示 */}
      <div className="mb-1.5 flex items-center justify-between text-xs text-wechat-time dark:text-gray-400">
        <span>
          当前标记行：第 <span className="font-medium text-green-600 dark:text-green-400">{currentLineIndex + 1}</span> 行 / 共 {lineCount} 行
        </span>
        <span className="text-[10px]">空格=播放/暂停</span>
      </div>

      {/* 歌词文本框 */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={"输入歌词，一行一句\n例如：\n我是一颗小小的石头\n深深的埋在泥土之中"}
        rows={6}
        className="mb-3 w-full resize-y rounded-lg border border-wechat-border bg-white px-3 py-2 font-mono text-xs leading-5 text-wechat-text placeholder:text-wechat-time focus:border-green-400 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:placeholder:text-gray-500"
        spellCheck={false}
      />

      {/* 操作按钮区 */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={markCurrentLine}
          disabled={!audioUrl || currentLineIndex >= lineCount}
          className="flex items-center gap-1.5 rounded-lg bg-green-500 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-green-600 disabled:opacity-40"
        >
          <Check className="h-3.5 w-3.5" />
          标记当前行
        </button>
        <button
          type="button"
          onClick={goPrevLine}
          disabled={currentLineIndex <= 0}
          className="flex items-center gap-1.5 rounded-lg border border-wechat-border bg-white px-3 py-2 text-xs font-medium text-wechat-text transition-colors hover:bg-wechat-bubble disabled:opacity-40 dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"
        >
          <SkipBack className="h-3.5 w-3.5" />
          上一行
        </button>
        <button
          type="button"
          onClick={resetMarks}
          disabled={!value}
          className="flex items-center gap-1.5 rounded-lg border border-wechat-border bg-white px-3 py-2 text-xs font-medium text-wechat-text transition-colors hover:bg-wechat-bubble disabled:opacity-40 dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          重置标记
        </button>
      </div>

      {!audioUrl && (
        <p className="mt-2 text-[11px] text-amber-500 dark:text-amber-400">
          请先上传音频文件或输入音频直链，才能标记时间戳
        </p>
      )}
    </div>
  );
}
