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
  const [progress, setProgress] = useState(0);
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
    const onLoadedMeta = () => setDuration(audio.duration);
    const onDurationChange = () => setDuration(audio.duration);

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMeta);
    audio.addEventListener("durationchange", onDurationChange);
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

  useEffect(() => {
    if (!showFullLyric || !lyricScrollRef.current || currentLyricIndex < 0) return;
    const el = lyricScrollRef.current.querySelector<HTMLElement>(
      `[data-lyric-idx="${currentLyricIndex}"]`
    );
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
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
    <div className="my-3 w-full">
      {/* ===== 音乐卡片 — 与首页风格一致，全宽，大播放按钮 ===== */}
      <div
        onClick={handleClick}
        className="flex w-full cursor-pointer items-stretch overflow-hidden rounded-[10px] bg-[#f2f2f2] transition-all duration-200 hover:bg-[#ebebeb] active:scale-[0.997] dark:bg-[#2a2a30] dark:hover:bg-[#33333a] md:rounded-[12px]"
      >
        {/* 封面 + 大播放按钮 */}
        <div className="relative h-[80px] w-[80px] shrink-0 overflow-hidden bg-black/5 dark:bg-white/5 md:h-[88px] md:w-[88px]">
          {/* 黑胶唱片：播放时从右侧滑出旋转 */}
          <div
            className={`absolute top-1/2 left-[55%] z-0 h-[80px] w-[80px] -translate-y-1/2 rounded-full transition-opacity duration-500 md:h-[88px] md:w-[88px] ${
              isThisPlaying ? "opacity-100 [animation:vinyl-spin_4s_linear_infinite]" : "opacity-0"
            }`}
            style={{
              backgroundImage: `radial-gradient(circle at center, #1a1a1a 28%, #2a2a2a 28%, #2a2a2a 29%, #1a1a1a 29%, #1a1a1a 44%, #333 44%, #333 45%, #1a1a1a 45%)`,
            }}
          >
            <div className="absolute top-1/2 left-1/2 h-[16px] w-[16px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-[#666] to-[#444] md:h-[20px] md:w-[20px]" />
            <div className="absolute top-1/2 left-1/2 h-[4px] w-[4px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#1a1a1a]" />
          </div>

          {/* 封面图 */}
          <div className="absolute top-1/2 left-0 z-10 h-full w-full -translate-y-1/2 overflow-hidden">
            {coverSrc ? (
              <LazyImage src={coverSrc} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Music className="h-7 w-7 text-black/30 dark:text-white/30 md:h-8 md:w-8" />
              </div>
            )}
          </div>

          {/* 大圆形播放/暂停按钮 — 居中叠加在封面上 */}
          <div className="absolute top-1/2 left-1/2 z-20 flex h-[40px] w-[40px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow-[0_2px_10px_rgba(0,0,0,0.25)] backdrop-blur-sm transition-transform duration-150 hover:scale-110 active:scale-95 md:h-[44px] md:w-[44px]">
            {isThisLoading ? (
              <Loader2 className="h-[20px] w-[20px] animate-spin text-gray-700 md:h-[22px] md:w-[22px]" strokeWidth={2.5} />
            ) : isThisError ? (
              <AlertCircle className="h-[20px] w-[20px] text-red-500 md:h-[22px] md:w-[22px]" strokeWidth={2.5} />
            ) : isThisPlaying ? (
              <Pause className="h-[18px] w-[18px] text-gray-800 md:h-[20px] md:w-[20px]" fill="currentColor" strokeWidth={0} />
            ) : (
              <Play className="h-[18px] w-[18px] translate-x-[1px] text-gray-800 md:h-[20px] md:w-[20px]" fill="currentColor" strokeWidth={0} />
            )}
          </div>
        </div>

        {/* 右侧内容区 — 与首页一致的半透明背景 */}
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 bg-white/35 px-3 py-2 dark:bg-white/[0.04] md:px-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-medium leading-[20px] text-black/[0.87] dark:text-white/90 md:text-[16px] md:leading-[22px]">
              {info.title}
            </p>
            {info.subtitle && (
              <p className="mt-0.5 truncate text-[12px] leading-[16px] text-black/50 dark:text-white/50 md:text-[13px] md:leading-[17px]">
                {info.subtitle}
              </p>
            )}
          </div>

          {/* 进度条 + 时间（仅活跃时显示） */}
          {isThisActive && !isThisError && (
            <div className="mt-1.5 flex items-center gap-2">
              <span className="shrink-0 text-[10px] tabular-nums text-black/40 dark:text-white/40">
                {formatTime(currentTime)}
              </span>
              <div className="relative h-[3px] flex-1 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                <div
                  className="absolute top-0 left-0 h-full rounded-full bg-black/50 transition-[width] duration-200 ease-linear dark:bg-white/60"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <span className="shrink-0 text-[10px] tabular-nums text-black/40 dark:text-white/40">
                {formatTime(duration)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ===== 歌词面板 ===== */}
      {hasLyric && (
        <div className="mt-1.5">
          {!showFullLyric ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowFullLyric(true);
              }}
              className="flex w-full items-center justify-center gap-1.5 rounded-[8px] bg-[#f2f2f2]/70 px-3 py-2 text-[12.5px] leading-[17px] text-black/45 transition-colors hover:bg-[#f2f2f2] dark:bg-[#2a2a30]/70 dark:text-white/45 dark:hover:bg-[#2a2a30]"
            >
              <span className="shrink-0 text-black/30 dark:text-white/30">♪</span>
              <span className="min-w-0 flex-1 truncate text-center font-medium text-black/55 dark:text-white/65">
                {currentLine || "暂无歌词"}
              </span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-black/30 dark:text-white/30" />
            </button>
          ) : (
            <div className="rounded-[8px] bg-[#f2f2f2]/70 p-2 dark:bg-[#2a2a30]/70">
              <div
                ref={lyricScrollRef}
                className="max-h-[180px] overflow-y-auto scroll-smooth py-1"
                style={{
                  maskImage: "linear-gradient(transparent, black 12%, black 88%, transparent)",
                  WebkitMaskImage: "linear-gradient(transparent, black 12%, black 88%, transparent)",
                }}
              >
                {lyric!.map((line, i) => (
                  <p
                    key={i}
                    data-lyric-idx={i}
                    className={`px-2 py-[4px] text-center text-[13.5px] leading-[1.6] transition-all duration-300 ${
                      i === currentLyricIndex
                        ? "font-semibold text-black/85 dark:text-white/90"
                        : "text-black/35 dark:text-white/35"
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
                className="mt-0.5 flex w-full items-center justify-center gap-1 py-1 text-[11px] text-black/35 dark:text-white/35"
              >
                <ChevronUp className="h-3 w-3" />
                <span>收起</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
