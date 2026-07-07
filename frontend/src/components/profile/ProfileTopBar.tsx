"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Play, Pause, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react";
import { getGlobalAudio } from "@/lib/global-audio";
import { useMusicPlayer } from "@/lib/music-player-store";
import LyricPanel from "@/components/LyricPanel";

interface ProfileTopBarProps {
  coverHeight?: number;
  /** 详情页无 CoverHeader，TopBar 始终不透明 */
  initialBgAlpha?: number;
  /** 背景色来源：bg = 页面背景灰，white = 卡片白（用于文章详情页等白色卡片场景） */
  surfaceColor?: "bg" | "white";
  /** 文章详情页滚动渐变：顶部透明（透出白色卡片=白），下滑渐变为灰色 */
  scrollFade?: boolean;
}

export default function ProfileTopBar({ coverHeight = 300, initialBgAlpha = 0, surfaceColor = "bg", scrollFade = false }: ProfileTopBarProps) {
  const router = useRouter();
  const [bgAlpha, setBgAlpha] = useState(scrollFade ? 0 : initialBgAlpha);
  const coverHeightRef = useRef(coverHeight);

  // 音乐状态从全局 store 读取（由 GlobalMusicManager 管理）
  const isPlaying = useMusicPlayer((s) => s.isPlaying);
  const switching = useMusicPlayer((s) => s.switching);
  const musicUrl = useMusicPlayer((s) => s.musicUrl);
  const musicName = useMusicPlayer((s) => s.musicName);
  const lyric = useMusicPlayer((s) => s.lyric);
  const currentLyric = useMusicPlayer((s) => s.currentLyric);
  const currentLyricIndex = useMusicPlayer((s) => s.currentLyricIndex);
  const showLyricPanel = useMusicPlayer((s) => s.showLyricPanel);
  const muted = useMusicPlayer((s) => s.muted);
  const audioError = useMusicPlayer((s) => s.audioError);
  const musicLoaded = useMusicPlayer((s) => s.musicLoaded);
  const activePostMusic = useMusicPlayer((s) => s.activePostMusic);
  const playlist = useMusicPlayer((s) => s.playlist);
  const currentIndex = useMusicPlayer((s) => s.currentIndex);
  const clearActivePost = useMusicPlayer((s) => s.clear);
  const setShowLyricPanel = useMusicPlayer((s) => s.setShowLyricPanel);
  const setMuted = useMusicPlayer((s) => s.setMuted);
  const switchToTrack = useMusicPlayer((s) => s.switchToTrack);

  useEffect(() => {
    const measure = () => {
      const el = document.querySelector("[data-cover-header]");
      if (el) coverHeightRef.current = el.getBoundingClientRect().height;
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Scroll-based background
  // - surfaceColor="white" 且非 scrollFade：跳过滚动监听，保持白色不透明
  // - scrollFade：文章详情页，基于滚动距离渐变（顶部透明显白，下滑变灰）
  // - 默认：基于 cover avatar 位置计算 alpha
  useEffect(() => {
    if (surfaceColor === "white" && !scrollFade) return;
    let rafId: number | null = null;
    const onScroll = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        if (scrollFade) {
          // 0px = 透明（透出白色卡片 = 白），150px 内渐变为完全灰色
          const root = document.getElementById("scroll-root");
          const rootTop = root ? root.scrollTop : 0;
          const winTop = window.scrollY || 0;
          const top = Math.max(rootTop, winTop);
          setBgAlpha(Math.min(1, Math.max(0, top / 150)));
          return;
        }
        const avatar = document.querySelector("[data-cover-avatar]") as HTMLElement | null;
        const topbar = document.querySelector("[data-topbar]") as HTMLElement | null;
        if (avatar && topbar) {
          const avatarRect = avatar.getBoundingClientRect();
          const topbarBottom = topbar.getBoundingClientRect().bottom;
          const isMobile = window.innerWidth < 768;
          const advance = isMobile ? 150 : 0;
          const fadeStart = topbarBottom + advance;
          const fadeEnd = topbarBottom - avatarRect.height;
          if (avatarRect.top >= fadeStart) setBgAlpha(0);
          else if (avatarRect.top <= fadeEnd) setBgAlpha(1);
          else setBgAlpha(1 - (avatarRect.top - fadeEnd) / (fadeStart - fadeEnd));
        }
      });
    };
    const root = document.getElementById("scroll-root");
    window.addEventListener("scroll", onScroll, { passive: true });
    if (root) root.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    onScroll();
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", onScroll);
      if (root) root.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [surfaceColor, scrollFade]);

  const togglePlay = () => {
    const audio = getGlobalAudio();
    if (!audio || (!musicUrl && !activePostMusic)) return;
    const targetUrl = activePostMusic ? activePostMusic.url : musicUrl;
    // 强守卫：src 缺失或不匹配目标 URL 时重新加载，避免播放过期歌曲
    if (!audio.getAttribute("src") || !audio.src.includes(targetUrl)) {
      audio.src = targetUrl;
    }
    if (audio.paused) audio.play().catch(() => useMusicPlayer.getState().setAudioError(true));
    else audio.pause();
  };

  const toggleMute = () => {
    const audio = getGlobalAudio();
    if (audio) { audio.muted = !muted; setMuted(!muted); }
  };

  const playTrack = (index: number) => {
    const audio = getGlobalAudio();
    const st = useMusicPlayer.getState();
    if (!st.playlist[index] || !audio) return;
    if (st.activePostMusic) clearActivePost();
    const track = st.playlist[index];
    switchToTrack(index);
    audio.src = track.mp3url;
    audio.play().catch(() => useMusicPlayer.getState().setAudioError(true));
  };

  const playNext = () => {
    if (playlist.length === 0) return;
    playTrack((currentIndex + 1) % playlist.length);
  };

  const playPrev = () => {
    if (playlist.length === 0) return;
    playTrack((currentIndex - 1 + playlist.length) % playlist.length);
  };

  const handleBack = () => {
    const el = document.getElementById("profile-content");
    if (el && !el.classList.contains("opacity-0")) {
      el.classList.remove("profile-fade-in");
      el.classList.add("profile-fade-out");
      el.addEventListener(
        "animationend",
        () => {
          if (window.history.length > 1) router.back();
          else router.push("/");
        },
        { once: true }
      );
    } else {
      if (window.history.length > 1) router.back();
      else router.push("/");
    }
  };

  const frosted = bgAlpha > 0.5;
  // scrollFade 模式下背景始终为浅色（白→灰），图标/按钮统一用深色
  const darkUI = scrollFade || frosted;
  const iconClass = darkUI
    ? "text-gray-700 hover:bg-black/5 dark:text-gray-200 dark:hover:bg-white/10"
    : "text-white hover:bg-white/20 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]";

  return (
    <>
      <header data-topbar className="fixed left-1/2 z-50 w-full max-w-[600px] -translate-x-1/2 pointer-events-none top-0 md:top-6">
        <div
          className={`pointer-events-auto ${scrollFade || surfaceColor === "bg" ? "topbar-surface" : "topbar-surface-white"} flex h-12 w-full items-center justify-between px-4 sm:px-5 md:px-6 transition-all duration-300 md:rounded-t-2xl ${
            frosted
              ? "md:shadow-[0_4px_20px_-8px_rgba(0,0,0,0.12)] md:border md:border-wechat-border"
              : "md:border md:border-transparent"
          }`}
          style={{ "--topbar-bg-alpha": bgAlpha, "--topbar-blur": "0px" } as React.CSSProperties}
        >
          {/* Left: back button — Android-style arrow */}
          <button
            type="button"
            onClick={handleBack}
            className={`-ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors sm:-ml-1.5 ${iconClass}`}
            aria-label="返回"
          >
            <ArrowLeft className="h-[22px] w-[22px]" strokeWidth={2.5} />
          </button>

          {/* Right: music player */}
          <div className="flex min-w-0 items-center gap-1.5">
            {(!musicLoaded && !activePostMusic) || switching ? (
              <div className={`flex items-center gap-1.5 rounded-full pl-1 pr-2 ${darkUI ? "bg-black/5 text-gray-700 dark:bg-white/10 dark:text-gray-200" : "bg-white/15 text-white backdrop-blur-sm"}`}>
                <div className="h-7 w-7 shrink-0 animate-pulse rounded-full bg-current/25" />
                <div className="h-2.5 w-14 animate-pulse rounded-full bg-current/25" />
              </div>
            ) : (
              <div className={`flex items-center gap-1.5 rounded-full pl-1 pr-2 transition-colors ${!musicUrl && !activePostMusic ? "opacity-50" : darkUI ? "bg-black/5 text-gray-700 dark:bg-white/10 dark:text-gray-200" : "bg-white/15 text-white backdrop-blur-sm"}`}>
                <button
                  type="button"
                  onClick={togglePlay}
                  disabled={!musicUrl && !activePostMusic}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-black/10 disabled:cursor-not-allowed"
                  aria-label={isPlaying ? "暂停" : "播放"}
                >
                  {isPlaying ? <Pause className="h-3.5 w-3.5" fill="currentColor" /> : <Play className="h-3.5 w-3.5" fill="currentColor" />}
                </button>
                <button
                  type="button"
                  onClick={() => { if (lyric && lyric.length > 0) setShowLyricPanel(true); }}
                  disabled={!lyric || lyric.length === 0}
                  className={`flex min-w-0 max-w-[160px] items-center gap-1 truncate text-[11px] transition-opacity hover:opacity-80 disabled:cursor-default md:max-w-[240px] ${currentLyric ? "font-medium" : ""}`}
                  title={lyric && lyric.length > 0 ? "点击查看歌词" : ""}
                >
                  {currentLyric && (
                    <span className="shrink-0 text-[10px] opacity-60">♪</span>
                  )}
                  <span className="truncate">
                    {!musicUrl && !activePostMusic ? "未设置" : audioError ? "无音乐" : currentLyric ? currentLyric : activePostMusic?.name || musicName || "音乐"}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={toggleMute}
                  disabled={(!musicUrl && !activePostMusic) || audioError}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-black/10 disabled:opacity-40"
                  aria-label={muted ? "取消静音" : "静音"}
                >
                  {muted ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
                </button>
                {!activePostMusic && playlist.length > 1 && (
                  <>
                    <button type="button" onClick={playPrev} className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-black/10" aria-label="上一首">
                      <SkipBack className="h-3 w-3" fill="currentColor" />
                    </button>
                    <button type="button" onClick={playNext} className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-black/10" aria-label="下一首">
                      <SkipForward className="h-3 w-3" fill="currentColor" />
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {showLyricPanel && lyric && lyric.length > 0 && (
        <LyricPanel lines={lyric} currentIndex={currentLyricIndex} onClose={() => setShowLyricPanel(false)} />
      )}
    </>
  );
}
