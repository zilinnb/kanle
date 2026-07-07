"use client";

import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { SkipBack, SkipForward, ListMusic, X } from "lucide-react";
import { getGlobalAudio } from "@/lib/global-audio";
import { useMusicPlayer, type PostMusicInfo } from "@/lib/music-player-store";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
const AUDIO_BASE = API_URL.replace("/api", "");

function toAbsolute(url: string): string {
  if (!url || typeof url !== "string") return "";
  return url.startsWith("http") ? url : `${AUDIO_BASE}${url}`;
}

export default function AdminMusicPlayer() {
  const activePostMusic = useMusicPlayer((s) => s.activePostMusic);
  const bgMusic = useMusicPlayer((s) => s.bgMusic);
  const setBgMusic = useMusicPlayer((s) => s.setBgMusic);
  const isPlaying = useMusicPlayer((s) => s.isPlaying);
  const isLoading = useMusicPlayer((s) => s.isLoading);
  const currentLyric = useMusicPlayer((s) => s.currentLyric);

  const [playlist, setPlaylist] = useState<PostMusicInfo[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [mounted, setMounted] = useState(false);
  const fetchedRef = useRef(false);

  const currentTrack = activePostMusic || bgMusic;
  const isPostMusic = !!activePostMusic;
  const hasPlaylist = !isPostMusic && playlist.length > 1;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || fetchedRef.current) return;
    fetchedRef.current = true;
    fetch(`${API_URL}/music`)
      .then((res) => (res.ok ? res.json() : {}))
      .then((data: {
        mp3url?: string;
        name?: string;
        id?: string;
        lyric?: string;
        platform?: string;
        playlist?: Array<{
          id: string;
          name: string;
          artist: string;
          cover: string;
          mp3url: string;
          lyric: string;
          platform?: string;
          extra?: Record<string, any>;
        }>;
        currentIndex?: number;
      }) => {
        if (data.mp3url) {
          setBgMusic({
            postId: "bg-music",
            url: toAbsolute(data.mp3url),
            name: data.name || "",
            artist: "",
            cover: "",
            neteaseId: data.id || "",
            platform: data.platform,
            musicId: data.id,
            lrc: data.lyric,
          });
        }
        if (Array.isArray(data.playlist) && data.playlist.length > 0) {
          const mapped: PostMusicInfo[] = data.playlist.map((t, i) => ({
            postId: `bg-music-${i}`,
            url: toAbsolute(t.mp3url),
            name: t.name || "",
            artist: t.artist || "",
            cover: t.cover || "",
            neteaseId: t.id || "",
            platform: t.platform,
            musicId: t.id,
            lrc: t.lyric,
            extra: t.extra,
          }));
          setPlaylist(mapped);
          setCurrentIndex(data.currentIndex || 0);
        }
      })
      .catch(() => {});
  }, [mounted, setBgMusic]);

  const playTrack = (track: PostMusicInfo, index: number) => {
    const audio = getGlobalAudio();
    if (!audio) return;
    setCurrentIndex(index);
    setBgMusic(track);
    audio.src = track.url;
    audio.play().catch(() => {});
    setShowPlaylist(false);
  };

  const togglePlay = () => {
    const audio = getGlobalAudio();
    if (!audio || !currentTrack) return;
    if (!audio.src || !audio.src.includes(currentTrack.url)) {
      audio.src = currentTrack.url;
    }
    if (audio.paused) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  };

  const skipNext = () => {
    if (playlist.length === 0) return;
    const next = (currentIndex + 1) % playlist.length;
    playTrack(playlist[next], next);
  };

  const skipPrev = () => {
    if (playlist.length === 0) return;
    const prev = (currentIndex - 1 + playlist.length) % playlist.length;
    playTrack(playlist[prev], prev);
  };

  // 自动播放下一首
  useEffect(() => {
    const audio = getGlobalAudio();
    if (!audio) return;
    const onEnded = () => {
      if (activePostMusic) return;
      if (playlist.length === 0) return;
      const next = (currentIndex + 1) % playlist.length;
      setTimeout(() => playTrack(playlist[next], next), 0);
    };
    audio.addEventListener("ended", onEnded);
    return () => audio.removeEventListener("ended", onEnded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePostMusic, playlist, currentIndex]);

  if (!currentTrack) return null;

  const displayName = currentLyric || currentTrack.name;

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <button
        onClick={togglePlay}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-adm-primary text-adm-primary-text"
        aria-label={isPlaying ? "暂停" : "播放"}
      >
        {isLoading ? (
          <span className="h-3 w-3 rounded-full border-[1.5px] border-adm-primary-text border-t-transparent animate-spin" />
        ) : isPlaying ? (
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
        ) : (
          <svg className="ml-0.5 h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
        )}
      </button>

      {hasPlaylist && (
        <button
          onClick={skipPrev}
          className="hidden h-6 w-6 shrink-0 items-center justify-center rounded text-adm-text-secondary transition-colors hover:text-adm-text md:flex"
          aria-label="上一首"
        >
          <SkipBack className="h-3.5 w-3.5" />
        </button>
      )}
      {hasPlaylist && (
        <button
          onClick={skipNext}
          className="hidden h-6 w-6 shrink-0 items-center justify-center rounded text-adm-text-secondary transition-colors hover:text-adm-text md:flex"
          aria-label="下一首"
        >
          <SkipForward className="h-3.5 w-3.5" />
        </button>
      )}

      <span className="min-w-0 max-w-[100px] truncate text-xs text-adm-text-secondary md:max-w-[200px]">
        {displayName}
      </span>

      {!isPostMusic && playlist.length > 0 && (
        <button
          onClick={() => setShowPlaylist(!showPlaylist)}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-adm-text-secondary transition-colors hover:text-adm-text"
          aria-label="歌单"
        >
          <ListMusic className="h-3.5 w-3.5" />
        </button>
      )}

      {showPlaylist && mounted && createPortal(
        <div className="fixed inset-0 z-50" onClick={() => setShowPlaylist(false)}>
          <div
            className="absolute right-4 top-14 max-h-80 w-72 overflow-y-auto rounded-xl border border-adm-border bg-adm-card shadow-lg md:right-6 md:top-16"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-adm-border px-4 py-2.5">
              <span className="text-sm font-semibold text-adm-text">播放列表</span>
              <button onClick={() => setShowPlaylist(false)} className="text-adm-text-tertiary transition-colors hover:text-adm-text">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="py-1">
              {playlist.map((track, i) => (
                <button
                  key={i}
                  onClick={() => playTrack(track, i)}
                  className={`flex w-full items-center gap-2 px-4 py-2 text-left text-sm transition-colors hover:bg-adm-card-hover ${
                    i === currentIndex && !isPostMusic ? "text-adm-primary" : "text-adm-text-secondary"
                  }`}
                >
                  <span className="w-4 shrink-0 text-center text-xs">
                    {i === currentIndex && !isPostMusic && isPlaying ? "♪" : i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{track.name}</span>
                  {track.artist && <span className="shrink-0 text-xs text-adm-text-tertiary">{track.artist}</span>}
                </button>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
