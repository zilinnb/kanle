"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Music, AlertCircle, ChevronDown, ChevronUp, Pause } from "lucide-react";
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

/**
 * 文章详情页音乐卡片 — 参考首页动态音乐卡片样式（PostCard.tsx）
 * 全宽适配文章正文，点击由全局 audio 接管播放，store.activePostMusic 自动触发悬浮卡片。
 * 歌词面板为文章页增强（默认收起）。
 */
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

  // 自动播放（仅一次，且无其他动态占用时）
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

  // 歌词滚动跟随
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

  return (
    <div className="my-3 w-full">
      {/* ===== 音乐卡片 — 参考首页动态音乐卡片，全宽适配文章正文 ===== */}
      <div
        onClick={handleClick}
        className="flex w-full cursor-pointer items-stretch overflow-hidden rounded-[8px] bg-[#f2f2f2] transition-opacity active:opacity-80 dark:bg-[#2a2a30] md:rounded-[10px]"
      >
        {/* 左侧方形封面 — 与首页一致，无叠加按钮 */}
        <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden bg-black/5 dark:bg-white/5 md:h-[80px] md:w-[80px]">
          {coverSrc ? (
            <LazyImage src={coverSrc} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Music className="h-6 w-6 text-black/30 dark:text-white/30 md:h-7 md:w-7" />
            </div>
          )}
          {/* 活跃时左上角细线指示，避免遮挡封面 */}
          {isThisActive && !isThisError && (
            <span className="absolute top-0 left-0 h-full w-[2px] bg-black/40 dark:bg-white/50" />
          )}
        </div>

        {/* 右侧内容区 — 半透明背景，与首页一致 */}
        <div className="flex min-w-0 flex-1 items-center gap-2 bg-white/35 px-3 dark:bg-white/[0.04] md:px-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-medium leading-[20px] text-black/[0.87] dark:text-white/90 md:text-[15px] md:leading-[21px]">
              {info.title}
            </p>
            {info.subtitle && (
              <p className="truncate text-[12px] leading-[16px] text-black/50 dark:text-white/50 md:text-[13px] md:leading-[17px]">
                {info.subtitle}
              </p>
            )}
          </div>
          {/* 播放/暂停按钮 — 醒目的圆形按钮，位置在右侧 */}
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/[0.06] transition-colors dark:bg-white/[0.1]">
            {isThisLoading ? (
              <span className="h-3 w-3 rounded-full bg-black/55 animate-pulse dark:bg-white/55" />
            ) : isThisError ? (
              <AlertCircle className="h-4 w-4 text-red-500" />
            ) : isThisPlaying ? (
              <Pause className="h-4 w-4 text-black/75 dark:text-white/75" fill="currentColor" strokeWidth={0} />
            ) : (
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-4 w-4 translate-x-[1px] text-black/75 dark:text-white/75"
              >
                <path d="M8 5.14v13.72c0 .93 1.03 1.5 1.83 1.01l11.3-6.86a1.25 1.25 0 0 0 0-2.14L9.83 4.13A1.25 1.25 0 0 0 8 5.14Z" />
              </svg>
            )}
          </div>
        </div>
      </div>

      {/* ===== 歌词面板（文章页增强，默认收起） ===== */}
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
