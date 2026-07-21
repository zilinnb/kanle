"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  User,
  UserRound,
  Contact,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  BookUser,
  X,
  Volume2,
  VolumeX,
  Camera,
  Lock,
  Eye,
  EyeOff,
  ImagePlus,
  Trash2,
  Film,
  Video,
  LogOut,
  MapPin,
  Music,
  Upload,
  ChevronRight,
  ExternalLink,
  LayoutDashboard,
  Pencil,
  Heart,
  MessageSquare,
  Megaphone,
  Library,
  Check,
  MoreVertical,
  Rss,
} from "lucide-react";
import { cravatarUrl } from "@/lib/avatar";
import { getGlobalAudio } from "@/lib/global-audio";
import { useMusicPlayer } from "@/lib/music-player-store";
import { Post, MUSIC_PLUGIN_LABELS, type PostLocation, type PostImage, type PostVideo, type PostDouban } from "@/lib/mock-data";
import { isLivePhoto, getImageSrc } from "@/lib/post-image";
import { uploadImage, toHttps } from "@/lib/upload";
import { getImageUrl, useSiteSettings } from "@/lib/site-settings-store";
import { useExitAnimation } from "@/lib/use-exit-animation";
import RichTextEditor from "./RichTextEditor";
import LazyImage from "./LazyImage";
import LocationPicker from "./LocationPicker";
import LyricEditor from "./LyricEditor";
import LyricPanel from "./LyricPanel";
import MediaPicker, { type PickerMediaItem } from "./MediaPicker";
import DoubanPicker from "./DoubanPicker";
import DoubanEmbedCard from "./article/DoubanEmbedCard";
import DoubanSidebar from "./DoubanSidebar";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
const AUDIO_BASE = API_URL.replace("/api", "");

/** 插件 platform 名 → 对应的真实音乐平台名（复用 mock-data 统一口径） */
const PLATFORM_MAP = MUSIC_PLUGIN_LABELS;

function toAbsolute(url: string): string {
  if (!url || typeof url !== "string") return "";
  return url.startsWith("http") ? url : `${AUDIO_BASE}${url}`;
}

interface TopBarProps {
  coverHeight?: number;
}

interface FriendLink {
  id: string;
  name: string;
  url: string;
  desc: string;
  email: string;
  avatar: string;
}

interface RssArticleItem {
  id: string;
  sourceId: string;
  title: string;
  link: string;
  desc: string;
  author: string;
  thumbnail: string;
  pubDate: string;
  guid: string;
  source?: { id: string; name: string; avatar: string; url: string };
}

/** 解析友链头像：avatar 优先（邮箱→Cravatar，链接/上传→原值），为空回退 email */
function resolveFriendAvatar(link: { avatar?: string; email?: string }, size = 96): string {
  const avatar = (link.avatar || "").trim();
  if (avatar) {
    if (!avatar.startsWith("http") && avatar.includes("@")) {
      return cravatarUrl(avatar, size);
    }
    return getImageUrl(avatar);
  }
  const email = (link.email || "").trim();
  if (email) return cravatarUrl(email, size);
  return "";
}

/** 解析 RSS 订阅源头像：邮箱→Cravatar，链接/上传→绝对 URL，为空返回空 */
function resolveRssSourceAvatar(source: { avatar?: string }, size = 96): string {
  const avatar = (source.avatar || "").trim();
  if (!avatar) return "";
  if (!avatar.startsWith("http") && avatar.includes("@")) {
    return cravatarUrl(avatar, size);
  }
  return getImageUrl(avatar);
}

export interface LoggedInUser {
  token: string;
  nickname: string;
  email: string;
  avatar: string;
  cover: string;
  bio: string;
  website: string;
}

export default function TopBar({ coverHeight = 300 }: TopBarProps) {
  const router = useRouter();
  const [scrollProgress, setScrollProgress] = useState(0);
  const [bgAlpha, setBgAlpha] = useState(0);
  const [showFriends, setShowFriends] = useState(false);
  const [friendsTab, setFriendsTab] = useState<"friends" | "douban" | "rss">("friends");
  const friendsAnim = useExitAnimation(() => setShowFriends(false), 250);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const coverHeightRef = useRef(coverHeight);
  useEffect(() => {
    const measure = () => {
      const el = document.querySelector("[data-cover-header]");
      if (el) coverHeightRef.current = el.getBoundingClientRect().height;
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  const [showLogin, setShowLogin] = useState(false);
  const [showPublish, setShowPublish] = useState(false);

  // Music player — 从全局 store 读取状态（由 GlobalMusicManager 管理）
  const isPlaying = useMusicPlayer((s) => s.isPlaying);
  const isLoading = useMusicPlayer((s) => s.isLoading);
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

  // Logged-in state
  const [loggedIn, setLoggedIn] = useState<LoggedInUser | null>(null);

  const [friendLinks, setFriendLinks] = useState<FriendLink[]>([]);
  const [friendsPage, setFriendsPage] = useState(1);
  const [friendsHasMore, setFriendsHasMore] = useState(false);
  const [friendsLoadingMore, setFriendsLoadingMore] = useState(false);
  const [friendsLoaded, setFriendsLoaded] = useState(false);
  const friendsSentinelRef = useRef<HTMLDivElement>(null);
  const friendsLoadingRef = useRef(false);

  // 豆瓣数据预检查：用于决定是否显示"影单"tab和友链按钮
  const [hasDouban, setHasDouban] = useState(false);
  const [doubanLoaded, setDoubanLoaded] = useState(false);

  // 友圈（RSS）文章数据
  const [rssArticles, setRssArticles] = useState<RssArticleItem[]>([]);
  const [rssPage, setRssPage] = useState(1);
  const [rssHasMore, setRssHasMore] = useState(false);
  const [rssLoadingMore, setRssLoadingMore] = useState(false);
  const [rssLoaded, setRssLoaded] = useState(false);
  const rssSentinelRef = useRef<HTMLDivElement>(null);
  const rssLoadingRef = useRef(false);

  // Fetch friend links + douban existence check（音乐数据由 GlobalMusicManager 全局管理）
  useEffect(() => {
    fetch(`${API_URL}/friends`)
      .then((res) => (res.ok ? res.json() : { data: [], pagination: { hasMore: false } }))
      .then((data: { data: FriendLink[]; pagination?: { hasMore: boolean } }) => {
        setFriendLinks(data.data || []);
        setFriendsHasMore(false);
      })
      .catch(() => {})
      .finally(() => setFriendsLoaded(true));

    // 轻量检查豆瓣是否有数据（只取 typeCounts，limit=1）
    fetch(`${API_URL}/douban?type=movie&status=all&page=1&limit=1`)
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (d?.typeCounts) {
          const total = d.typeCounts.movie + d.typeCounts.book + d.typeCounts.music;
          setHasDouban(total > 0);
        }
      })
      .catch(() => {})
      .finally(() => setDoubanLoaded(true));
  }, []);

  // 友链分页：加载更多
  const loadMoreFriends = useCallback(async () => {
    if (friendsLoadingRef.current || !friendsHasMore) return;
    friendsLoadingRef.current = true;
    setFriendsLoadingMore(true);
    const nextPage = friendsPage + 1;
    try {
      const res = await fetch(`${API_URL}/friends?page=${nextPage}&limit=10`);
      const data = await res.json();
      if (Array.isArray(data.data)) {
        setFriendLinks((prev) => [...prev, ...data.data]);
        setFriendsHasMore(data.pagination?.hasMore || false);
        setFriendsPage(nextPage);
      }
    } catch {
      // ignore
    } finally {
      setFriendsLoadingMore(false);
      friendsLoadingRef.current = false;
    }
  }, [friendsPage, friendsHasMore]);

  // IntersectionObserver：友链弹窗滚动到底部自动加载更多
  useEffect(() => {
    if (!showFriends || !friendsSentinelRef.current) return;
    const sentinel = friendsSentinelRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMoreFriends();
      },
      { rootMargin: "50px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMoreFriends, showFriends, friendsTab]);

  // 影单 tab 被隐藏时（豆瓣无数据），自动切回友链 tab
  useEffect(() => {
    if (friendsTab === "douban" && doubanLoaded && !hasDouban) {
      setFriendsTab("friends");
    }
  }, [friendsTab, doubanLoaded, hasDouban]);

  // 友圈（RSS）首次加载 — 弹窗打开时触发
  const loadRssFirst = useCallback(async () => {
    if (rssLoaded) return;
    try {
      const res = await fetch(`${API_URL}/rss/articles?page=1&limit=20`);
      const data = await res.json();
      if (Array.isArray(data.data)) {
        setRssArticles(data.data);
        setRssHasMore(data.pagination?.hasMore || false);
        setRssPage(1);
      }
    } catch {
      // ignore
    } finally {
      setRssLoaded(true);
    }
  }, [rssLoaded]);

  // 友圈分页：加载更多
  const loadMoreRss = useCallback(async () => {
    if (rssLoadingRef.current || !rssHasMore) return;
    rssLoadingRef.current = true;
    setRssLoadingMore(true);
    const nextPage = rssPage + 1;
    try {
      const res = await fetch(`${API_URL}/rss/articles?page=${nextPage}&limit=20`);
      const data = await res.json();
      if (Array.isArray(data.data)) {
        setRssArticles((prev) => [...prev, ...data.data]);
        setRssHasMore(data.pagination?.hasMore || false);
        setRssPage(nextPage);
      }
    } catch {
      // ignore
    } finally {
      setRssLoadingMore(false);
      rssLoadingRef.current = false;
    }
  }, [rssPage, rssHasMore]);

  // IntersectionObserver：友圈滚动到底部自动加载更多
  useEffect(() => {
    if (!showFriends || friendsTab !== "rss" || !rssSentinelRef.current) return;
    const sentinel = rssSentinelRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMoreRss();
      },
      { rootMargin: "50px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMoreRss, showFriends, friendsTab]);

  // 弹窗打开时首次加载 RSS
  useEffect(() => {
    if (showFriends && friendsTab === "rss") {
      loadRssFirst();
    }
  }, [showFriends, friendsTab, loadRssFirst]);

  // 点击菜单外部关闭三点菜单
  useEffect(() => {
    if (!showUserMenu) return;
    const onClickAway = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener("mousedown", onClickAway);
    return () => document.removeEventListener("mousedown", onClickAway);
  }, [showUserMenu]);

  // audio 事件绑定、歌词 fetch、onEnded 切歌逻辑由 GlobalMusicManager 全局管理

  useEffect(() => {
    let rafId: number | null = null;
    const onScroll = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const y = Math.max(root?.scrollTop || 0, window.scrollY || 0);
        const refHeight = coverHeightRef.current;
        setScrollProgress(Math.min(1, Math.max(0, y / refHeight)));

        // Background opacity based on avatar position relative to top bar.
        // Fades in as the top bar starts covering the avatar, fully opaque
        // once the avatar is completely hidden behind the bar.
        // Mobile: advance 120px so bg appears earlier
        const avatar = document.querySelector("[data-cover-avatar]") as HTMLElement | null;
        const topbar = document.querySelector("[data-topbar]") as HTMLElement | null;
        if (avatar && topbar) {
          const avatarRect = avatar.getBoundingClientRect();
          const topbarBottom = topbar.getBoundingClientRect().bottom;
          const isMobile = window.innerWidth < 768;
          const advance = isMobile ? 150 : 0;
          const fadeStart = topbarBottom + advance;
          const fadeEnd = topbarBottom - avatarRect.height;
          if (avatarRect.top >= fadeStart) {
            setBgAlpha(0);
          } else if (avatarRect.top <= fadeEnd) {
            setBgAlpha(1);
          } else {
            setBgAlpha(1 - (avatarRect.top - fadeEnd) / (fadeStart - fadeEnd));
          }
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
  }, [coverHeight]);

  // Restore login from localStorage
  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    const nickname = localStorage.getItem("admin_nickname");
    const email = localStorage.getItem("admin_email") || "";
    const avatar = localStorage.getItem("admin_avatar") || "";
    const cover = localStorage.getItem("admin_cover") || "";
    const bio = localStorage.getItem("admin_bio") || "";
    const website = localStorage.getItem("admin_website") || "";
    if (token && nickname) {
      setLoggedIn({ token, nickname, email, avatar, cover, bio, website });
    }
  }, []);

  const togglePlay = () => {
    const audio = getGlobalAudio();
    if (!audio || (!musicUrl && !activePostMusic)) return;
    const targetUrl = activePostMusic ? activePostMusic.url : musicUrl;
    if (audio.paused) {
      // 强守卫：src 缺失或不匹配目标 URL 时重新加载，避免播放过期歌曲
      if (!audio.getAttribute("src") || !audio.src.includes(targetUrl)) {
        audio.src = targetUrl;
      }
      audio.play().catch(() => useMusicPlayer.getState().setAudioError(true));
    } else {
      audio.pause();
    }
  };

  const toggleMute = () => {
    const audio = getGlobalAudio();
    if (audio) {
      audio.muted = !muted;
      setMuted(!muted);
    }
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
    const next = (currentIndex + 1) % playlist.length;
    playTrack(next);
  };

  const playPrev = () => {
    if (playlist.length === 0) return;
    const prev = (currentIndex - 1 + playlist.length) % playlist.length;
    playTrack(prev);
  };

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_nickname");
    localStorage.removeItem("admin_email");
    localStorage.removeItem("admin_avatar");
    localStorage.removeItem("admin_cover");
    localStorage.removeItem("admin_bio");
    localStorage.removeItem("admin_website");
    setLoggedIn(null);
    window.location.reload();
  };

  // Background opacity is driven by bgAlpha state (computed from avatar
  // position in the scroll handler above). Fades in exactly when the top
  // bar starts covering the avatar — works identically on mobile & desktop.
  const blur = "0px";
  const frosted = bgAlpha > 0.5;

  // Icon color helper
  const iconClass = frosted
    ? "text-gray-700 hover:bg-black/5 dark:text-gray-200 dark:hover:bg-white/10"
    : "text-white hover:bg-white/20 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]";

  return (
    <>
      {/* Fixed wrapper — no background, just positioning.
          pointer-events-none so the transparent side areas (desktop) don't
          block clicks on the page below; the inner card re-enables events. */}
      <header data-topbar className="fixed left-1/2 z-50 w-full max-w-[600px] -translate-x-1/2 pointer-events-none top-0 md:top-6">
        {/* Inner card-width container — solid floating card fixed at top-6.
            No spacer, no mask — the 24px gap above is just the page background. */}
        <div
          className={`pointer-events-auto topbar-surface flex h-12 w-full items-center justify-between px-4 sm:px-5 md:px-6 transition-all duration-300 md:rounded-t-2xl ${
            frosted
              ? "md:shadow-[0_4px_20px_-8px_rgba(0,0,0,0.12)] md:border md:border-wechat-border"
              : "md:border md:border-transparent"
          }`}
          style={{
            "--topbar-bg-alpha": bgAlpha,
            "--topbar-blur": blur,
          } as React.CSSProperties}
          onDoubleClick={(e) => {
            // 双击顶栏空白区域返回顶部（双击按钮不触发）
            if ((e.target as HTMLElement).closest("button")) return;
            const root = document.getElementById("scroll-root");
            if (root && root.scrollTop > 0) {
              root.scrollTo({ top: 0, behavior: "smooth" });
            } else {
              window.scrollTo({ top: 0, behavior: "smooth" });
            }
          }}
        >
          {/* Left: music player + lyric (mobile: full width, desktop: same) */}
          {/* 后端未配置歌单时隐藏整个音乐区域（activePostMusic 仍可接管播放） */}
          {(!musicLoaded || musicUrl || playlist.length > 0 || activePostMusic) && (
          <div className="flex min-w-0 items-center gap-1.5">
            {/* Music player + lyric */}
            {!musicLoaded || switching ? (
              // 骨架占位：脉冲动画，避免"加载中"文字闪烁
              <div
                className={`flex items-center gap-1.5 rounded-full pl-1 pr-2 ${
                  frosted
                    ? "bg-black/5 text-gray-700 dark:bg-white/10 dark:text-gray-200"
                    : "bg-white/15 text-white backdrop-blur-sm"
                }`}
              >
                <div className="h-7 w-7 shrink-0 animate-pulse rounded-full bg-current/25" />
                <div className="h-2.5 w-14 animate-pulse rounded-full bg-current/25" />
              </div>
            ) : (
              <div
                className={`flex items-center gap-1.5 rounded-full pl-1 pr-2 transition-colors ${
                  !musicUrl && !activePostMusic
                    ? "opacity-50"
                    : frosted
                      ? "bg-black/5 text-gray-700 dark:bg-white/10 dark:text-gray-200"
                      : "bg-white/15 text-white backdrop-blur-sm"
                }`}
              >
                <button
                  type="button"
                  onClick={togglePlay}
                  disabled={!musicUrl && !activePostMusic}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-black/10 disabled:cursor-not-allowed"
                  aria-label={isPlaying ? "暂停" : "播放"}
                >
                  {isPlaying ? (
                    <Pause className="h-3.5 w-3.5" fill="currentColor" />
                  ) : (
                    <Play className="h-3.5 w-3.5" fill="currentColor" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (lyric && lyric.length > 0) setShowLyricPanel(true);
                  }}
                  disabled={!lyric || lyric.length === 0}
                  className={`flex min-w-0 max-w-[180px] items-center truncate text-[11px] transition-opacity hover:opacity-80 disabled:cursor-default md:max-w-[260px] ${currentLyric ? "font-medium" : ""}`}
                  title={lyric && lyric.length > 0 ? "点击查看歌词" : ""}
                >
                  <span className="truncate">
                    {!musicUrl && !activePostMusic
                      ? "未设置"
                      : audioError
                        ? "无音乐"
                        : currentLyric
                          ? currentLyric
                          : activePostMusic?.name || musicName || "音乐"}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={toggleMute}
                  disabled={(!musicUrl && !activePostMusic) || audioError}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-black/10 disabled:opacity-40"
                  aria-label={muted ? "取消静音" : "静音"}
                >
                  {muted ? (
                    <VolumeX className="h-3 w-3" />
                  ) : (
                    <Volume2 className="h-3 w-3" />
                  )}
                </button>
                {/* 歌单模式才显示上一首/下一首；动态音乐接管时隐藏 */}
                {!activePostMusic && playlist.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={playPrev}
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-black/10"
                      aria-label="上一首"
                    >
                      <SkipBack className="h-3 w-3" fill="currentColor" />
                    </button>
                    <button
                      type="button"
                      onClick={playNext}
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-black/10"
                      aria-label="下一首"
                    >
                      <SkipForward className="h-3 w-3" fill="currentColor" />
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
          )}

          {/* Right: friends + publish/login */}
          <div className="flex shrink-0 items-center gap-1.5">
            {/* 友链按钮：移动端显示，桌面端用 Sidebar 中的友链/友圈切换 */}
            {((!friendsLoaded || !doubanLoaded) || friendLinks.length > 0 || hasDouban) && (
            <button
              type="button"
              onClick={() => { setFriendsTab(friendLinks.length === 0 && hasDouban ? "douban" : "friends"); setShowUserMenu(false); setShowFriends(true); }}
              className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors md:hidden ${iconClass}`}
              aria-label="友链"
            >
              <Contact className="h-[18px] w-[18px]" />
            </button>
            )}

            {/* Camera (发布动态) — 移动端最右侧，仅登录后显示 */}
            {loggedIn && (
              <button
                type="button"
                onClick={() => setShowPublish(true)}
                className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors lg:hidden ${iconClass}`}
                aria-label="发布动态"
              >
                <Camera className="h-[18px] w-[18px]" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ===== Login Modal ===== */}
      {showLogin && (
        <LoginModal
          onClose={() => setShowLogin(false)}
          onSuccess={(user) => {
            setLoggedIn(user);
            // 不立即关闭弹窗，由 LoginModal 内部 handleClose 播放退出动画后再 onClose
            const reload = () => window.location.reload();
            if (user.email && user.nickname) {
              fetch(`${API_URL}/posts/likes/update-name`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ email: user.email, newName: user.nickname }),
              }).finally(() => setTimeout(reload, 260));
            } else {
              setTimeout(reload, 260);
            }
          }}
        />
      )}

      {/* ===== Publish Modal ===== */}
      {showPublish && loggedIn && (
        <PublishModal
          token={loggedIn.token}
          onClose={() => setShowPublish(false)}
          onPublished={() => {
            // 不直接关闭弹窗，由 PublishModal 内部 handleClose 播放退出动画后关闭
            window.dispatchEvent(new CustomEvent("post-published"));
          }}
        />
      )}

      {/* ===== Friends & Douban Modal — 从顶部滑下 + Tab 切换 ===== */}
      {(showFriends || friendsAnim.closing) && typeof document !== "undefined" && createPortal(
        <div
          data-modal="overlay"
          className={`fixed inset-0 z-[100] flex items-start justify-center bg-black/40 md:items-center md:p-4 ${friendsAnim.closing ? "animate-overlay-out" : "animate-overlay-in"}`}
          onClick={friendsAnim.handleClose}
        >
          <div
            className={`flex h-[100dvh] w-full max-w-[520px] flex-col bg-wechat-white pt-[env(safe-area-inset-top)] md:h-auto md:rounded-2xl md:pt-0 md:shadow-xl dark:bg-[#232328] ${friendsAnim.closing ? "animate-sheet-to-top md:animate-modal-out" : "animate-sheet-from-top md:animate-modal-in"}`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Tab 切换：友链 / 豆瓣 / 友圈 + 三点菜单 */}
            <div className="flex shrink-0 items-center gap-1 border-b border-wechat-border px-3 py-2 dark:border-white/10">
              {/* 胶囊式 tab */}
              <div className="flex gap-1">
                <button
                  onClick={() => setFriendsTab("friends")}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                    friendsTab === "friends"
                      ? "bg-wechat-text text-wechat-white dark:bg-white dark:text-black"
                      : "bg-wechat-bubble text-wechat-time hover:text-wechat-text dark:bg-white/5"
                  }`}
                >
                  友链
                </button>
                {/* 影单 tab：没有豆瓣数据时隐藏（加载中仍显示以避免闪烁） */}
                {(hasDouban || !doubanLoaded) && (
                <button
                  onClick={() => setFriendsTab("douban")}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                    friendsTab === "douban"
                      ? "bg-wechat-text text-wechat-white dark:bg-white dark:text-black"
                      : "bg-wechat-bubble text-wechat-time hover:text-wechat-text dark:bg-white/5"
                  }`}
                >
                  影单
                </button>
                )}
                {/* 友圈 tab */}
                <button
                  onClick={() => setFriendsTab("rss")}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                    friendsTab === "rss"
                      ? "bg-wechat-text text-wechat-white dark:bg-white dark:text-black"
                      : "bg-wechat-bubble text-wechat-time hover:text-wechat-text dark:bg-white/5"
                  }`}
                >
                  友圈
                </button>
              </div>
              <div className="ml-auto flex items-center gap-0.5">
                {loggedIn && (
                  <div ref={userMenuRef} className="relative">
                    <button
                      onClick={() => setShowUserMenu((v) => !v)}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-wechat-time transition-colors hover:bg-wechat-hover hover:text-wechat-text"
                      aria-label="更多"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                    {showUserMenu && (
                      <div className="animate-dropdown-in absolute right-0 top-full z-50 mt-1 w-36 overflow-hidden rounded-xl border border-wechat-border bg-wechat-white shadow-xl dark:border-white/10 dark:bg-[#2c2c30]">
                        <button
                          type="button"
                          onClick={() => {
                            setShowUserMenu(false);
                            friendsAnim.handleClose();
                            window.open("/admin", "_blank", "noopener,noreferrer");
                          }}
                          className="flex w-full items-center gap-2 px-3.5 py-2.5 text-xs text-wechat-text transition-colors hover:bg-wechat-hover dark:hover:bg-white/10"
                        >
                          <LayoutDashboard className="h-3.5 w-3.5 text-wechat-time" />
                          后台管理
                        </button>
                        <div className="h-px bg-wechat-border dark:bg-white/10" />
                        <button
                          type="button"
                          onClick={() => {
                            setShowUserMenu(false);
                            friendsAnim.handleClose();
                            handleLogout();
                          }}
                          className="flex w-full items-center gap-2 px-3.5 py-2.5 text-xs text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-500/10"
                        >
                          <LogOut className="h-3.5 w-3.5" />
                          退出登录
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {/* 手机版未登录时显示登录入口 */}
                {!loggedIn && (
                  <button
                    onClick={() => {
                      friendsAnim.handleClose();
                      setShowLogin(true);
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-wechat-time transition-colors hover:bg-wechat-hover hover:text-wechat-text md:hidden"
                    aria-label="登录"
                  >
                    <UserRound className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={friendsAnim.handleClose}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-wechat-time transition-colors hover:bg-wechat-hover hover:text-wechat-text"
                  aria-label="关闭"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div key={friendsTab} className="animate-content-fade-in flex-1 overflow-y-auto px-2 pb-2 md:max-h-[80vh]">
              {friendsTab === "friends" ? (
                <>
                  {!friendsLoaded ? (
                    <div className="space-y-1">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="flex items-center gap-3 rounded-lg px-2 py-2.5">
                          <div className="h-10 w-10 shrink-0 animate-pulse rounded-[8px] bg-wechat-bubble dark:bg-white/5" />
                          <div className="flex-1 space-y-1.5">
                            <div className="h-3.5 w-1/3 animate-pulse rounded bg-wechat-bubble dark:bg-white/5" />
                            <div className="h-2.5 w-1/2 animate-pulse rounded bg-wechat-bubble dark:bg-white/5" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : friendLinks.length === 0 ? (
                    <div className="py-8 text-center text-sm text-wechat-time">暂无友情链接</div>
                  ) : (
                    <ul>
                      {friendLinks.map((link) => (
                        <li key={link.id}>
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-wechat-hover"
                          >
                            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-[8px] bg-wechat-bubble">
                              {resolveFriendAvatar(link, 80) ? (
                                <LazyImage
                                  src={resolveFriendAvatar(link, 80)}
                                  alt={link.name}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center">
                                  <BookUser className="h-4 w-4 text-wechat-time" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[14px] font-medium text-wechat-nickname">
                                {link.name}
                              </p>
                              {link.desc && (
                                <p className="truncate text-xs text-wechat-time">{link.desc}</p>
                              )}
                            </div>
                            <ExternalLink className="h-4 w-4 shrink-0 text-wechat-time" />
                          </a>
                        </li>
                      ))}
                      {friendsLoadingMore &&
                        [...Array(3)].map((_, i) => (
                          <li key={`fsk-${i}`} className="flex items-center gap-3 rounded-lg px-2 py-2.5">
                            <div className="h-10 w-10 shrink-0 animate-pulse rounded-[8px] bg-wechat-bubble dark:bg-white/5" />
                            <div className="flex-1 space-y-1.5">
                              <div className="h-3.5 w-1/3 animate-pulse rounded bg-wechat-bubble dark:bg-white/5" />
                              <div className="h-2.5 w-1/2 animate-pulse rounded bg-wechat-bubble dark:bg-white/5" />
                            </div>
                          </li>
                        ))}
                    </ul>
                  )}
                  <div ref={friendsSentinelRef} className="h-1" />
                </>
              ) : friendsTab === "rss" ? (
                <>
                  {!rssLoaded ? (
                    <div className="space-y-1">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="flex items-start gap-3 rounded-lg px-2 py-2.5">
                          <div className="h-10 w-10 shrink-0 animate-pulse rounded-[8px] bg-wechat-bubble dark:bg-white/5" />
                          <div className="flex-1 space-y-1.5">
                            <div className="h-3.5 w-2/3 animate-pulse rounded bg-wechat-bubble dark:bg-white/5" />
                            <div className="h-2.5 w-1/2 animate-pulse rounded bg-wechat-bubble dark:bg-white/5" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : rssArticles.length === 0 ? (
                    <div className="py-8 text-center text-sm text-wechat-time">暂无友圈文章</div>
                  ) : (
                    <ul>
                      {rssArticles.map((article) => (
                        <li key={article.id}>
                          <a
                            href={article.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-start gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-wechat-hover"
                          >
                            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-[8px] bg-wechat-bubble">
                              {/* 默认头像（底层），加载失败时自动显示 */}
                              <div className="flex h-full w-full items-center justify-center">
                                <Rss className="h-4 w-4 text-wechat-time" />
                              </div>
                              {/* 实际头像（上层），加载失败时隐藏 */}
                              {(article.thumbnail || (article.source && resolveRssSourceAvatar(article.source, 80))) && (
                                <img
                                  src={article.thumbnail || resolveRssSourceAvatar(article.source!, 80)}
                                  alt={article.title}
                                  className="absolute inset-0 h-full w-full object-cover"
                                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                                />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="line-clamp-2 text-[14px] font-medium leading-snug text-wechat-nickname">
                                {article.title}
                              </p>
                              {article.desc && (
                                <p className="mt-0.5 line-clamp-1 text-xs text-wechat-time">{article.desc}</p>
                              )}
                              <div className="mt-0.5 flex items-center gap-1 text-[11px] text-wechat-time">
                                {article.source?.name && <span className="truncate">{article.source.name}</span>}
                                {article.source?.name && article.pubDate && <span>·</span>}
                                {article.pubDate && (
                                  <span>{new Date(article.pubDate).toLocaleDateString("zh-CN", { month: "long", day: "numeric" })}</span>
                                )}
                              </div>
                            </div>
                            <ExternalLink className="mt-1 h-4 w-4 shrink-0 text-wechat-time" />
                          </a>
                        </li>
                      ))}
                      {rssLoadingMore &&
                        [...Array(3)].map((_, i) => (
                          <li key={`rsk-${i}`} className="flex items-start gap-3 rounded-lg px-2 py-2.5">
                            <div className="h-10 w-10 shrink-0 animate-pulse rounded-[8px] bg-wechat-bubble dark:bg-white/5" />
                            <div className="flex-1 space-y-1.5">
                              <div className="h-3.5 w-2/3 animate-pulse rounded bg-wechat-bubble dark:bg-white/5" />
                              <div className="h-2.5 w-1/2 animate-pulse rounded bg-wechat-bubble dark:bg-white/5" />
                            </div>
                          </li>
                        ))}
                    </ul>
                  )}
                  <div ref={rssSentinelRef} className="h-1" />
                </>
              ) : (
                <DoubanSidebar embedded />
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 歌词浮层：点击顶栏音乐区展开 */}
      {showLyricPanel && lyric && lyric.length > 0 && (
        <LyricPanel
          lines={lyric}
          currentIndex={currentLyricIndex}
          onClose={() => setShowLyricPanel(false)}
        />
      )}
    </>
  );
}

/* ========== Login Modal ========== */
export function LoginModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: (user: LoggedInUser) => void;
}) {
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { closing, handleClose } = useExitAnimation(onClose, 220);

  const handleSubmit = async () => {
    if (!account.trim() || !password.trim()) {
      setError("请输入用户名和密码");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "登录失败");
        return;
      }
      localStorage.setItem("admin_token", data.token);
      localStorage.setItem("admin_nickname", data.user.nickname);
      localStorage.setItem("admin_email", data.user.email);
      localStorage.setItem("admin_avatar", data.user.avatar || "");
      localStorage.setItem("admin_cover", data.user.cover || "");
      localStorage.setItem("admin_bio", data.user.bio || "");
      localStorage.setItem("admin_website", data.user.website || "");
      onSuccess({
        token: data.token,
        nickname: data.user.nickname,
        email: data.user.email,
        avatar: data.user.avatar || "",
        cover: data.user.cover || "",
        bio: data.user.bio || "",
        website: data.user.website || "",
      });
      handleClose();
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  const faviconUrl = useSiteSettings((s) => s.faviconUrl);
  const siteName = useSiteSettings((s) => s.siteName);
  const resolvedIcon = faviconUrl ? getImageUrl(faviconUrl) : "";
  const canSubmit = account.trim().length > 0 && password.trim().length > 0;

  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      data-modal="overlay"
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 ${closing ? "animate-overlay-out" : "animate-overlay-in"}`}
      onClick={handleClose}
    >
      <div
        className={`w-full max-w-[340px] overflow-hidden rounded-2xl bg-wechat-white shadow-2xl ring-1 ring-black/5 dark:bg-[#1f1f24] dark:ring-white/10 ${closing ? "animate-modal-out" : "animate-modal-in"}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 顶部标题栏：标题居中 + 关闭按钮右上角 */}
        <div className="relative flex shrink-0 items-center justify-center border-b border-wechat-border px-4 py-3.5 dark:border-white/10">
          <h3 className="text-base font-semibold text-wechat-text">登录</h3>
          <button
            onClick={handleClose}
            className="absolute right-3 flex h-8 w-8 items-center justify-center rounded-full text-wechat-time transition-colors hover:bg-wechat-hover hover:text-wechat-text"
            aria-label="关闭"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 内容区域 */}
        <div className="px-6 py-6">
          {/* 表单 — 评论框风格：灰色容器 + 透明输入区 */}
          <div className="w-full">
            <div className="overflow-hidden rounded-xl bg-wechat-bubble dark:bg-white/5">
              {/* 用户名或邮箱 */}
              <div className="relative border-b border-wechat-divider dark:border-white/5">
                <input
                  type="text"
                  value={account}
                  onChange={(e) => setAccount(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && canSubmit && handleSubmit()}
                  placeholder="用户名或邮箱"
                  className="w-full bg-transparent px-4 py-3 text-[15px] text-wechat-text outline-none placeholder:text-wechat-time"
                />
              </div>
              {/* 密码 */}
              <div className="relative">
                <input
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && canSubmit && handleSubmit()}
                  placeholder="密码"
                  className="w-full bg-transparent px-4 py-3 pr-10 text-[15px] text-wechat-text outline-none placeholder:text-wechat-time"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-wechat-time transition-colors hover:text-wechat-text"
                >
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* 错误提示 */}
            {error && (
              <p className="animate-content-fade-in mt-3 px-1 text-xs text-red-500 dark:text-red-400">
                {error}
              </p>
            )}

            {/* 登录按钮 — 灰色（未输入）/ 绿色（已输入） */}
            <button
              type="button"
              onClick={canSubmit ? handleSubmit : undefined}
              disabled={loading}
              className={`mt-4 w-full rounded-xl py-3 text-[15px] font-medium transition-all active:scale-[0.98] ${
                canSubmit
                  ? "bg-[#07c160] text-white hover:bg-[#06ad56] disabled:cursor-not-allowed disabled:opacity-60"
                  : "bg-wechat-bubble text-wechat-time dark:bg-white/5"
              }`}
            >
              {loading ? "登录中..." : "登录"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ========== Publish Modal (WeChat Moments Style) ========== */
export function PublishModal({
  token,
  onClose,
  onPublished,
  editPost,
}: {
  token: string;
  onClose: () => void;
  onPublished: () => void;
  /** 传入则进入编辑模式（PUT /posts/:id），否则为发表模式（POST /posts） */
  editPost?: Post;
}) {
  const isEdit = !!editPost;
  const [content, setContent] = useState(editPost?.content ?? "");
  const [images, setImages] = useState<PostImage[]>(editPost?.images ?? []);
  const [uploading, setUploading] = useState(false);
  // 图片上传模式：normal=普通图片，live=实况图（需配对图片+视频），video=短视频
  const [uploadMode, setUploadMode] = useState<"normal" | "live" | "video">(
    editPost?.video ? "video" : "normal"
  );
  // 短视频：解析/上传/直链/嵌入
  const [video, setVideo] = useState<PostVideo | null>(editPost?.video ?? null);
  const [videoTab, setVideoTab] = useState<"parse" | "upload" | "url" | "embed">("parse");
  const [parseUrl, setParseUrl] = useState("");
  const [parsing, setParsing] = useState(false);
  const [videoUploading, setVideoUploading] = useState(false);
  const [videoDirectUrl, setVideoDirectUrl] = useState("");
  const [videoDirectCover, setVideoDirectCover] = useState("");
  const [embedCode, setEmbedCode] = useState(editPost?.video?.embedCode ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [location, setLocation] = useState<PostLocation | null>(
    editPost?.location ?? null
  );
  const [showLocationPanel, setShowLocationPanel] = useState(false);
  const [music, setMusic] = useState<{
    name: string;
    artist: string;
    cover: string;
    url: string;
    source: "netease" | "upload" | "musicfree";
    neteaseId?: string;
    platform?: string;
    musicId?: string;
    songmid?: string;
    /** 插件特定字段（songmid/hash/bvid ...），透传给后端 stream/lyric */
    extra?: Record<string, any>;
    /** LRC 歌词文本（上传歌曲） */
    lrc?: string;
  } | null>(editPost?.music ?? null);
  const [linkCard, setLinkCard] = useState<{
    url: string;
    title: string;
    description: string;
    image: string;
    siteName: string;
  } | null>(editPost?.linkCard ?? null);
  const [linkCardLoading, setLinkCardLoading] = useState(false);
  const [showMusicPanel, setShowMusicPanel] = useState(false);
  const [douban, setDouban] = useState<PostDouban | null>(editPost?.douban ?? null);
  const [showDoubanPicker, setShowDoubanPicker] = useState(false);
  // 媒体库选择器：控制从媒体库导入图片/视频/音频/封面
  const [mediaPickerMode, setMediaPickerMode] = useState<"image" | "video" | "audio" | "cover" | null>(null);
  // 媒体库小胶囊：内联三排横向滚动选择图片（分页加载 + 延迟渲染，避免手机卡顿）
  const [mediaItems, setMediaItems] = useState<{ id: string; url: string; filename: string }[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaPage, setMediaPage] = useState(1);
  const [mediaHasMore, setMediaHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [mediaRendered, setMediaRendered] = useState(false);
  const mediaSentinelRef = useRef<HTMLDivElement>(null);
  // 编辑模式且已有音乐时，默认打开上传 Tab（方便就地编辑元数据）
  const [musicTab, setMusicTab] = useState<"search" | "upload">(
    isEdit && editPost?.music ? "upload" : "search"
  );
  const [musicPlugins, setMusicPlugins] = useState<{ platform: string; name: string; primaryKey?: string[] }[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [loadingMusic, setLoadingMusic] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  // 编辑模式：从 editPost.music 回填元数据，避免用户看到空白表单
  const [customMusicName, setCustomMusicName] = useState(editPost?.music?.name ?? "");
  const [customMusicArtist, setCustomMusicArtist] = useState(editPost?.music?.artist ?? "");
  const [customMusicCover, setCustomMusicCover] = useState(editPost?.music?.cover ?? "");
  const [customMusicUrl, setCustomMusicUrl] = useState(editPost?.music?.url ?? "");
  // 编辑模式已有音频 URL 时默认 url 模式（保留原音频，无需重传）
  const [audioUploadMode, setAudioUploadMode] = useState<"file" | "url">(
    isEdit && editPost?.music?.url ? "url" : "file"
  );
  const [uploadedAudioUrl, setUploadedAudioUrl] = useState(editPost?.music?.url ?? "");
  const [uploadedAudioName, setUploadedAudioName] = useState(editPost?.music?.name ?? "");
  const [customMusicLrc, setCustomMusicLrc] = useState(editPost?.music?.lrc ?? "");
  const [showLyricEditor, setShowLyricEditor] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  // 互动权限：关闭点赞/评论
  const [likesDisabled, setLikesDisabled] = useState(editPost?.likesDisabled ?? false);
  const [commentsDisabled, setCommentsDisabled] = useState(editPost?.commentsDisabled ?? false);
  // 作为广告发布：勾选后该动态以广告形式展示
  const [isAd, setIsAd] = useState(!!editPost?.isAd);

  const uploadOne = async (
    file: File,
    kind: "image" | "video"
  ): Promise<string | null> => {
    const endpoint = kind === "image" ? "/upload" : "/upload/video";
    const field = kind === "image" ? "image" : "video";
    const formData = new FormData();
    formData.append(field, file);
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (res.ok) {
      const data = await res.json();
      return data.url;
    }
    const err = await res.json().catch(() => ({}));
    setError(err.message || `上传失败 (${res.status})`);
    return null;
  };

  // 上传动态照片（单个 JPEG 内嵌 MP4）：后端自动拆分图片+视频
  const uploadMotionPhoto = async (
    file: File
  ): Promise<{ image: string; video: string | null; isLivePhoto: boolean } | null> => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_URL}/upload/motion-photo`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (res.ok) {
      return await res.json();
    }
    const err = await res.json().catch(() => ({}));
    setError(err.message || `上传失败 (${res.status})`);
    return null;
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError("");
    try {
      const fileArr = Array.from(files);

      // 实况图模式 + 单个图片文件 → 尝试动态照片提取
      if (uploadMode === "live" && fileArr.length === 1 && fileArr[0].type.startsWith("image/")) {
        const result = await uploadMotionPhoto(fileArr[0]);
        if (result) {
          if (result.isLivePhoto && result.video) {
            const videoUrl: string = result.video;
            setImages((prev) => [...prev, { src: result.image, video: videoUrl }].slice(0, 9));
          } else {
            // 无嵌入视频，降级为普通图片
            setImages((prev) => [...prev, result.image].slice(0, 9));
            setError("未检测到嵌入视频，已作为普通图片上传。如需实况图，请同时选择配对的图片和视频文件");
          }
        }
        return;
      }

      // 按文件名（去扩展名）分组配对实况图
      const groups = new Map<string, { image?: File; video?: File }>();
      for (const file of fileArr) {
        const baseName = file.name.replace(/\.[^.]+$/, "");
        if (!groups.has(baseName)) groups.set(baseName, {});
        const g = groups.get(baseName)!;
        if (file.type.startsWith("image/")) g.image = file;
        else if (file.type.startsWith("video/")) g.video = file;
      }

      // 如果按文件名未能配对，回退到按选择顺序配对
      const pairedGroups = Array.from(groups.values());
      const hasAnyPair = pairedGroups.some((g) => g.image && g.video);
      if (!hasAnyPair && uploadMode === "live") {
        const imageFiles = fileArr.filter((f) => f.type.startsWith("image/"));
        const videoFiles = fileArr.filter((f) => f.type.startsWith("video/"));
        if (imageFiles.length > 0 && videoFiles.length > 0) {
          // 按顺序配对
          imageFiles.forEach((img, i) => {
            if (videoFiles[i]) {
              groups.set(`__fallback_${i}`, { image: img, video: videoFiles[i] });
            }
          });
        }
      }

      const newImages: PostImage[] = [];
      for (const [, g] of groups) {
        if (images.length + newImages.length >= 9) break;
        if (g.image && g.video) {
          // 实况图：先传图再传视频
          const imgUrl = await uploadOne(g.image, "image");
          if (!imgUrl) continue;
          const videoUrl = await uploadOne(g.video, "video");
          if (videoUrl) {
            newImages.push({ src: imgUrl, video: videoUrl });
          } else {
            newImages.push(imgUrl); // 视频上传失败则降级为普通图
          }
        } else if (g.image) {
          const url = await uploadOne(g.image, "image");
          if (url) newImages.push(url);
        } else if (g.video) {
          // 仅视频无配对图片 → 拒绝
          setError("实况图需同时选择图片和视频配对文件");
        }
      }
      if (newImages.length > 0) {
        setImages((prev) => [...prev, ...newImages].slice(0, 9));
      }
    } catch {
      setError("网络错误，上传失败");
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  // 拉取内嵌音源列表
  useEffect(() => {
    if (!showMusicPanel || musicPlugins.length > 0) return;
    fetch(`${API_URL}/music/sources`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: { platform: string; name: string; primaryKey: string[] }[]) => {
        setMusicPlugins(data);
        if (data.length > 0 && !selectedPlatform) {
          setSelectedPlatform(data[0].platform);
        }
      })
      .catch(() => {});
  }, [showMusicPanel, musicPlugins.length, selectedPlatform]);

  // 媒体库小胶囊：分页拉取图片列表（初始12张=3排×4列，滚动到底自动加载下一页）
  const PAGE_SIZE = 24;
  useEffect(() => {
    let cancelled = false;
    setMediaLoading(true);
    setMediaPage(1);
    fetch(`${API_URL}/media?category=image&page=1&limit=${PAGE_SIZE}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((data) => {
        if (!cancelled) {
          setMediaItems(data.data || []);
          setMediaHasMore(data.pagination?.hasMore || false);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setMediaLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  // 加载更多媒体图片
  const loadMoreMedia = useCallback(() => {
    if (loadingMore || !mediaHasMore) return;
    setLoadingMore(true);
    const nextPage = mediaPage + 1;
    fetch(`${API_URL}/media?category=image&page=${nextPage}&limit=${PAGE_SIZE}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((data) => {
        const newItems = data.data || [];
        if (newItems.length > 0) {
          setMediaItems((prev) => [...prev, ...newItems]);
          setMediaHasMore(data.pagination?.hasMore || false);
          setMediaPage(nextPage);
        } else {
          setMediaHasMore(false);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  }, [loadingMore, mediaHasMore, mediaPage, token]);

  // IntersectionObserver：横向滚动接近末尾时自动加载下一页
  useEffect(() => {
    const sentinel = mediaSentinelRef.current;
    const container = sentinel?.parentElement;
    if (!sentinel || !container) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMoreMedia();
        }
      },
      { root: container, rootMargin: '0px 80px 0px 0px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMoreMedia, showMediaPicker]);

  // 搜索歌曲
  const handleSearch = async () => {
    const kw = searchKeyword.trim();
    if (!kw || !selectedPlatform) return;
    setSearching(true);
    setError("");
    setSearchResults([]);
    try {
      const res = await fetch(
        `${API_URL}/music/search?platform=${encodeURIComponent(selectedPlatform)}&keyword=${encodeURIComponent(kw)}&page=1&type=music`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.data || []);
        if (!data.data || data.data.length === 0) {
          setError("未找到相关歌曲");
        }
      } else {
        const err = await res.json().catch(() => ({ message: "搜索失败" }));
        setError(err.message || "搜索失败");
      }
    } catch {
      setError("网络错误");
    } finally {
      setSearching(false);
    }
  };

  // 选中搜索结果：调 preview 获取播放地址，歌曲信息优先用搜索结果
  // 搜索结果返回完整 IMusicItem（含 songmid/hash/bvid 等插件字段），全部透传给后端
  const handlePickSong = async (item: any) => {
    setLoadingMusic(true);
    setError("");
    try {
      // 提取搜索结果中的所有插件特定字段（非标准字段），作为 extra 透传
      const standardFields = new Set([
        "id", "platform", "title", "artist", "album", "artwork", "url", "lrc", "rawLrc", "duration",
      ]);
      const extra: Record<string, any> = {};
      for (const [k, v] of Object.entries(item)) {
        if (!standardFields.has(k) && v != null && v !== "") {
          extra[k] = v;
        }
      }
      const res = await fetch(`${API_URL}/music/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          id: String(item.id),
          platform: selectedPlatform,
          extra,
          title: item.title,
          artist: item.artist,
          artwork: item.artwork,
          album: item.album,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        // 优先用搜索结果的 extra，回退 preview 返回的 extra
        const finalExtra =
          Object.keys(extra).length > 0 ? extra : (data.extra || undefined);
        setMusic({
          name: item.title || data.name || "音乐",
          artist: item.artist || data.author || "",
          cover: item.artwork || data.cover || "",
          url: data.mp3url || "",
          source: "musicfree",
          platform: selectedPlatform,
          musicId: String(item.id),
          extra: finalExtra,
        });
        setShowMusicPanel(false);
        if (!data.mp3url) {
          setError("该歌曲因版权限制无法播放，但仍会显示在动态中");
        }
      } else {
        const err = await res.json().catch(() => ({ message: "获取失败" }));
        setError(err.message || "获取歌曲失败");
      }
    } catch {
      setError("网络错误");
    } finally {
      setLoadingMusic(false);
    }
  };

  const handleUploadAudio = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    setUploadingAudio(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("audio", file);
      const res = await fetch(`${API_URL}/upload/audio`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        setUploadedAudioUrl(data.url);
        setUploadedAudioName(file.name);
        // 自动填充歌名（若用户未填）
        if (!customMusicName) setCustomMusicName(file.name.replace(/\.[^.]+$/, ""));
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.message || "上传失败");
      }
    } catch {
      setError("网络错误，上传失败");
    } finally {
      setUploadingAudio(false);
    }
  };

  const handleUploadCover = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    setUploadingCover(true);
    setError("");
    try {
      const url = await uploadImage(file, token);
      setCustomMusicCover(url);
    } catch (e: any) {
      setError(e.message || "封面上传失败");
    } finally {
      setUploadingCover(false);
    }
  };

  const handleConfirmUploadMusic = () => {
    const url = audioUploadMode === "file" ? uploadedAudioUrl : customMusicUrl.trim();
    if (!url) {
      setError("请上传音频文件或输入音频直链");
      return;
    }
    setMusic({
      name: customMusicName || "未知歌曲",
      artist: customMusicArtist || "未知艺术家",
      cover: customMusicCover,
      url,
      source: "upload",
      lrc: customMusicLrc || undefined,
    });
    setShowMusicPanel(false);
  };

  // content 现为 HTML，需提取纯文本判断是否为空（<p><br></p> 应视为空，但 img 表情不算空）
  const isContentEmpty = (html: string) => {
    if (!html.trim()) return true;
    if (typeof document === "undefined") return false;
    const div = document.createElement("div");
    div.innerHTML = html;
    if (div.textContent?.trim()) return false;
    if (div.querySelector("img")) return false;
    return true;
  };

  // 获取链接卡片预览
  const handleFetchLinkCard = async (url: string) => {
    setLinkCardLoading(true);
    setError("");
    try {
      const res = await fetch(
        `${API_URL}/url-preview?url=${encodeURIComponent(url)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setLinkCard(data);
      } else {
        const err = await res.json().catch(() => ({ message: "获取链接信息失败" }));
        setError(err.message || "获取链接信息失败");
      }
    } catch {
      setError("网络错误，获取链接信息失败");
    } finally {
      setLinkCardLoading(false);
    }
  };

  // 短视频解析：调后端 /api/video/parse。overrideUrl 用于粘贴时自动解析
  const handleParseVideo = async (overrideUrl?: string) => {
    const input = overrideUrl || parseUrl.trim();
    if (!input) return;
    setParsing(true);
    setError("");
    try {
      // 智能提取 URL：用户可能粘贴整段抖音分享文本（含前缀噪声+链接+尾部提示）
      const urlMatch = input.match(/https?:\/\/[^\s，。！]+/i);
      const url = urlMatch ? urlMatch[0] : input;
      const res = await fetch(`${API_URL}/video/parse`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ url }),
      });
      if (res.ok) {
        const data = await res.json();
        setVideo({ ...data, source: "parse" });
        setImages([]);
      } else {
        const err = await res.json().catch(() => ({ message: "解析失败" }));
        setError(err.message || "解析失败");
      }
    } catch {
      setError("网络错误，解析失败");
    } finally {
      setParsing(false);
    }
  };

  // 短视频上传：复用 uploadOne(file, "video")
  const handleVideoUpload = async (file: File) => {
    setVideoUploading(true);
    setError("");
    try {
      const url = await uploadOne(file, "video");
      if (url) {
        setVideo({ url, source: "upload", platform: "upload" });
        setImages([]);
      }
    } finally {
      setVideoUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (isContentEmpty(content) && images.length === 0 && !music && !linkCard && !video && !douban) return;
    setSubmitting(true);
    setError("");
    try {
      const url = isEdit ? `${API_URL}/posts/${editPost!.id}` : `${API_URL}/posts`;
      const method = isEdit ? "PUT" : "POST";
      // 编辑模式：空值显式传 null/空数组/空字符串，否则 JSON.stringify 省略 undefined 字段，
      // 后端收不到该字段就会保持原值，导致"删除内容后编辑无效"的 bug
      // 视频独占：video 存在时 images 强制为 []
      const payload = isEdit
        ? {
            content: isContentEmpty(content) ? "" : content,
            images: video ? [] : (images.length > 0 ? images : []),
            location: location || null,
            music: music || null,
            linkCard: linkCard || null,
            video: video || null,
            douban: douban || null,
            isAd,
            likesDisabled,
            commentsDisabled,
          }
        : {
            content: isContentEmpty(content) ? undefined : content,
            images: video ? [] : (images.length > 0 ? images : undefined),
            location: location || undefined,
            music: music || undefined,
            linkCard: linkCard || undefined,
            video: video || undefined,
            douban: douban || undefined,
            isAd,
            likesDisabled,
            commentsDisabled,
          };
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        onPublished();
        handleClose();
      } else if (res.status === 401) {
        localStorage.removeItem("admin_token");
        localStorage.removeItem("admin_nickname");
        setError("登录已失效，请重新登录");
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.message || `${isEdit ? "保存" : "发表"}失败 (${res.status})`);
      }
    } catch {
      setError("网络错误，发表失败");
    } finally {
      setSubmitting(false);
    }
  };

  const imgCount = images.length;
  const audioBase = API_URL.replace("/api", "");
  const { closing, handleClose } = useExitAnimation(onClose, 250);

  if (typeof document === "undefined") return null;
  return createPortal(
    <div data-modal="overlay" className={`fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-0 md:items-center md:p-4 ${closing ? "animate-overlay-out" : "animate-overlay-in"}`} onPointerDown={(e) => { if (e.target === e.currentTarget) handleClose(); }}>
      <div className={`relative flex h-full w-full flex-col bg-wechat-white md:h-auto md:min-h-[560px] md:max-h-[90vh] md:max-w-[680px] md:overflow-hidden md:rounded-2xl md:shadow-xl dark:bg-[#232328] ${closing ? "animate-sheet-down md:animate-modal-out" : "animate-sheet-up md:animate-modal-in"}`} onClick={(e) => e.stopPropagation()}>
      {/* Header */}
      <div className="sticky top-0 z-10 relative flex items-center justify-between border-b border-wechat-border bg-wechat-white px-4 py-3 rounded-t-2xl dark:bg-[#232328] dark:border-white/10">
        <button
          onClick={handleClose}
          className="text-sm font-medium text-wechat-text transition-colors hover:opacity-70 dark:text-gray-200"
        >
          取消
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting || (isContentEmpty(content) && images.length === 0 && !music && !linkCard && !video && !douban)}
          className="rounded-md px-4 py-1.5 text-sm font-medium transition-colors disabled:bg-wechat-bubble disabled:text-wechat-time enabled:bg-green-500 enabled:text-white enabled:hover:bg-green-600 dark:disabled:bg-white/5 dark:disabled:text-gray-500"
        >
          {submitting ? (isEdit ? "保存中" : "发表中") : isEdit ? "保存" : "发表"}
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {/* Rich text editor - WeChat official account style */}
        <RichTextEditor
          value={content}
          onChange={setContent}
          placeholder="这一刻的想法..."
          minHeight={200}
          onLinkCard={handleFetchLinkCard}
          linkCardLoading={linkCardLoading}
          hasLinkCard={!!linkCard}
          onDouban={() => setShowDoubanPicker(true)}
        />

        {/* Image grid - 微信风格 3 列网格 */}
        {/* 上传模式切换：普通图片 / 实况图 / 短视频（视频独占，不可与图片共存） */}
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setUploadMode("normal");
              setVideo(null);
            }}
            className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs transition-colors ${
              uploadMode === "normal"
                ? "bg-green-500 text-white"
                : "bg-wechat-bubble text-wechat-time dark:bg-white/5 dark:text-gray-400"
            }`}
          >
            <ImagePlus className="h-3.5 w-3.5" />
            普通图片
          </button>
          <button
            type="button"
            onClick={() => {
              setUploadMode("live");
              setVideo(null);
            }}
            className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs transition-colors ${
              uploadMode === "live"
                ? "bg-green-500 text-white"
                : "bg-wechat-bubble text-wechat-time dark:bg-white/5 dark:text-gray-400"
            }`}
          >
            <Film className="h-3.5 w-3.5" />
            实况图
          </button>
          <button
            type="button"
            onClick={() => {
              setUploadMode("video");
              setImages([]);
            }}
            className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs transition-colors ${
              uploadMode === "video"
                ? "bg-green-500 text-white"
                : "bg-wechat-bubble text-wechat-time dark:bg-white/5 dark:text-gray-400"
            }`}
          >
            <Video className="h-3.5 w-3.5" />
            短视频
          </button>
        </div>

        {uploadMode === "live" && (
          <div className="mt-1.5 space-y-1 text-[11px] leading-relaxed text-wechat-time">
            <p>
              <strong className="text-wechat-text">单文件上传（推荐安卓）：</strong>
              直接选择一张实况图，系统自动提取内嵌视频。OPPO/小米/三星等安卓手机拍摄的动态照片可直接上传。
            </p>
            <p>
              <strong className="text-wechat-text">配对上传（iOS/手动）：</strong>
              同时选择图片(JPEG)和视频(MP4/MOV)，按文件名自动配对。iOS 需先导出为独立文件。
            </p>
          </div>
        )}

        {uploadMode !== "video" && (
        <>
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {images.map((img, i) => {
            const src = getImageSrc(img);
            const live = isLivePhoto(img);
            return (
            <div
              key={i}
              className="group relative aspect-square overflow-hidden rounded bg-wechat-bubble dark:bg-white/5"
            >
              <LazyImage
                src={typeof src === "string" && src.startsWith("http")
                  ? src
                  : `${audioBase}${src}`}
                alt={`图片 ${i + 1}`}
                className="h-full w-full object-cover"
              />
              {live && (
                <span className="absolute left-1 top-1 rounded bg-black/60 px-1 py-0.5 text-[10px] font-medium text-white">
                  实况
                </span>
              )}
              <button
                onClick={() => removeImage(i)}
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white transition-opacity md:opacity-0 md:group-hover:opacity-100"
                aria-label="删除图片"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            );
          })}

          {/* Upload button (if < 9 images) */}
          {images.length < 9 && (
            <>
            <label className="flex aspect-square cursor-pointer items-center justify-center rounded border border-wechat-border bg-wechat-bubble transition-colors active:bg-wechat-hover dark:border-white/10 dark:bg-white/5">
              <input
                type="file"
                accept={
                  uploadMode === "live"
                    ? "image/jpeg,image/jpg,image/png,image/webp,video/mp4,video/quicktime,video/3gpp,video/3gp"
                    : "image/jpeg,image/jpg,image/png,image/gif,image/webp"
                }
                multiple
                className="hidden"
                onChange={(e) => {
                  handleUpload(e.target.files);
                  e.target.value = "";
                }}
              />
              {uploading ? (
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-wechat-time border-t-wechat-nickname" />
              ) : uploadMode === "live" ? (
                <Film className="h-7 w-7 text-wechat-time" />
              ) : (
                <ImagePlus className="h-7 w-7 text-wechat-time" />
              )}
            </label>
            </>
          )}
        </div>

        {imgCount > 0 && (
          <p className="mt-2 text-xs text-wechat-time">
            {imgCount}/9 张图片
          </p>
        )}

        {/* 从媒体库选择 — 小胶囊按钮，点击展开三排横向滚动图片列表 */}
        {uploadMode === "normal" && images.length < 9 && (mediaLoading || mediaItems.length > 0) && (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => {
                if (!showMediaPicker) {
                  // 展开：先显示容器（骨架），延迟 200ms 再渲染图片，避免动画+渲染同时进行导致卡顿
                  setShowMediaPicker(true);
                  setMediaRendered(false);
                  setTimeout(() => setMediaRendered(true), 200);
                } else {
                  // 收起：立即隐藏
                  setMediaRendered(false);
                  setShowMediaPicker(false);
                }
              }}
              className={`flex items-center gap-1 rounded-full border border-wechat-border bg-wechat-bubble px-3 py-1 text-xs text-wechat-time transition-colors hover:bg-wechat-hover dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10 ${
                showMediaPicker ? "text-wechat-text" : ""
              }`}
            >
              <Library className="h-3.5 w-3.5" />
              从媒体库导入
            </button>
            {showMediaPicker && (
              <div className="animate-emoji-fade-in mt-2">
                {!mediaRendered || mediaLoading ? (
                  <div className="grid grid-rows-3 grid-flow-col gap-0.5 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                    {Array.from({ length: 9 }).map((_, i) => (
                      <div
                        key={i}
                        className="h-10 w-10 shrink-0 animate-pulse rounded bg-wechat-bubble dark:bg-white/5"
                      />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-rows-3 grid-flow-col gap-0.5 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                    {mediaItems.map((item) => {
                      const fullUrl = getImageUrl(item.url);
                      const isSelected = images.some((img) => {
                        const imgSrc = typeof img === "string" ? img : img.src;
                        return imgSrc === item.url || imgSrc === fullUrl || getImageUrl(imgSrc) === fullUrl;
                      });
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            if (isSelected || images.length >= 9) return;
                            setImages((prev) => [...prev, item.url]);
                          }}
                          disabled={isSelected || images.length >= 9}
                          title={item.filename}
                          className={`relative h-10 w-10 shrink-0 overflow-hidden rounded transition-all ${
                            isSelected
                              ? "cursor-default opacity-40"
                              : "cursor-pointer hover:opacity-80 active:scale-95"
                          }`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={fullUrl}
                            alt=""
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                          {isSelected && (
                            <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                              <Check className="h-3.5 w-3.5 text-white" />
                            </span>
                          )}
                        </button>
                      );
                    })}
                    {/* 哨兵元素：横向滚动接近末尾时触发加载下一页 */}
                    {mediaHasMore && (
                      <div ref={mediaSentinelRef} className="flex row-span-3 w-10 shrink-0 items-center justify-center">
                        {loadingMore ? (
                          <div className="h-10 w-10 shrink-0 animate-pulse rounded bg-wechat-bubble dark:bg-white/5" />
                        ) : null}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        </>
        )}

        {/* 短视频面板 */}
        {uploadMode === "video" && (
          <div className="mt-2 space-y-2">
            {/* 子 Tab 切换 */}
            <div className="flex flex-wrap items-center gap-2">
              {(["parse", "upload", "url", "embed"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setVideoTab(tab)}
                  className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs transition-colors ${
                    videoTab === tab
                      ? "bg-green-500 text-white"
                      : "bg-wechat-bubble text-wechat-time dark:bg-white/5 dark:text-gray-400"
                  }`}
                >
                  {tab === "parse" && "解析链接"}
                  {tab === "upload" && "上传文件"}
                  {tab === "url" && "视频直链"}
                  {tab === "embed" && "B站嵌入"}
                </button>
              ))}
            </div>

            {/* 解析链接 */}
            {videoTab === "parse" && !video && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={parseUrl}
                  onChange={(e) => setParseUrl(e.target.value)}
                  onPaste={(e) => {
                    // 粘贴分享文本时自动提取URL并解析
                    const text = e.clipboardData.getData("text");
                    const urlMatch = text.match(/https?:\/\/[^\s，。！]+/i);
                    if (urlMatch && urlMatch[0] !== text.trim()) {
                      e.preventDefault();
                      setParseUrl(urlMatch[0]);
                      handleParseVideo(urlMatch[0]);
                    }
                  }}
                  placeholder="粘贴抖音/快手/小红书/微博链接或分享文本"
                  className="flex-1 rounded-md border border-black/5 bg-wechat-bubble px-3 py-1.5 text-sm text-wechat-text outline-none placeholder:text-wechat-time dark:border-white/5 dark:bg-white/5 dark:text-gray-200"
                  onKeyDown={(e) => e.key === "Enter" && handleParseVideo()}
                />
                <button
                  type="button"
                  onClick={() => handleParseVideo()}
                  disabled={!parseUrl.trim() || parsing}
                  className="rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:bg-wechat-bubble disabled:text-wechat-time enabled:bg-green-500 enabled:text-white enabled:hover:bg-green-600 dark:disabled:bg-white/5 dark:disabled:text-gray-500"
                >
                  {parsing ? "解析中" : "解析"}
                </button>
              </div>
            )}

            {/* 上传文件 */}
            {videoTab === "upload" && !video && (
              <div className="space-y-2">
                <label className="flex h-24 cursor-pointer items-center justify-center rounded-md border border-dashed border-black/5 bg-wechat-bubble transition-colors active:bg-wechat-hover dark:border-white/5 dark:bg-white/5">
                  <input
                    type="file"
                    accept="video/mp4,video/quicktime,video/webm"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleVideoUpload(f);
                      e.target.value = "";
                    }}
                  />
                  {videoUploading ? (
                    <div className="flex items-center gap-2 text-xs text-wechat-time">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-wechat-time border-t-wechat-nickname" />
                      上传中...
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-xs text-wechat-time">
                      <Video className="h-6 w-6" />
                      点击上传视频（MP4/MOV/WEBM，≤50MB）
                    </div>
                  )}
                </label>
                <button
                  type="button"
                  onClick={() => setMediaPickerMode("video")}
                  className="flex w-full items-center justify-center gap-1.5 rounded-md border border-black/5 bg-wechat-bubble py-2 text-xs text-wechat-time transition-colors active:bg-wechat-hover dark:border-white/5 dark:bg-white/5"
                >
                  <Library className="h-3.5 w-3.5" />
                  从媒体库选择
                </button>
                <MediaPicker
                  open={mediaPickerMode === "video"}
                  onClose={() => setMediaPickerMode(null)}
                  category="video"
                  title="从媒体库选择视频"
                  onSelect={(item: PickerMediaItem) => {
                    setVideo({ url: item.url, source: "upload", platform: "upload" } as PostVideo);
                    setMediaPickerMode(null);
                  }}
                />
              </div>
            )}

            {/* 视频直链 */}
            {videoTab === "url" && !video && (
              <div className="space-y-2">
                <input
                  type="text"
                  value={videoDirectUrl}
                  onChange={(e) => setVideoDirectUrl(e.target.value)}
                  placeholder="视频直链地址（https://...）"
                  className="w-full rounded-md border border-black/5 bg-wechat-bubble px-3 py-1.5 text-sm text-wechat-text outline-none placeholder:text-wechat-time dark:border-white/5 dark:bg-white/5 dark:text-gray-200"
                />
                <input
                  type="text"
                  value={videoDirectCover}
                  onChange={(e) => setVideoDirectCover(e.target.value)}
                  placeholder="封面地址（可选）"
                  className="w-full rounded-md border border-black/5 bg-wechat-bubble px-3 py-1.5 text-sm text-wechat-text outline-none placeholder:text-wechat-time dark:border-white/5 dark:bg-white/5 dark:text-gray-200"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!videoDirectUrl.trim()) return;
                    setVideo({ url: videoDirectUrl.trim(), cover: videoDirectCover.trim() || undefined, source: "url", platform: "url" });
                    setImages([]);
                  }}
                  disabled={!videoDirectUrl.trim()}
                  className="rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:bg-wechat-bubble disabled:text-wechat-time enabled:bg-green-500 enabled:text-white enabled:hover:bg-green-600 dark:disabled:bg-white/5 dark:disabled:text-gray-500"
                >
                  使用
                </button>
              </div>
            )}

            {/* B站嵌入 */}
            {videoTab === "embed" && !video && (
              <div className="space-y-2">
                <textarea
                  value={embedCode}
                  onChange={(e) => setEmbedCode(e.target.value)}
                  placeholder="粘贴 B 站嵌入代码，例如：<iframe src=&quot;//player.bilibili.com/...&quot;>"
                  rows={3}
                  className="w-full resize-none rounded-md border border-black/5 bg-wechat-bubble px-3 py-1.5 text-sm text-wechat-text outline-none placeholder:text-wechat-time dark:border-white/5 dark:bg-white/5 dark:text-gray-200"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!embedCode.trim()) return;
                    setVideo({ embedCode: embedCode.trim(), source: "embed", platform: "bilibili" });
                    setImages([]);
                  }}
                  disabled={!embedCode.trim()}
                  className="rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:bg-wechat-bubble disabled:text-wechat-time enabled:bg-green-500 enabled:text-white enabled:hover:bg-green-600 dark:disabled:bg-white/5 dark:disabled:text-gray-500"
                >
                  使用
                </button>
              </div>
            )}

            {/* 视频预览区 */}
            {video && (
              <div className="relative flex items-center gap-2 rounded-md bg-wechat-bubble p-2 dark:bg-white/5">
                <div className="h-12 w-16 shrink-0 overflow-hidden rounded bg-black/10 dark:bg-white/10">
                  {video.cover ? (
                    <LazyImage
                      src={video.cover.startsWith("http") ? video.cover : `${audioBase}${video.cover}`}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Video className="h-5 w-5 text-wechat-time" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  {video.title && (
                    <p className="truncate text-xs font-medium text-wechat-text">{video.title}</p>
                  )}
                  <p className="truncate text-[11px] text-wechat-time">
                    {video.platform && (
                      <span className="mr-1 rounded bg-white/50 px-1 py-0.5 text-[10px] dark:bg-white/10">
                        {video.platform}
                      </span>
                    )}
                    {video.author || video.source}
                  </p>
                </div>
                <button
                  onClick={() => setVideo(null)}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70"
                  aria-label="移除视频"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* 链接卡片预览 */}
        {linkCard && (
          <div className="mt-3 relative">
            <div className="flex items-stretch overflow-hidden rounded-[8px] bg-[#f2f2f2] transition-colors hover:bg-[#eaeaea] active:bg-[#e0e0e0] dark:bg-[#2a2a30] dark:hover:bg-[#33333a] dark:active:bg-[#3a3a42]">
              <a
                href={linkCard.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-stretch"
              >
                {/* 左侧方形封面 */}
                <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden bg-black/[0.02] dark:bg-white/[0.02]">
                  {linkCard.image && (
                    <LazyImage
                      src={linkCard.image}
                      alt=""
                      className="h-full w-full object-contain p-1.5"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  )}
                </div>
                {/* 右侧内容区 — 半透明背景，与音乐卡片一致 */}
                <div className="flex min-w-0 flex-1 flex-col justify-center bg-white/35 px-3 dark:bg-white/[0.04]">
                  <p className="line-clamp-1 text-[14px] font-medium leading-[20px] text-black/[0.87] dark:text-white/90">
                    {linkCard.title || linkCard.url}
                  </p>
                  {linkCard.description && (
                    <p className="line-clamp-2 mt-0.5 text-[12px] leading-[15px] text-black/50 dark:text-white/50">
                      {linkCard.description}
                    </p>
                  )}
                </div>
              </a>
            </div>
            <button
              onClick={() => setLinkCard(null)}
              className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
              aria-label="移除链接卡片"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* Location & Music — 微信朋友圈风格选项行 */}
        <div className="mt-4 border-t border-black/5 dark:border-white/5">
          {/* Location */}
          <div className="flex items-center gap-3 py-3">
            <MapPin className="h-5 w-5 shrink-0 text-wechat-time" />
            {location ? (
              <div className="flex min-w-0 flex-1 items-center justify-between">
                <span className="truncate text-[15px] text-wechat-text dark:text-gray-200">
                  {location.city
                    ? `${location.city} · ${location.name}`
                    : location.name}
                </span>
                <button
                  onClick={() => setLocation(null)}
                  className="ml-2 shrink-0 text-wechat-time hover:text-wechat-text"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowLocationPanel(true)}
                className="flex flex-1 items-center justify-between text-[15px] text-wechat-time hover:text-wechat-text"
              >
                <span>所在位置</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Music */}
          <div className="flex items-center gap-3 border-t border-black/5 py-3 dark:border-white/5">
            <Music className="h-5 w-5 shrink-0 text-wechat-time" />
            {music ? (
              <div className="flex min-w-0 flex-1 items-center gap-2">
                {music.cover && (
                  <LazyImage
                    src={toHttps(typeof music.cover === "string" && music.cover.startsWith("http") ? music.cover : `${audioBase}${music.cover}`)}
                    alt=""
                    className="h-8 w-8 shrink-0 rounded object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium text-wechat-text dark:text-gray-200">
                    {music.name}
                  </p>
                  <p className="truncate text-xs text-wechat-time">
                    {music.artist}
                  </p>
                </div>
                {music.source === "upload" && (
                  <button
                    onClick={() => {
                      setMusicTab("upload");
                      setShowMusicPanel(true);
                    }}
                    className="text-wechat-time hover:text-wechat-text"
                    aria-label="编辑音乐信息"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={() => setMusic(null)}
                  className="text-wechat-time hover:text-wechat-text"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setCustomMusicName("");
                  setCustomMusicArtist("");
                  setCustomMusicCover("");
                  setCustomMusicUrl("");
                  setUploadedAudioUrl("");
                  setUploadedAudioName("");
                  setCustomMusicLrc("");
                  setAudioUploadMode("file");
                  setShowLyricEditor(false);
                  setShowMusicPanel(true);
                }}
                className="flex flex-1 items-center justify-between text-[15px] text-wechat-time hover:text-wechat-text"
              >
                <span>添加音乐</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* 豆瓣卡片 — 已选时显示预览，添加入口在工具栏 */}
          {douban && (
            <div className="flex items-center gap-3 border-t border-black/5 py-3 dark:border-white/5">
              <Film className="h-5 w-5 shrink-0 text-wechat-time" />
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <div className="min-w-0 flex-1">
                  <DoubanEmbedCard item={douban} className="mt-0 max-w-none" variant="feed" />
                </div>
                <button
                  onClick={() => setDouban(null)}
                  className="shrink-0 text-wechat-time hover:text-wechat-text"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* 作为广告发布 — 勾选后该动态以广告形式展示在信息流广告位 */}
          <div className="flex items-center gap-3 border-t border-black/5 py-3 dark:border-white/5">
            <Megaphone className="h-5 w-5 shrink-0 text-wechat-time" />
            <span className="flex-1 text-[15px] text-wechat-text dark:text-gray-200">作为广告</span>
            <button
              type="button"
              role="switch"
              aria-checked={isAd}
              onClick={() => setIsAd((v) => !v)}
              className={`relative h-[22px] w-[40px] rounded-full transition-colors ${
                isAd ? "bg-green-500" : "bg-black/15 dark:bg-white/20"
              }`}
            >
              <span
                className={`absolute left-[2px] top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow transition-transform ${
                  isAd ? "translate-x-[18px]" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* 允许点赞 — 微信朋友圈风格开关行 */}
          <div className="flex items-center gap-3 border-t border-black/5 py-3 dark:border-white/5">
            <Heart className="h-5 w-5 shrink-0 text-wechat-time" />
            <span className="flex-1 text-[15px] text-wechat-text dark:text-gray-200">允许点赞</span>
            <button
              type="button"
              role="switch"
              aria-checked={!likesDisabled}
              onClick={() => setLikesDisabled((v) => !v)}
              className={`relative h-[22px] w-[40px] rounded-full transition-colors ${
                likesDisabled ? "bg-black/15 dark:bg-white/20" : "bg-green-500"
              }`}
            >
              <span
                className={`absolute left-[2px] top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow transition-transform ${
                  likesDisabled ? "translate-x-0" : "translate-x-[18px]"
                }`}
              />
            </button>
          </div>

          {/* 允许评论 — 微信朋友圈风格开关行 */}
          <div className="flex items-center gap-3 border-t border-black/5 py-3 dark:border-white/5">
            <MessageSquare className="h-5 w-5 shrink-0 text-wechat-time" />
            <span className="flex-1 text-[15px] text-wechat-text dark:text-gray-200">允许评论</span>
            <button
              type="button"
              role="switch"
              aria-checked={!commentsDisabled}
              onClick={() => setCommentsDisabled((v) => !v)}
              className={`relative h-[22px] w-[40px] rounded-full transition-colors ${
                commentsDisabled ? "bg-black/15 dark:bg-white/20" : "bg-green-500"
              }`}
            >
              <span
                className={`absolute left-[2px] top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow transition-transform ${
                  commentsDisabled ? "translate-x-0" : "translate-x-[18px]"
                }`}
              />
            </button>
          </div>
        </div>

        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-500/10 dark:text-red-400">
            {error}
          </p>
        )}
      </div>

      {/* ===== Music Panel (search + upload) ===== */}
      {showMusicPanel && (
        <div className="absolute inset-0 z-20 flex flex-col overflow-hidden bg-wechat-white animate-modal-in md:rounded-2xl dark:bg-[#232328]">
          {/* Music panel header */}
          <div className="flex items-center justify-between border-b border-black/5 px-4 py-3 dark:border-white/5">
            <button
              onClick={() => setShowMusicPanel(false)}
              className="text-sm text-wechat-time hover:text-wechat-text"
            >
              返回
            </button>
            <span className="text-sm font-medium text-wechat-text dark:text-gray-200">添加音乐</span>
            <span className="w-8" />
          </div>

          {/* Tabs */}
          <div className="flex border-b border-black/5 dark:border-white/5">
            <button
              onClick={() => setMusicTab("search")}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                musicTab === "search"
                  ? "border-b-2 border-green-500 text-wechat-text dark:text-gray-200"
                  : "text-wechat-time"
              }`}
            >
              搜索
            </button>
            <button
              onClick={() => setMusicTab("upload")}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                musicTab === "upload"
                  ? "border-b-2 border-green-500 text-wechat-text dark:text-gray-200"
                  : "text-wechat-time"
              }`}
            >
              上传音乐
            </button>
          </div>

          {/* Search tab */}
          {musicTab === "search" && (
            <div className="flex min-h-0 flex-1 flex-col p-4">
              {musicPlugins.length === 0 ? (
                <p className="py-8 text-center text-xs text-wechat-time">
                  暂无可用音源，请先在后台「音乐管理」安装并启用插件
                </p>
              ) : (
                <>
                  <div className="mb-3 space-y-2">
                    <select
                      value={selectedPlatform}
                      onChange={(e) => {
                        setSelectedPlatform(e.target.value);
                        setSearchResults([]);
                      }}
                      className="w-full rounded-lg border border-black/5 bg-wechat-bubble px-3 py-2.5 text-sm text-wechat-text focus:outline-none dark:border-white/5 dark:bg-white/5 dark:text-gray-200"
                    >
                      {musicPlugins.map((p) => (
                        <option key={p.platform} value={p.platform}>
                          {PLATFORM_MAP[p.platform] ? `${p.name}（${PLATFORM_MAP[p.platform]}）` : p.name}
                        </option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={searchKeyword}
                        onChange={(e) => setSearchKeyword(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                        placeholder="搜索歌曲、歌手"
                        className="min-w-0 flex-1 rounded-lg border border-black/5 bg-wechat-bubble px-3 py-2.5 text-sm text-wechat-text placeholder:text-wechat-time focus:outline-none dark:border-white/5 dark:bg-white/5 dark:text-gray-200 dark:placeholder:text-gray-500"
                      />
                      <button
                        onClick={handleSearch}
                        disabled={searching || !searchKeyword.trim()}
                        className="shrink-0 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:bg-wechat-bubble disabled:text-wechat-time enabled:bg-green-500 enabled:text-white enabled:hover:bg-green-600 dark:disabled:bg-white/5 dark:disabled:text-gray-500"
                      >
                        {searching ? "..." : "搜索"}
                      </button>
                    </div>
                  </div>

                  {/* Search results */}
                  <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                    {searching && (
                      <div className="space-y-2">
                        {[...Array(4)].map((_, i) => (
                          <div key={i} className="flex items-center gap-2.5 p-2">
                            <div className="h-10 w-10 shrink-0 animate-pulse rounded bg-wechat-bubble dark:bg-white/5" />
                            <div className="flex-1 space-y-1">
                              <div className="h-3 w-3/4 animate-pulse rounded bg-wechat-bubble dark:bg-white/5" />
                              <div className="h-2.5 w-1/2 animate-pulse rounded bg-wechat-bubble dark:bg-white/5" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {!searching && searchResults.length > 0 && (
                      <div className="space-y-1">
                        {searchResults.map((item, i) => (
                          <button
                            key={`${item.id}-${i}`}
                            onClick={() => handlePickSong(item)}
                            disabled={loadingMusic}
                            className="flex w-full items-center gap-2.5 rounded-lg p-2 text-left transition-colors hover:bg-wechat-bubble disabled:opacity-50 dark:hover:bg-white/5"
                          >
                            {item.artwork ? (
                              <LazyImage src={toHttps(item.artwork)} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
                            ) : (
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-wechat-bubble dark:bg-white/5">
                                <Music className="h-4 w-4 text-wechat-time" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm text-wechat-text dark:text-gray-200">
                                {item.title}
                              </p>
                              <p className="truncate text-xs text-wechat-time">
                                {item.artist}
                                {item.album ? ` · ${item.album}` : ""}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    {!searching && searchResults.length === 0 && searchKeyword.trim() && !error && (
                      <p className="py-8 text-center text-xs text-wechat-time">
                        输入关键词后点击搜索
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Upload tab */}
          {musicTab === "upload" && (
            <div className="flex-1 overflow-y-auto p-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              <div className="space-y-4">
                {/* 封面 */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-wechat-time">
                    歌曲封面（可选）
                  </label>
                  {customMusicCover ? (
                    <div className="relative inline-block">
                      <LazyImage src={customMusicCover} alt="封面预览" className="h-24 w-24 rounded-lg object-cover" />
                      <button
                        type="button"
                        onClick={() => setCustomMusicCover("")}
                        className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                        aria-label="移除封面"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <label className="block">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            handleUploadCover(e.target.files);
                            e.target.value = "";
                          }}
                        />
                        <div className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-black/5 transition-colors hover:border-green-400 dark:border-white/5">
                          {uploadingCover ? (
                            <div className="h-6 w-6 animate-spin rounded-full border-2 border-wechat-time border-t-green-500" />
                          ) : (
                            <>
                              <ImagePlus className="h-6 w-6 text-wechat-time" />
                              <span className="mt-1 text-[10px] text-wechat-time">封面</span>
                            </>
                          )}
                        </div>
                      </label>
                      <button
                        type="button"
                        onClick={() => setMediaPickerMode("cover")}
                        className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-black/5 transition-colors hover:border-green-400 dark:border-white/5"
                      >
                        <Library className="h-6 w-6 text-wechat-time" />
                        <span className="mt-1 text-[10px] text-wechat-time">媒体库</span>
                      </button>
                    </div>
                  )}
                  <MediaPicker
                    open={mediaPickerMode === "cover"}
                    onClose={() => setMediaPickerMode(null)}
                    category="image"
                    title="从媒体库选择封面"
                    onSelect={(item: PickerMediaItem) => {
                      setCustomMusicCover(item.url);
                      setMediaPickerMode(null);
                    }}
                  />
                </div>

                {/* 歌曲名称 */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-wechat-time">
                    歌曲名称
                  </label>
                  <input
                    type="text"
                    value={customMusicName}
                    onChange={(e) => setCustomMusicName(e.target.value)}
                    placeholder="歌曲名称"
                    className="w-full rounded-lg border border-black/5 bg-wechat-bubble px-3 py-2 text-sm text-wechat-text placeholder:text-wechat-time focus:outline-none dark:border-white/5 dark:bg-white/5 dark:text-gray-200 dark:placeholder:text-gray-500"
                  />
                </div>

                {/* 艺术家 */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-wechat-time">
                    艺术家
                  </label>
                  <input
                    type="text"
                    value={customMusicArtist}
                    onChange={(e) => setCustomMusicArtist(e.target.value)}
                    placeholder="歌手名"
                    className="w-full rounded-lg border border-black/5 bg-wechat-bubble px-3 py-2 text-sm text-wechat-text placeholder:text-wechat-time focus:outline-none dark:border-white/5 dark:bg-white/5 dark:text-gray-200 dark:placeholder:text-gray-500"
                  />
                </div>

                {/* 音频来源：上传文件 / 直链URL 切换 */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-wechat-time">
                    音频来源
                  </label>
                  <div className="mb-2 flex gap-1 rounded-lg bg-wechat-bubble p-0.5 dark:bg-white/5">
                    <button
                      type="button"
                      onClick={() => setAudioUploadMode("file")}
                      className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
                        audioUploadMode === "file"
                          ? "bg-white text-wechat-text dark:bg-white/10 dark:text-gray-200"
                          : "text-wechat-time"
                      }`}
                    >
                      上传文件
                    </button>
                    <button
                      type="button"
                      onClick={() => setAudioUploadMode("url")}
                      className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
                        audioUploadMode === "url"
                          ? "bg-white text-wechat-text dark:bg-white/10 dark:text-gray-200"
                          : "text-wechat-time"
                      }`}
                    >
                      直链 URL
                    </button>
                  </div>

                  {audioUploadMode === "file" ? (
                    uploadedAudioUrl ? (
                      <div className="flex items-center justify-between rounded-lg border border-black/5 bg-wechat-bubble px-3 py-2.5 dark:border-white/5 dark:bg-white/5">
                        <div className="flex min-w-0 items-center gap-2">
                          <Music className="h-4 w-4 shrink-0 text-green-500" />
                          <span className="truncate text-sm text-wechat-text dark:text-gray-200">
                            {uploadedAudioName || "音频已上传"}
                          </span>
                        </div>
                        <label className="shrink-0 cursor-pointer text-xs text-green-600 hover:text-green-700 dark:text-green-400">
                          重新上传
                          <input
                            type="file"
                            accept="audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/aac"
                            className="hidden"
                            onChange={(e) => {
                              handleUploadAudio(e.target.files);
                              e.target.value = "";
                            }}
                          />
                        </label>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <label className="block">
                          <input
                            type="file"
                            accept="audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/aac"
                            className="hidden"
                            onChange={(e) => {
                              handleUploadAudio(e.target.files);
                              e.target.value = "";
                            }}
                          />
                          <div className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-black/5 py-6 transition-colors hover:border-green-400 dark:border-white/5">
                            {uploadingAudio ? (
                              <div className="h-8 w-8 animate-spin rounded-full border-2 border-wechat-time border-t-green-500" />
                            ) : (
                              <>
                                <Upload className="h-7 w-7 text-wechat-time" />
                                <p className="mt-1.5 text-sm text-wechat-time">
                                  点击上传音乐文件
                                </p>
                                <p className="mt-0.5 text-[11px] text-wechat-time">
                                  支持 MP3/WAV/OGG/AAC，最大 20MB
                                </p>
                              </>
                            )}
                          </div>
                        </label>
                        <button
                          type="button"
                          onClick={() => setMediaPickerMode("audio")}
                          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-black/5 py-2 text-xs text-wechat-time transition-colors hover:border-green-400 dark:border-white/5"
                        >
                          <Library className="h-3.5 w-3.5" />
                          从媒体库选择
                        </button>
                        <MediaPicker
                          open={mediaPickerMode === "audio"}
                          onClose={() => setMediaPickerMode(null)}
                          category="audio"
                          title="从媒体库选择音频"
                          onSelect={(item: PickerMediaItem) => {
                            setCustomMusicUrl(item.url);
                            setAudioUploadMode("url");
                            setMediaPickerMode(null);
                          }}
                        />
                      </div>
                    )
                  ) : (
                    <input
                      type="url"
                      value={customMusicUrl}
                      onChange={(e) => setCustomMusicUrl(e.target.value)}
                      placeholder="https://example.com/song.mp3"
                      className="w-full rounded-lg border border-black/5 bg-wechat-bubble px-3 py-2 text-sm text-wechat-text placeholder:text-wechat-time focus:outline-none dark:border-white/5 dark:bg-white/5 dark:text-gray-200 dark:placeholder:text-gray-500"
                    />
                  )}
                </div>

                {/* 歌词（可折叠） */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowLyricEditor((v) => !v)}
                    className="flex w-full items-center justify-between rounded-lg bg-wechat-bubble px-3 py-2 text-xs font-medium text-wechat-time transition-colors hover:bg-wechat-bubble/70 dark:bg-white/5 dark:text-gray-400"
                  >
                    <span className="flex items-center gap-1.5">
                      <Music className="h-3.5 w-3.5" />
                      编辑歌词
                      {customMusicLrc && (
                        <span className="rounded-full bg-green-500/15 px-1.5 py-0.5 text-[10px] text-green-600 dark:text-green-400">
                          已编辑
                        </span>
                      )}
                    </span>
                    <span className="text-[10px]">{showLyricEditor ? "收起" : "展开"}</span>
                  </button>
                  {showLyricEditor && (
                    <div className="mt-2">
                      <LyricEditor
                        audioUrl={audioUploadMode === "file" ? uploadedAudioUrl : customMusicUrl.trim()}
                        value={customMusicLrc}
                        onChange={setCustomMusicLrc}
                      />
                    </div>
                  )}
                </div>

                {/* 确认按钮 */}
                <button
                  type="button"
                  onClick={handleConfirmUploadMusic}
                  disabled={(audioUploadMode === "file" ? !uploadedAudioUrl : !customMusicUrl.trim())}
                  className="w-full rounded-lg py-2.5 text-sm font-medium transition-colors disabled:bg-wechat-bubble disabled:text-wechat-time enabled:bg-green-500 enabled:text-white enabled:hover:bg-green-600 dark:disabled:bg-white/5 dark:disabled:text-gray-500"
                >
                  确认使用
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== Location Picker (微信式地图选位) ===== */}
      {showLocationPanel && (
        <LocationPicker
          initial={location}
          onSelect={(loc) => {
            setLocation(loc);
            setShowLocationPanel(false);
          }}
          onClose={() => setShowLocationPanel(false)}
        />
      )}

      {/* ===== Douban Picker (豆瓣影单选择器) ===== */}
      {showDoubanPicker && (
        <DoubanPicker
          open={showDoubanPicker}
          onClose={() => setShowDoubanPicker(false)}
          onSelect={(item) => setDouban(item)}
        />
      )}

      </div>
    </div>,
    document.body
  );
}
