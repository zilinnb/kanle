"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, type CSSProperties } from "react";
import { Music, Pause, Pin, FileText } from "lucide-react";
import { Post, formatRelativeTime, getPostSourceLabel } from "@/lib/mock-data";
import { resolveAvatar } from "@/lib/avatar";
import { normalizeImages } from "@/lib/post-image";
import { toAbsoluteUrl, toHttps } from "@/lib/upload";
import { getCurrentUser } from "@/lib/auth";
import { renderContent } from "@/lib/sanitize";
import { useMusicPlayer, resolvePostMusicUrl } from "@/lib/music-player-store";
import { useEditPost } from "@/lib/edit-post-store";
import { useSiteSettings } from "@/lib/site-settings-store";
import { getGlobalAudio } from "@/lib/global-audio";
import ImageGrid from "./ImageGrid";
import VideoPlayer from "./VideoPlayer";
import InteractionBubble from "./InteractionBubble";
import ActionMenu from "./ActionMenu";
import CommentSection from "./CommentSection";
import LazyImage from "./LazyImage";
import DoubanEmbedCard from "./article/DoubanEmbedCard";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

// 桌面端滚动容器是 #scroll-root（固定定位 div），手机端是 window
function smoothScrollBy(delta: number) {
  if (typeof window === "undefined") return;
  const isDesktop = window.matchMedia("(min-width: 768px)").matches;
  const container = isDesktop ? document.getElementById("scroll-root") : null;
  if (container) {
    container.scrollBy({ top: delta, behavior: "smooth" });
  } else {
    window.scrollBy({ top: delta, behavior: "smooth" });
  }
}

interface PostCardProps {
  post: Post;
  index: number;
  /** 管理后台传入时显示删除入口 */
  onDelete?: () => void;
}

function stripRichEmbeds(html: string): string {
  return html
    .replace(/<div\s+[^>]*data-embed="[^"]*"[^>]*>[\s\S]*?<\/div>/gi, "")
    .replace(/<a\s+[^>]*class="[^"]*link-card[^"]*"[^>]*>[\s\S]*?<\/a>/gi, "");
}

export default function PostCard({ post, index, onDelete }: PostCardProps) {
  const router = useRouter();
  const isArticle = post.type === "article";
  const articleDetailUrl = `/articles/${post.shortId || post.id}`;
  const articleExcerpt = post.excerpt || stripRichEmbeds(post.content || "").replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
  const [likes, setLikes] = useState<Array<{ name: string; email?: string }>>(post.likes || []);
  const [liked, setLiked] = useState(false);
  const [liking, setLiking] = useState(false);
  const [comments, setComments] = useState(post.comments || []);
  const [showComments, setShowComments] = useState(false);
  const [replyTo, setReplyTo] = useState<string | undefined>(undefined);
  const [canEdit, setCanEdit] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pinned, setPinned] = useState(!!post.pinned);
  const [avatarLoaded, setAvatarLoaded] = useState(false);
  // 长文展开/收起
  // clippable 默认 true：SSR 即折叠，避免硬刷新时长内容先展开后折叠的闪屏
  // measured 控制"展开"按钮显示，避免短内容按钮闪现
  const [contentExpanded, setContentExpanded] = useState(false);
  const [clippable, setClippable] = useState(true);
  const [measured, setMeasured] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const collapseLength = useSiteSettings((s) => s.postCollapseLength);
  const defaultCover = useSiteSettings((s) => s.defaultCover);
  const openEdit = useEditPost((s) => s.open);
  // 动态音乐接管顶栏播放器：点击动态音乐卡片后由顶栏播放，歌词也在顶栏显示
  const activePostId = useMusicPlayer((s) => s.activePostId);
  const isPlaying = useMusicPlayer((s) => s.isPlaying);
  const isLoading = useMusicPlayer((s) => s.isLoading);
  const setActiveMusic = useMusicPlayer((s) => s.setActive);
  // 当前动态是否正在顶栏播放
  const isThisActive = activePostId === post.id;
  const isThisPlaying = isThisActive && isPlaying;
  const isThisLoading = isThisActive && isLoading;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const user = getCurrentUser();
    if (user?.isLoggedIn) {
      setIsAdmin(true);
      const sameEmail = post.author.email && user.email && post.author.email === user.email;
      const sameNickname = post.author.nickname === user.nickname;
      setCanEdit(sameEmail || sameNickname);
    }
  }, [post.author.email, post.author.nickname]);

  // 长文折叠检测：纯文字字数超过配置阈值时显示展开/收起按钮
  // article 类型始终折叠并跳转到详情页，moment 类型基于字数判断
  useEffect(() => {
    const el = contentRef.current;
    if (!el) {
      setMeasured(true);
      return;
    }
    // 计算纯文本字数（去除 HTML 标签）
    const textLength = (el.textContent || "").replace(/\s/g, "").length;
    // collapseLength=0 表示不折叠；article 总是折叠（点击进入详情页）
    setClippable(isArticle || (collapseLength > 0 && textLength > collapseLength));
    setMeasured(true);
  }, [post.content, collapseLength, isArticle]);

  // 根据折叠字数和屏幕宽度动态计算 line-clamp 行数
  // 手机端每行约 18 个字，桌面端每行约 50 个字
  const charsPerLine = mounted && window.matchMedia("(min-width: 768px)").matches ? 50 : 18;
  const clampLines = Math.max(1, Math.ceil(collapseLength / charsPerLine));

  // 仅在挂载时（或 post.id 变化时）根据后端返回的 meLiked 推导 liked 初始值。
  // WP Ulike：meLiked 由后端基于 cookie visitorId/email/userId 判断，
  // cookie 自动随请求携带，SSR 时也会准确，无需前端 localStorage 兜底。
  useEffect(() => {
    setLiked(!!post.meLiked);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id, post.meLiked]);

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
        credentials: "include",
        body: JSON.stringify({ pinned: next }),
      });
      if (res.ok) {
        setPinned(next);
        router.refresh();
      }
    } catch {
      // ignore
    }
  };

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
        credentials: "include", // 关键：携带 cookie（visitorId）
        body: JSON.stringify({ name, email }),
      });
      if (res.status === 403) {
        // likesDisabled：回滚 UI 并提示
        setLiked(prevLiked);
        const data = await res.json().catch(() => ({}));
        if (data?.message) alert(data.message);
        return;
      }
      if (!res.ok) {
        setLiked(prevLiked); // 回滚
        return;
      }
      const data = await res.json();
      setLiked(data.liked);
      if (Array.isArray(data.likes)) {
        setLikes(data.likes);
      }
    } catch {
      setLiked(prevLiked); // 网络错误回滚
    } finally {
      setLiking(false);
    }
  };

  const handleCommentClick = () => {
    setShowComments((prev) => !prev);
  };

  // 点击动态音乐卡片：由全局 audio 接管播放，悬浮卡片由 store.activePostMusic 自动控制显示
  // iOS 要求 play() 必须在用户手势同步上下文中调用，所以这里同步设置 src 并 play
  const handleMusicClick = () => {
    if (!post.music) return;
    const audio = getGlobalAudio();
    if (!audio) return;

    // 已是当前动态：切换播放/暂停
    if (isThisActive) {
      if (audio.paused) {
        audio.play().catch(() => {});
      } else {
        audio.pause();
      }
      return;
    }

    // 解析可播放 URL：MusicFree 插件源走 /api/music/stream 代理（实时拿新 URL，避免直链过期）
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

  useEffect(() => {
    setComments(post.comments || []);
  }, [post.comments]);

  // 当 PostList 的 mount fetch 拿到最新数据后，post.likes 会更新，
  // 需同步到 likes 状态，否则刷新后点赞列表仍显示旧数据
  useEffect(() => {
    setLikes(post.likes || []);
  }, [post.likes]);

  // 从邮件通知链接跳转：?post={postId}#comment-{commentId}
  const urlNavRef = useRef(false);
  useEffect(() => {
    if (urlNavRef.current) return;
    urlNavRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const postParam = params.get("post");
    if (postParam !== post.id) return;

    const hash = window.location.hash;
    const commentId = hash.startsWith("#comment-") ? hash.substring(9) : null;

    // 等待入场动画结束后再滚动
    setTimeout(() => {
      if (commentId) {
        const el = document.getElementById(`comment-${commentId}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.style.transition = "background-color 0.3s ease";
          el.style.backgroundColor = "rgba(128, 128, 128, 0.14)";
          setTimeout(() => { el.style.backgroundColor = ""; }, 2500);
          setShowComments(true);
          return;
        }
      }
      const postEl = document.getElementById(`post-${post.id}`);
      if (postEl) {
        postEl.scrollIntoView({ behavior: "smooth", block: "center" });
        postEl.style.transition = "background-color 0.3s ease";
        postEl.style.backgroundColor = "rgba(128, 128, 128, 0.08)";
        setTimeout(() => { postEl.style.backgroundColor = ""; }, 1800);
      }
    }, 800);

    // 清除 URL 参数，避免刷新重复触发
    window.history.replaceState({}, "", window.location.pathname);
  }, [post.id]);

  const isAd = !!post.isAd;
  const displayName = isAd ? (post.adNickname || "广告") : post.author.nickname;
  const authorAvatar = isAd
    ? toAbsoluteUrl(post.adAvatar || "")
    : resolveAvatar(post.author.avatar, post.author.email || "", 96);

  return (
    <article
      id={`post-${post.id}`}
      className="flex gap-3 px-4 py-4 sm:px-5 md:px-6 animate-fade-in-up scroll-mt-16"
      style={{ animationDelay: `${index * 60}ms`, opacity: 0 }}
    >
      {/* Avatar */}
      {isAd ? (
        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-[5px] bg-wechat-bubble md:h-11 md:w-11">
          <Image
            src={authorAvatar}
            alt={displayName}
            fill
            onLoad={() => setAvatarLoaded(true)}
            className={`object-cover transition-opacity duration-500 ${avatarLoaded ? "opacity-100" : "opacity-0"}`}
            sizes="44px"
            unoptimized={authorAvatar.endsWith(".svg")}
          />
        </div>
      ) : (
        <Link
          href="/archives"
          className="relative block h-10 w-10 shrink-0 overflow-hidden rounded-[5px] bg-wechat-bubble md:h-11 md:w-11"
          aria-label={`查看${displayName}的归档`}
        >
          <Image
            src={authorAvatar}
            alt={displayName}
            fill
            onLoad={() => setAvatarLoaded(true)}
            className={`object-cover transition-opacity duration-500 ${avatarLoaded ? "opacity-100" : "opacity-0"}`}
            sizes="44px"
            unoptimized={authorAvatar.endsWith(".svg")}
          />
        </Link>
      )}

      {/* Content column */}
      <div className="min-w-0 flex-1">
        <h3 className="flex items-center justify-between gap-2 text-[15px] font-medium leading-5 text-wechat-nickname md:text-[16px]">
          <span className="flex min-w-0 items-center gap-1">
            <span className="truncate">{displayName}</span>
            {pinned && (
              <Pin className="h-[15px] w-[15px] shrink-0 rotate-45 text-[#9a9a9a]" fill="currentColor" strokeWidth={2} />
            )}
          </span>
          {isAd ? (
            <span className="shrink-0 rounded-[4px] bg-[#ececec] px-2 py-0.5 text-[11px] font-medium leading-tight text-[#9a9a9a] dark:bg-white/[0.1] dark:text-[#9a9a9a]">
              广告
            </span>
          ) : pinned ? (
            <span className="shrink-0 rounded-[4px] bg-[#ececec] px-2 py-0.5 text-[11px] font-medium leading-tight text-[#9a9a9a] dark:bg-white/[0.1] dark:text-[#9a9a9a]">
              置顶
            </span>
          ) : null}
        </h3>

        {!isArticle && post.content && (
          <div className="mt-1">
            <div
              ref={contentRef}
              className={`rich-content relative text-[15px] leading-[23px] text-wechat-text md:text-[16px] md:leading-[24px] ${
                clippable && !contentExpanded ? "collapsed" : ""
              }`}
              style={
                clippable && !contentExpanded
                  ? ({ WebkitLineClamp: clampLines } as CSSProperties)
                  : undefined
              }
              dangerouslySetInnerHTML={{ __html: renderContent(post.content) }}
            />
            {clippable && measured && (
              <button
                type="button"
                onClick={() => {
                  // 文章类型：点击展开直接跳转到文章详情页
                  if (isArticle) {
                    router.push(articleDetailUrl);
                    return;
                  }
                  if (contentExpanded) {
                    const content = contentRef.current;
                    setContentExpanded(false);
                    requestAnimationFrame(() => {
                      if (content) {
                        // 收起后内容高度缩小，页面变短，当前动态可能被挤出视口上方
                        // 如果内容顶部低于 80px（被 TopBar 遮挡或在视口上方），上滚回正
                        const afterTop = content.getBoundingClientRect().top;
                        if (afterTop < 80) {
                          smoothScrollBy(afterTop - 80);
                        }
                      }
                    });
                  } else {
                    setContentExpanded(true);
                  }
                }}
                className="mt-1.5 text-[14px] text-[#b2b2b2] transition-opacity hover:opacity-70 active:opacity-50 dark:text-[#888]"
              >
                {isArticle ? "展开" : contentExpanded ? "收起" : "展开"}
              </button>
            )}
          </div>
        )}

        {!isArticle && (post.video ? (
          <VideoPlayer video={post.video} postId={post.id} />
        ) : (
          <ImageGrid images={normalizeImages(post.images)} />
        ))}

        {/* 文章类型：链接卡片展示（左封面 + 右标题/摘要） */}
        {isArticle && (
          <Link
            href={articleDetailUrl}
            className="mt-2 flex w-full max-w-[240px] items-stretch overflow-hidden rounded-[8px] bg-[#f2f2f2] transition-colors hover:bg-[#eaeaea] active:bg-[#e0e0e0] dark:bg-[#2a2a30] dark:hover:bg-[#33333a] dark:active:bg-[#3a3a42] md:max-w-[280px]"
          >
            {/* 左侧方形封面 */}
            <div className="relative h-[72px] w-[72px] shrink-0 md:h-[80px] md:w-[80px] overflow-hidden bg-black/5 dark:bg-white/5">
              {(post.cover || defaultCover) ? (
                <LazyImage
                  src={toHttps(toAbsoluteUrl(post.cover || defaultCover))}
                  alt={post.title || "文章封面"}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <FileText className="h-6 w-6 text-black/30 dark:text-white/30 md:h-7 md:w-7" />
                </div>
              )}
            </div>
            {/* 右侧标题 + 摘要 */}
            <div className="flex min-w-0 flex-1 flex-col justify-center bg-white/35 px-3 dark:bg-white/[0.04]">
              <p className="line-clamp-1 text-[14px] font-medium leading-[20px] text-black/[0.87] dark:text-white/90 md:text-[15px] md:leading-[21px]">
                {post.title || "无标题文章"}
              </p>
              {articleExcerpt && (
                <p className="line-clamp-2 mt-0.5 text-[12px] leading-[15px] text-black/50 dark:text-white/50 md:text-[13px] md:leading-[16px]">
                  {articleExcerpt}
                </p>
              )}
            </div>
          </Link>
        )}

        {/* Link card — 微信朋友圈链接卡片样式（文章类型的链接卡片已内联到正文，仅在详情页显示） */}
        {!isArticle && post.linkCard && (
          <a
            href={post.linkCard.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 flex w-full max-w-[240px] items-stretch overflow-hidden rounded-[8px] bg-[#f2f2f2] transition-colors hover:bg-[#eaeaea] active:bg-[#e0e0e0] dark:bg-[#2a2a30] dark:hover:bg-[#33333a] dark:active:bg-[#3a3a42] md:max-w-[280px]"
          >
            {/* 左侧方形封面 */}
            <div className="flex h-[72px] w-[72px] shrink-0 md:h-[80px] md:w-[80px] items-center justify-center overflow-hidden bg-black/[0.02] dark:bg-white/[0.02]">
              {post.linkCard.image && (
                <LazyImage
                  src={post.linkCard.image}
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

        {/* Music card — 微信朋友圈官方音乐卡片样式（占满整栏）
            点击后由顶栏全局 audio 接管播放，歌词在顶栏显示
            文章类型的音乐已内联到正文，仅在详情页显示 */}
        {!isArticle && post.music && (
          <div
            onClick={handleMusicClick}
            className="mt-2 flex w-full max-w-[240px] cursor-pointer items-stretch overflow-hidden rounded-[8px] bg-[#f2f2f2] transition-opacity active:opacity-80 dark:bg-[#2a2a30] md:max-w-[280px]"
          >
            {/* 左侧方形封面 — 紧贴边框，无间距，高度增加 */}
            <div className="relative h-[72px] w-[72px] shrink-0 md:h-[80px] md:w-[80px] overflow-hidden bg-black/5 dark:bg-white/5">
              {post.music.cover ? (
                <LazyImage
                  src={toHttps(typeof post.music.cover === "string" && post.music.cover.startsWith("http") ? post.music.cover : `${API_URL.replace("/api", "")}${post.music.cover}`)}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Music className="h-6 w-6 text-black/30 dark:text-white/30 md:h-7 md:w-7" />
                </div>
              )}
            </div>

            {/* 右侧内容区 — 半透明背景 */}
            <div className="flex min-w-0 flex-1 items-center gap-2 bg-white/35 px-3 dark:bg-white/[0.04]">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium leading-[20px] text-black/[0.87] dark:text-white/90 md:text-[15px] md:leading-[21px]">
                  {post.music.name}
                </p>
                <p className="truncate text-[12px] leading-[16px] text-black/50 dark:text-white/50 md:text-[13px] md:leading-[17px]">
                  {post.music.artist}
                </p>
              </div>
              {/* 播放/暂停图标：加载中显示闪烁圆点，播放中显示暂停，否则显示播放 */}
              {isThisLoading ? (
                <span className="h-3 w-3 shrink-0 rounded-full bg-black/55 animate-pulse dark:bg-white/55" />
              ) : isThisPlaying ? (
                <Pause className="h-3.5 w-3.5 shrink-0 text-black/55 dark:text-white/55" fill="currentColor" />
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="h-3.5 w-3.5 shrink-0 translate-x-[1px] text-black/55 dark:text-white/55"
                >
                  <path d="M8 5.14v13.72c0 .93 1.03 1.5 1.83 1.01l11.3-6.86a1.25 1.25 0 0 0 0-2.14L9.83 4.13A1.25 1.25 0 0 0 8 5.14Z" />
                </svg>
              )}
            </div>
          </div>
        )}

        {/* Douban card — 豆瓣影单卡片，与链接卡片/音乐卡片同层级 */}
        {!isArticle && post.douban && (
          <DoubanEmbedCard item={post.douban} />
        )}

        {/* Location — 显示在时间上方，格式：城市 · 地点名 */}
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
            <time>{formatRelativeTime(post.createdAt)}</time>
            {(() => {
              const src = getPostSourceLabel(post);
              if (!src) return null;
              return (
                <>
                  <span className="text-[15px] leading-none text-wechat-time/60">·</span>
                  <span>来自 {src}</span>
                </>
              );
            })()}
          </div>
          <ActionMenu
            onLike={post.likesDisabled ? undefined : handleLike}
            onComment={post.commentsDisabled ? undefined : handleCommentClick}
            onEdit={canEdit && !isArticle ? () => openEdit(post) : undefined}
            onDelete={onDelete}
            onPin={isAdmin && !post.isAd ? handlePin : undefined}
            liked={liked}
            pinned={pinned}
          />
        </div>

        {/* Likes + comments bubble */}
        <InteractionBubble
          likes={likes}
          comments={comments}
          ownerEmail={post.author?.email}
          onReply={(commentId) => {
            setReplyTo(commentId);
            setShowComments(true);
          }}
        />

        {/* Comment section */}
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
    </article>
  );
}
