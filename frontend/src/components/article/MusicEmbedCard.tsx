"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Music, AlertCircle, ChevronDown, ChevronUp, Loader2, Play, Pause } from "lucide-react";
import type { PostMusic } from "@/lib/mock-data";
import { useMusicPlayer, resolvePostMusicUrl } from "@/lib/music-player-store";
import { getGlobalAudio } from "@/lib/global-audio";
import { toHttps, toAbsoluteUrl } from "@/lib/upload";
import LazyImage from "@/components/LazyImage";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

interface MusicEmbedCardProps {
  music: PostMusic;
  postId: string;
}

function cleanMusicText(s: string): string {
  return s
    .replace(/ - .*?音乐解析$/gi, "")
    .replace(/音乐解析$/gi, "")
    .replace(/@\S+/g, "")
    .replace(/汽水音乐/g, "")
    .replace(/网易云音乐/g, "")
    .replace(/QQ音乐/g, "")
    .replace(/酷狗音乐/g, "")
    .replace(/酷我音乐/g, "")
    .trim();
}

function formatMusicInfo(music: PostMusic): { title: string; subtitle?: string } {
  let name = cleanMusicText(music.name || "");
  let artist = cleanMusicText(music.artist || "");
  if (!artist && name.includes(" - ")) {
    const parts = name.split(" - ");
    name = cleanMusicText(parts[0]);
    artist = cleanMusicText(parts.slice(1).join(" - "));
  }
  if (!name && music.name) name = cleanMusicText(music.name);
  return { title: name || "未知歌曲", subtitle: artist || undefined };
}

function formatTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function MusicEmbedCard({ music, postId }: MusicEmbedCardProps) {
  const activePostId = useMusicPlayer((s) => s.activePostId);
  const isPlaying = useMusicPlayer((s) => s.isPlaying);
  const isLoading = useMusicPlayer((s) => s.isLoading);
  const audioError = useMusicPlayer((s) => s.audioError);
  const setActiveMusic = useMusicPlayer((s) => s.setActive);
  const lyric = useMusicPlayer((s) => s.lyric);
  const currentLyricIndex = useMusicPlayer((s) => s.currentLyricIndex);

  const isThisActive = activePostId === postId;
  const isThisPlaying = isThisActive && isPlaying;
  const isThisLoading = isThisActive && isLoading;
  const isThisError = isThisActive && audioError;
  const info = formatMusicInfo(music);

  const [showFullLyric, setShowFullLyric] = useState(false);
  const [progress, setProgress] = useState(0); // 0-1
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const lyricScrollRef = useRef<HTMLDivElement>(null);
  const autoplayAttempted = useRef(false);

  const handlePlayError = useCallback((err: unknown, context: string) => {
    console.error(`[MusicEmbedCard] ${context}:`, err, "music:", music);
    const st = useMusicPlayer.getState();
    st.setAudioError(true);
    st.setSwitching(false);
    st.setLoading(false);
  }, [music]);

  const startPlayback = useCallback(() => {
    const audio = getGlobalAudio();
    if (!audio) return;

    const playUrl = resolvePostMusicUrl(music);
    if (!playUrl) {
      console.warn("[MusicEmbedCard] resolvePostMusicUrl returned empty for music:", music);
      handlePlayError(new Error("无法解析播放地址"), "no playUrl");
      return;
    }

    setActiveMusic(postId, {
      postId,
      url: playUrl,
      name: music.name,
      artist: music.artist,
      cover: music.cover,
      neteaseId: music.neteaseId || "",
      platform: music.platform,
      musicId: music.musicId,
      songmid: music.songmid,
      extra: music.extra,
      lrc: music.lrc,
    });
    audio.src = playUrl;
    audio.load();
    audio.play().catch((e) => handlePlayError(e, "initial play failed"));
  }, [music, postId, setActiveMusic, handlePlayError]);

  const handleClick = useCallback(() => {
    const audio = getGlobalAudio();
    if (!audio) return;

    if (isThisActive) {
      if (audio.paused) {
        audio.play().catch((e) => handlePlayError(e, "resume play failed"));
      } else {
        audio.pause();
      }
      return;
    }

    startPlayback();
  }, [isThisActive, startPlayback, handlePlayError]);

  // 自动播放
  useEffect(() => {
    if (!music.autoplay || autoplayAttempted.current) return;
    autoplayAttempted.current = true;
    const timer = setTimeout(() => {
      const st = useMusicPlayer.getState();
      if (st.activePostId) return;
      startPlayback();
    }, 200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 监听全局 audio 的进度
  useEffect(() => {
    if (!isThisActive) {
      setProgress(0);
      setCurrentTime(0);
      setDuration(0);
      return;
    }
    const audio = getGlobalAudio();
    if (!audio) return;

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      if (audio.duration > 0) {
        setProgress(Math.min(1, audio.currentTime / audio.duration));
      }
    };
    const onLoadedMeta = () => {
      setDuration(audio.duration);
    };
    const onDurationChange = () => {
      setDuration(audio.duration);
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMeta);
    audio.addEventListener("durationchange", onDurationChange);
    // 立即同步一次
    setCurrentTime(audio.currentTime);
    if (audio.duration > 0) {
      setDuration(audio.duration);
      setProgress(Math.min(1, audio.currentTime / audio.duration));
    }

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMeta);
      audio.removeEventListener("durationchange", onDurationChange);
    };
  }, [isThisActive]);

  // 展开歌词面板时自动滚动到当前行
  useEffect(() => {
    if (!showFullLyric || !lyricScrollRef.current || currentLyricIndex < 0) return;
    const el = lyricScrollRef.current.querySelector<HTMLElement>(
      `[data-lyric-idx="${currentLyricIndex}"]`
    );
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [currentLyricIndex, showFullLyric]);

  const coverSrc = music.cover
    ? toHttps(
        typeof music.cover === "string" && music.cover.startsWith("http")
          ? music.cover
          : `${API_URL.replace("/api", "")}${toAbsoluteUrl(music.cover)}`
      )
    : "";

  const hasLyric = isThisActive && lyric && lyric.length > 0;
  const currentLine =
    hasLyric && currentLyricIndex >= 0
      ? lyric![currentLyricIndex]?.text
      : hasLyric
        ? lyric![0]?.text
        : "";

  const progressPct = Math.round(progress * 100);

  return (
    <div className="group my-4 w-full">
      {/* ===== 高级音乐卡片 ===== */}
      <div
        onClick={handleClick}
        className="relative flex w-full cursor-pointer items-stretch overflow-hidden rounded-[12px] bg-gradient-to-br from-[#fafafa] to-[#f0f0f2] shadow-[0_2px_12px_-4px_rgba(0,0,0,0.1),0_1px_3px_-1px_rgba(0,0,0,0.06)] transition-all duration-300 hover:shadow-[0_6px_24px_-8px_rgba(0,0,0,0.15),0_2px_6px_-2px_rgba(0,0,0,0.08)] active:scale-[0.99] dark:from-[#2a2a30] dark:to-[#222228] dark:shadow-[0_2px_12px_-4px_rgba(0,0,0,0.4),0_1px_3px_-1px_rgba(0,0,0,0.3)]"
      >
        {/* 封面区 + 黑胶唱片效果 */}
        <div className="relative h-[84px] w-[84px] shrink-0 overflow-hidden bg-black/5 dark:bg-white/5 md:h-[96px] md:w-[96px]">
          {/* 黑胶唱片：播放时从右侧滑出旋转 */}
          <div
            className={`absolute top-1/2 left-[60%] z-0 h-[84px] w-[84px] -translate-y-1/2 rounded-full bg-gradient-to-br from-[#1a1a1a] to-[#333] transition-all duration-500 dark:from-[#0a0a0a] dark:to-[#222] md:h-[96px] md:w-[96px] ${
              isThisPlaying
                ? "opacity-100 [animation:vinyl-spin_4s_linear_infinite]"
                : "opacity-0"
            }`}
            style={{
              backgroundImage: `radial-gradient(circle at center, #1a1a1a 30%, #2a2a2a 30%, #2a2a2a 31%, #1a1a1a 31%, #1a1a1a 45%, #333 45%, #333 46%, #1a1a1a 46%)`,
            }}
          >
            {/* 唱片中心圆点 */}
            <div className="absolute top-1/2 left-1/2 h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-[#666] to-[#444] md:h-[22px] md:w-[22px]" />
            <div className="absolute top-1/2 left-1/2 h-[5px] w-[5px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#1a1a1a]" />
          </div>

          {/* 封面图（在唱片上方） */}
          <div className="absolute top-1/2 left-0 z-10 h-full w-full -translate-y-1/2 overflow-hidden">
            {coverSrc ? (
              <LazyImage src={coverSrc} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Music className="h-7 w-7 text-black/30 dark:text-white/30 md:h-8 md:w-8" />
              </div>
            )}
            {/* 底部渐变遮罩，让播放按钮更清晰 */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
          </div>

          {/* 圆形播放/暂停/加载/错误按钮 */}
          <div className="absolute top-1/2 left-1/2 z-20 flex h-[36px] w-[36px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 shadow-lg backdrop-blur-sm transition-transform duration-200 group-hover:scale-105 dark:bg-white/90 md:h-[40px] md:w-[40px]">
            {isThisLoading ? (
              <Loader2 className="h-[18px] w-[18px] animate-spin text-gray-700 md:h-[20px] md:w-[20px]" strokeWidth={2.5} />
            ) : isThisError ? (
              <AlertCircle className="h-[18px] w-[18px] text-red-500 md:h-[20px] md:w-[20px]" strokeWidth={2.5} />
            ) : isThisPlaying ? (
              <Pause className="h-[16px] w-[16px] text-gray-800 md:h-[18px] md:w-[18px]" fill="currentColor" strokeWidth={0} />
            ) : (
              <Play className="h-[16px] w-[16px] translate-x-[1px] text-gray-800 md:h-[18px] md:w-[18px]" fill="currentColor" strokeWidth={0} />
            )}
          </div>
        </div>

        {/* 右侧内容区 */}
        <div className="flex min-w-0 flex-1 flex-col justify-center px-4 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold leading-[21px] text-gray-900 dark:text-white/95 md:text-[16px] md:leading-[22px]">
              {info.title}
            </p>
            {info.subtitle && (
              <p className="mt-0.5 truncate text-[12.5px] leading-[17px] text-gray-500 dark:text-white/50 md:text-[13px] md:leading-[18px]">
                {info.subtitle}
              </p>
            )}
          </div>

          {/* 时间 + 进度条 */}
          {isThisActive && !isThisError && (
            <div className="mt-2 flex items-center gap-2">
              <span className="shrink-0 text-[10.5px] tabular-nums text-gray-400 dark:text-white/40">
                {formatTime(currentTime)}
              </span>
              {/* 进度条 */}
              <div className="relative h-[3px] flex-1 overflow-hidden rounded-full bg-gray-200/70 dark:bg-white/10">
                <div
                  className="absolute top-0 left-0 h-full rounded-full bg-gradient-to-r from-gray-700 to-gray-500 transition-[width] duration-200 ease-linear dark:from-white/80 dark:to-white/60"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <span className="shrink-0 text-[10.5px] tabular-nums text-gray-400 dark:text-white/40">
                {formatTime(duration)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ===== 歌词面板 ===== */}
      {hasLyric && (
        <div className="mt-2">
          {!showFullLyric ? (
            /* 紧凑当前歌词行 */
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowFullLyric(true);
              }}
              className="flex w-full items-center justify-center gap-1.5 rounded-[10px] bg-gradient-to-br from-[#f8f8f8] to-[#f2f2f4] px-4 py-2.5 text-[13px] leading-[18px] text-gray-500 shadow-sm transition-all hover:shadow-md dark:from-[#2a2a30] dark:to-[#25252b] dark:text-white/50"
            >
              <span className="shrink-0 text-gray-400 dark:text-white/40">♪</span>
              <span className="min-w-0 flex-1 truncate text-center font-medium text-gray-600 dark:text-white/70">
                {currentLine || "暂无歌词"}
              </span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-400 dark:text-white/40" />
            </button>
          ) : (
            /* 展开式完整歌词面板 */
            <div className="rounded-[12px] bg-gradient-to-br from-[#f8f8f8] to-[#f2f2f4] p-3 shadow-sm dark:from-[#2a2a30] dark:to-[#25252b]">
              <div
                ref={lyricScrollRef}
                className="max-h-[200px] overflow-y-auto scroll-smooth py-2"
                style={{
                  maskImage: "linear-gradient(transparent, black 12%, black 88%, transparent)",
                  WebkitMaskImage: "linear-gradient(transparent, black 12%, black 88%, transparent)",
                }}
              >
                {lyric!.map((line, i) => (
                  <p
                    key={i}
                    data-lyric-idx={i}
                    className={`px-2 py-[5px] text-center text-[14px] leading-[1.6] transition-all duration-300 ${
                      i === currentLyricIndex
                        ? "scale-[1.02] font-semibold text-gray-900 dark:text-white/95"
                        : "text-gray-400 dark:text-white/35"
                    }`}
                  >
                    {line.text || "♪"}
                  </p>
                ))}
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowFullLyric(false);
                }}
                className="mt-1 flex w-full items-center justify-center gap-1 py-1 text-[11.5px] text-gray-400 transition-colors hover:text-gray-600 dark:text-white/40 dark:hover:text-white/60"
              >
                <ChevronUp className="h-3.5 w-3.5" />
                <span>收起歌词</span>
              </button>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
