"use client";

import { useEffect, useRef, useState } from "react";
import { Music, Pause, Play, AlertCircle, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
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

  const handlePlayError = (err: unknown, context: string) => {
    console.error(`[MusicEmbedCard] ${context}:`, err, "music:", music);
    const st = useMusicPlayer.getState();
    st.setAudioError(true);
    st.setSwitching(false);
    st.setLoading(false);
  };

  const startPlayback = () => {
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
  };

  const handleClick = () => {
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
  };

  // 自动播放：进入文章详情页时若 music.autoplay 且无其他活动音乐，自动播放
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

  return (
    <div className="my-2 w-full max-w-[360px] md:max-w-[400px]">
      {/* 音乐卡片 */}
      <div
        onClick={handleClick}
        className="flex w-full cursor-pointer items-stretch overflow-hidden rounded-[8px] bg-[#f2f2f2] transition-opacity active:opacity-80 dark:bg-[#2a2a30]"
      >
        {/* 封面 + 播放按钮叠加 */}
        <div className="relative h-[64px] w-[64px] shrink-0 overflow-hidden bg-black/5 dark:bg-white/5 md:h-[72px] md:w-[72px]">
          {coverSrc ? (
            <LazyImage src={coverSrc} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Music className="h-5 w-5 text-black/30 dark:text-white/30" />
            </div>
          )}
          {/* 半透明遮罩 + 播放/暂停/加载/错误按钮 */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/25">
            {isThisLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-white" strokeWidth={2.5} />
            ) : isThisError ? (
              <AlertCircle className="h-5 w-5 text-red-400" strokeWidth={2.5} />
            ) : isThisPlaying ? (
              <span className="flex items-end gap-[2px]">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-[2.5px] animate-pulse rounded-full bg-white"
                    style={{
                      height: "14px",
                      animationDelay: `${i * 0.15}s`,
                      animationDuration: "0.6s",
                    }}
                  />
                ))}
              </span>
            ) : (
              <Play className="h-6 w-6 translate-x-[1px] text-white drop-shadow-md" fill="currentColor" strokeWidth={0} />
            )}
          </div>
        </div>
        {/* 标题 + 艺术家 */}
        <div className="flex min-w-0 flex-1 items-center bg-white/35 px-3 dark:bg-white/[0.04]">
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
        </div>
      </div>

      {/* 歌词面板 */}
      {hasLyric && (
        <div className="mt-1">
          {!showFullLyric ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowFullLyric(true);
              }}
              className="flex w-full items-center justify-center gap-1 rounded-[6px] bg-[#f2f2f2]/60 px-3 py-1.5 text-[12px] leading-[16px] text-black/45 transition-colors hover:bg-[#f2f2f2] dark:bg-[#2a2a30]/60 dark:text-white/45 dark:hover:bg-[#2a2a30]"
            >
              <span className="min-w-0 flex-1 truncate text-center">
                {currentLine || "♪"}
              </span>
              <ChevronDown className="h-3 w-3 shrink-0" />
            </button>
          ) : (
            <div className="rounded-[8px] bg-[#f2f2f2]/60 p-2 dark:bg-[#2a2a30]/60">
              <div
                ref={lyricScrollRef}
                className="max-h-[160px] overflow-y-auto scroll-smooth py-1"
                style={{
                  maskImage: "linear-gradient(transparent, black 15%, black 85%, transparent)",
                  WebkitMaskImage: "linear-gradient(transparent, black 15%, black 85%, transparent)",
                }}
              >
                {lyric!.map((line, i) => (
                  <p
                    key={i}
                    data-lyric-idx={i}
                    className={`px-2 py-[3px] text-center text-[13px] leading-[1.5] transition-colors duration-200 ${
                      i === currentLyricIndex
                        ? "font-medium text-wechat-link"
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
                className="mt-0.5 flex w-full items-center justify-center gap-1 py-0.5 text-[11px] text-black/35 dark:text-white/35"
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
