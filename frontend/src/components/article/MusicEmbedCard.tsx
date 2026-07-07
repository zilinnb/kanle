"use client";

import { Music, Pause, Play } from "lucide-react";
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

export default function MusicEmbedCard({ music, postId }: MusicEmbedCardProps) {
  const activePostId = useMusicPlayer((s) => s.activePostId);
  const isPlaying = useMusicPlayer((s) => s.isPlaying);
  const isLoading = useMusicPlayer((s) => s.isLoading);
  const setActiveMusic = useMusicPlayer((s) => s.setActive);

  const isThisActive = activePostId === postId;
  const isThisPlaying = isThisActive && isPlaying;
  const isThisLoading = isThisActive && isLoading;
  const info = formatMusicInfo(music);

  const handleClick = () => {
    const audio = getGlobalAudio();
    if (!audio) return;

    if (isThisActive) {
      if (audio.paused) audio.play().catch(() => {});
      else audio.pause();
      return;
    }

    const playUrl = resolvePostMusicUrl(music);
    if (!playUrl) return;

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
    audio.play().catch(() => {});
  };

  const coverSrc = music.cover
    ? toHttps(
        typeof music.cover === "string" && music.cover.startsWith("http")
          ? music.cover
          : `${API_URL.replace("/api", "")}${toAbsoluteUrl(music.cover)}`
      )
    : "";

  return (
    <div
      onClick={handleClick}
      className="my-2 flex w-full max-w-[360px] cursor-pointer items-stretch overflow-hidden rounded-[8px] bg-[#f2f2f2] transition-opacity active:opacity-80 dark:bg-[#2a2a30] md:max-w-[400px]"
    >
      <div className="relative h-[64px] w-[64px] shrink-0 overflow-hidden bg-black/5 dark:bg-white/5 md:h-[72px] md:w-[72px]">
        {coverSrc ? (
          <LazyImage src={coverSrc} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Music className="h-5 w-5 text-black/30 dark:text-white/30" />
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-2 bg-white/35 px-3 dark:bg-white/[0.04]">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-medium leading-[20px] text-black/[0.87] dark:text-white/90 md:text-[15px]">
            {info.title}
          </p>
          {info.subtitle && (
            <p className="truncate text-[12px] leading-[16px] text-black/50 dark:text-white/50 md:text-[13px]">
              {info.subtitle}
            </p>
          )}
        </div>
        {isThisLoading ? (
          <span className="h-3 w-3 shrink-0 animate-pulse rounded-full bg-black/55 dark:bg-white/55" />
        ) : isThisPlaying ? (
          <Pause className="h-3.5 w-3.5 shrink-0 text-black/55 dark:text-white/55" fill="currentColor" />
        ) : (
          <Play className="h-3.5 w-3.5 shrink-0 translate-x-[1px] text-black/55 dark:text-white/55" fill="currentColor" />
        )}
      </div>
    </div>
  );
}
