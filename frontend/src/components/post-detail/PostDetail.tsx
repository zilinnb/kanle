"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Music, Pause, Play } from "lucide-react";
import { Post, PostMusic, formatDetailTime, getPostSourceLabel } from "@/lib/mock-data";
import { resolveAvatar } from "@/lib/avatar";
import { normalizeImages } from "@/lib/post-image";
import { isCdnUrl } from "@/lib/upload";
import { getImageUrl } from "@/lib/site-settings-store";
import { renderContent } from "@/lib/sanitize";
import { getCurrentUser, authFetchHeaders } from "@/lib/auth";
import { useMusicPlayer, resolvePostMusicUrl } from "@/lib/music-player-store";
import { getGlobalAudio } from "@/lib/global-audio";
import { useEditPost } from "@/lib/edit-post-store";
import ImageGrid from "@/components/ImageGrid";
import VideoPlayer from "@/components/VideoPlayer";
import InteractionBubble from "@/components/InteractionBubble";
import ActionMenu from "@/components/ActionMenu";
import CommentSection from "@/components/CommentSection";
import LazyImage from "@/components/LazyImage";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

interface PostDetailProps {
  post: Post;
}

function formatMusicInfo(music: PostMusic): { title: string; subtitle?: string } {
  function clean(s: string): string {
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
  let name = clean(music.name || "");
  let artist = clean(music.artist || "");
  if (!artist && name.includes(" - ")) {
    const parts = name.split(" - ");
    name = clean(parts[0]);
    artist = clean(parts.slice(1).join(" - "));
  }
  if (!name && music.name) name = clean(music.name);
  return { title: name || "未知歌曲", subtitle: artist || undefined };
}

export default function PostDetail({ post }: PostDetailProps) {
  const [likes, setLikes] = useState<Array<{ name: string; email?: string }>>(post.likes || []);
  const [liked, setLiked] = useState(false);
  const [liking, setLiking] = useState(false);
  const [comments, setComments] = useState(post.comments || []);
  const [replyTo, setReplyTo] = useState<string | undefined>(undefined);
  const [canEdit, setCanEdit] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pinned, setPinned] = useState(!!post.pinned);
  const [showComments, setShowComments] = useState(false);
  const commentSectionRef = useRef<HTMLDivElement>(null);
  const openEdit = useEditPost((s) => s.open);

  const activePostId = useMusicPlayer((s) => s.activePostId);
  const isPlaying = useMusicPlayer((s) => s.isPlaying);
  const isLoading = useMusicPlayer((s) => s.isLoading);
  const setActiveMusic = useMusicPlayer((s) => s.setActive);
  const isThisActive = activePostId === post.id;
  const isThisPlaying = isThisActive && isPlaying;
  const isThisLoading = isThisActive && isLoading;

  useEffect(() => {
    const user = getCurrentUser();
    if (user?.isLoggedIn) {
      setIsAdmin(true);
      const sameEmail = post.author.email && user.email && post.author.email === user.email;
      const sameNickname = post.author.nickname === user.nickname;
      setCanEdit(sameEmail || sameNickname);
    }
  }, [post.author.email, post.author.nickname]);

  // 仅在挂载时（或 post.id 变化时）根据后端返回的 meLiked 推导 liked 初始值。
  // WP Ulike：meLiked 由后端基于 cookie visitorId/email/userId 判断，
  // cookie 自动随请求携带，SSR 时也会准确，无需前端 localStorage 兜底。
  useEffect(() => {
    setLiked(!!post.meLiked);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id, post.meLiked]);

  useEffect(() => {
    setComments(post.comments || []);
  }, [post.comments]);

  // 客户端首次加载：用真实 cookie/token 获取 meLiked 状态，覆盖 SSR 数据
  // SSR 拿不到 localStorage token，初始 HTML 中 meLiked 可能不准（登录用户走 cookie visitorId 维度
  // 但该维度点赞已被 migrateLikesToUserId 升级，导致 meLiked 错误）。
  // 必须带 Authorization header 让后端识别登录用户，走 userId 维度查询。
  useEffect(() => {
    const email = (typeof window !== "undefined" && localStorage.getItem("visitor_email")) || "";
    const url = `${API_URL}/posts/${post.id}${email ? `?email=${encodeURIComponent(email)}` : ""}`;
    fetch(url, {
      cache: "no-store",
      credentials: "include",
      headers: authFetchHeaders(),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        if (typeof data.meLiked === "boolean") setLiked(data.meLiked);
        if (Array.isArray(data.likes)) setLikes(data.likes);
        if (Array.isArray(data.comments)) setComments(data.comments);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id]);

  // 从通知/邮件链接跳转：/moments/{id}#comment-{commentId}
  const urlNavRef = useRef(false);

  // 无 hash 时重置滚动位置到顶部（避免 TopBar 遮挡）
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.startsWith("#comment-")) {
      window.scrollTo(0, 0);
      const scrollRoot = document.getElementById("scroll-root");
      if (scrollRoot) scrollRoot.scrollTop = 0;
    }
  }, [post.id]);

  // 评论加载后滚动到 hash 指定的评论（监听 comments 变化，避免固定延迟不够的问题）
  useEffect(() => {
    if (urlNavRef.current) return;
    if (comments.length === 0) return;
    const hash = window.location.hash;
    if (!hash.startsWith("#comment-")) return;
    const commentId = hash.substring(9);
    const target = comments.find((c) => c.id === commentId);
    if (!target) return;

    urlNavRef.current = true;
    setShowComments(true);

    // 等待 DOM 渲染后滚动（双 rAF 确保 React commit + paint 完成）
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const el = document.getElementById(`comment-${commentId}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.style.transition = "background-color 0.3s ease";
          el.style.backgroundColor = "rgba(128, 128, 128, 0.14)";
          setTimeout(() => { el.style.backgroundColor = ""; }, 2500);
        }
        // 清除 hash 避免刷新重复触发
        window.history.replaceState({}, "", window.location.pathname);
      })
    );
  }, [comments]);

  const handleLike = async () => {
    if (liking) return;
    setLiking(true);
    // 乐观更新：点击瞬间翻转 UI，失败回滚
    const prevLiked = liked;
    setLiked(!prevLiked);
    const user = getCurrentUser();
    const name = user?.nickname || "访客";
    const email = user?.email || "";
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (user?.isLoggedIn && user.token) {
        headers.Authorization = `Bearer ${user.token}`;
      }
      const res = await fetch(`${API_URL}/posts/${post.id}/likes`, {
        method: "POST",
        headers,
        credentials: "include", // 携带 visitorId cookie
        body: JSON.stringify({ name, email }),
      });
      if (res.status === 403) {
        setLiked(prevLiked);
        const data = await res.json().catch(() => ({}));
        if (data?.message) alert(data.message);
        return;
      }
      if (!res.ok) {
        setLiked(prevLiked);
        return;
      }
      const data = await res.json();
      setLiked(data.liked);
      if (Array.isArray(data.likes)) {
        setLikes(data.likes);
      }
    } catch {
      setLiked(prevLiked);
    } finally {
      setLiking(false);
    }
  };

  const handlePin = async () => {
    const user = getCurrentUser();
    if (!user?.isLoggedIn || !user.token) return;
    const next = !pinned;
    try {
      const res = await fetch(`${API_URL}/posts/${post.id}/pin`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({ pinned: next }),
      });
      if (res.ok) setPinned(next);
    } catch {}
  };

  const handleCommentClick = () => {
    setShowComments((prev) => {
      if (!prev) {
        requestAnimationFrame(() => {
          commentSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        });
      }
      return !prev;
    });
  };

  const handleMusicClick = () => {
    if (!post.music) return;
    const audio = getGlobalAudio();
    if (!audio) return;
    if (isThisActive) {
      if (audio.paused) audio.play().catch(() => {});
      else audio.pause();
      return;
    }
    const playUrl = resolvePostMusicUrl(post.music);
    if (!playUrl) return;
    setActiveMusic(post.id, {
      postId: post.id,
      url: playUrl,
      name: post.music.name,
      artist: post.music.artist,
      cover: post.music.cover,
      neteaseId: post.music.neteaseId || "",
      platform: post.music.platform,
      musicId: post.music.musicId,
      songmid: post.music.songmid,
      extra: post.music.extra,
      lrc: post.music.lrc,
    });
    audio.src = playUrl;
    audio.play().catch(() => {});
  };

  const displayName = post.isAd ? post.adNickname || "广告" : post.author.nickname;
  const authorAvatar = post.isAd
    ? getImageUrl(post.adAvatar || "")
    : resolveAvatar(post.author.avatar, post.author.email || "", 96);

  const musicInfo = post.music ? formatMusicInfo(post.music) : null;

  return (
    <article id={`post-${post.id}`} className="flex gap-3 px-4 py-4 sm:px-5 md:px-6 scroll-mt-16">
      {/* Avatar */}
      <Link
        href="/archives"
        className="relative block h-10 w-10 shrink-0 overflow-hidden rounded-[5px] bg-wechat-bubble md:h-11 md:w-11"
      >
        <Image
          src={authorAvatar}
          alt={displayName}
          fill
          className="object-cover"
          sizes="44px"
          unoptimized={authorAvatar.endsWith(".svg") || isCdnUrl(authorAvatar)}
        />
      </Link>

      {/* Content column */}
      <div className="min-w-0 flex-1">
        <h2 className="text-[15px] font-medium leading-5 text-wechat-nickname md:text-[16px]">
          {displayName}
        </h2>

        {/* Content text */}
        {post.content && (
          <div
            className="rich-content mt-1 text-[15px] leading-[24px] text-wechat-text md:text-[16px] md:leading-[24px]"
            dangerouslySetInnerHTML={{ __html: renderContent(post.content) }}
          />
        )}

        {/* Images */}
        {!post.video && post.images && post.images.length > 0 && (
          <div className="mt-2">
            <ImageGrid images={normalizeImages(post.images)} />
          </div>
        )}

        {/* Video */}
        {post.video && (
          <div className="mt-2">
            <VideoPlayer video={post.video} postId={post.id} />
          </div>
        )}

        {/* Music card */}
        {post.music && (
          <div
            onClick={handleMusicClick}
            className="mt-2 flex w-full max-w-[240px] md:max-w-[280px] cursor-pointer items-stretch overflow-hidden rounded-[8px] bg-[#f2f2f2] transition-opacity active:opacity-80 dark:bg-[#2a2a30]"
          >
            <div className="relative h-[72px] w-[72px] shrink-0 md:h-[80px] md:w-[80px] overflow-hidden bg-black/5 dark:bg-white/5">
              {post.music.cover ? (
                <LazyImage
                  src={getImageUrl(post.music.cover)}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Music className="h-6 w-6 text-black/30 dark:text-white/30" />
                </div>
              )}
            </div>
            <div className="flex min-w-0 flex-1 items-center gap-2 bg-white/35 px-3 dark:bg-white/[0.04]">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium leading-[20px] text-black/[0.87] dark:text-white/90 md:text-[15px] md:leading-[21px]">
                  {musicInfo?.title}
                </p>
                <p className="truncate text-[12px] leading-[16px] text-black/50 dark:text-white/50 md:text-[13px] md:leading-[17px]">
                  {musicInfo?.subtitle}
                </p>
              </div>
              {isThisLoading ? (
                <span className="h-3 w-3 shrink-0 rounded-full bg-black/55 animate-pulse dark:bg-white/55" />
              ) : isThisPlaying ? (
                <Pause className="h-3.5 w-3.5 shrink-0 text-black/55 dark:text-white/55" fill="currentColor" />
              ) : (
                <Play className="h-3.5 w-3.5 shrink-0 translate-x-[1px] text-black/55 dark:text-white/55" fill="currentColor" />
              )}
            </div>
          </div>
        )}

        {/* Link card */}
        {post.linkCard && (
          <a
            href={post.linkCard.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 flex w-full max-w-[240px] md:max-w-[280px] items-stretch overflow-hidden rounded-[8px] bg-[#f2f2f2] transition-colors hover:bg-[#eaeaea] active:bg-[#e0e0e0] dark:bg-[#2a2a30] dark:hover:bg-[#33333a] dark:active:bg-[#3a3a42]"
          >
            <div className="flex h-[72px] w-[72px] shrink-0 md:h-[80px] md:w-[80px] items-center justify-center overflow-hidden bg-black/[0.02] dark:bg-white/[0.02]">
              {post.linkCard.image && (
                <LazyImage
                  src={getImageUrl(post.linkCard.image)}
                  alt=""
                  className="h-full w-full object-contain p-1.5"
                />
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col justify-center bg-white/35 px-3 dark:bg-white/[0.04]">
              <p className="line-clamp-1 text-[14px] font-medium leading-[20px] text-black/[0.87] dark:text-white/90 md:text-[15px] md:leading-[21px]">
                {post.linkCard.title || post.linkCard.url}
              </p>
              {post.linkCard.description && (
                <p className="line-clamp-2 mt-0.5 text-[12px] leading-[15px] text-black/50 dark:text-white/50 md:text-[13px] md:leading-[16px]">
                  {post.linkCard.description}
                </p>
              )}
            </div>
          </a>
        )}

        {/* Location */}
        {post.location && typeof post.location === "object" && (
          <div className="mt-2">
            <span className="text-[13px] text-wechat-link md:text-[14px]">
              {post.location.city
                ? `${post.location.city} · ${post.location.name}`
                : post.location.name}
            </span>
          </div>
        )}

        {/* Time + action */}
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[13px] text-wechat-time md:text-[14px]">
            <time>{formatDetailTime(post.createdAt)}</time>
            {post.isAd && (
              <span className="rounded-[4px] bg-[#ececec] px-2 py-0.5 text-[11px] font-medium text-[#9a9a9a] dark:bg-white/[0.1]">
                广告
              </span>
            )}
            {(() => {
              const src = getPostSourceLabel(post);
              if (!src) return null;
              return (
                <>
                  <span className="text-[16px] leading-none text-wechat-time/60">·</span>
                  <span>来自 {src}</span>
                </>
              );
            })()}
          </div>
          <ActionMenu
            onLike={post.likesDisabled ? undefined : handleLike}
            onComment={post.commentsDisabled ? undefined : handleCommentClick}
            onEdit={canEdit ? () => openEdit(post) : undefined}
            onPin={isAdmin && !post.isAd ? handlePin : undefined}
            liked={liked}
            pinned={pinned}
          />
        </div>

        {/* Likes (text) + Comments — 微信朋友圈详情风格 */}
        {(likes.length > 0 || comments.length > 0) && (
          <div className="mt-2">
            <InteractionBubble
              likes={likes}
              comments={comments}
              ownerEmail={post.author?.email}
              showAvatars
              onReply={(commentId) => {
                setReplyTo(commentId);
                setShowComments(true);
                requestAnimationFrame(() => {
                  commentSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
                });
              }}
            />
          </div>
        )}

        {/* Comment section — 仅通过 ActionMenu 的"评论"触发显示 */}
        <div ref={commentSectionRef}>
          {showComments && (
            <CommentSection
              postId={post.id}
              initialComments={comments}
              initialReplyTo={replyTo}
              onReplyCleared={() => setReplyTo(undefined)}
              onCommentAdded={(c) => setComments((prev) => [...prev, c])}
              connected={likes.length > 0 || comments.length > 0}
              autoFocus
            />
          )}
        </div>
      </div>
    </article>
  );
}
