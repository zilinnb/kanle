"use client";

import { useEffect, useRef, useCallback } from "react";
import { Music, AlertCircle, Pause } from "lucide-react";
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

  const isThisActive = activePostId === postId;
  const isThisPlaying = isThisActive && isPlaying;
  const isThisLoading = isThisActive && isLoading;
  const isThisError = isThisActive && audioError;
  const info = formatMusicInfo(music);

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

  const coverSrc = music.cover
    ? toHttps(
        typeof music.cover === "string" && music.cover.startsWith("http")
          ? music.cover
          : `${API_URL.replace("/api", "")}${toAbsoluteUrl(music.cover)}`
      )
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
          {/* 播放/暂停按钮 — 仅图标，无外圈背景 */}
          <div className="flex h-8 w-8 shrink-0 items-center justify-center transition-colors">
            {isThisLoading ? (
              <span className="h-3 w-3 rounded-full bg-black/55 animate-pulse dark:bg-white/55" />
            ) : isThisError ? (
              <AlertCircle className="h-4 w-4 text-red-500" />
            ) : isThisPlaying ? (
              <Pause className="h-5 w-5 text-black/75 dark:text-white/75" fill="currentColor" strokeWidth={0} />
            ) : (
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-5 w-5 translate-x-[1px] text-black/75 dark:text-white/75"
              >
                <path d="M8 5.14v13.72c0 .93 1.03 1.5 1.83 1.01l11.3-6.86a1.25 1.25 0 0 0 0-2.14L9.83 4.13A1.25 1.25 0 0 0 8 5.14Z" />
              </svg>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
