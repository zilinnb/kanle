"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { Bell, Link2, MessageSquare, Music, Play, X } from "lucide-react";
import { actorAvatarUrl } from "@/lib/avatar";
import { getCurrentUser, CurrentUser } from "@/lib/auth";
import { toAbsoluteUrl } from "@/lib/upload";
import { useExitAnimation } from "@/lib/use-exit-animation";
import { useSiteSettings } from "@/lib/site-settings-store";
import { renderTextWithEmoji } from "@/lib/emoji";
import FadeImage from "@/components/FadeImage";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

interface NotificationItem {
  id: string;
  type: "like" | "comment" | "reply";
  actor: string;
  actorEmail?: string;
  content: string;
  postPreview: string;
  postType: "music" | "image" | "link" | "text" | "video";
  postImage: string;
  postId: string;
  /** 动态短 ID，用于构造 /moments/{shortId} 短链接 */
  shortId?: string;
  /** 文章类型通知：true=跳转 /articles/{postId}，false=跳转 /moments/{shortId} */
  isArticle?: boolean;
  /** 评论/回复通知携带的目标评论 ID，用于跳转到详情页定位评论锚点 */
  commentId?: string;
  replyTo?: string | null;
  createdAt: string;
  isLive?: boolean;
}

interface AdminNotificationsProps {
  variant?: "sidebar" | "mobile";
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return "刚刚";
  if (diffMin < 60) return `${diffMin} 分钟前`;
  if (diffHour < 24) return `${diffHour} 小时前`;
  if (diffDay < 7) return `${diffDay} 天前`;
  return date.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
}

function actionText(type: NotificationItem["type"], isArticle?: boolean, replyTo?: string | null) {
  if (type === "like") return isArticle ? "赞了你的文章" : "赞了你的动态";
  if (type === "comment") return isArticle ? "评论了你的文章" : "评论了你的动态";
  if (type === "reply") {
    if (replyTo) return `回复了 ${replyTo}`;
    return "回复了你的评论";
  }
  return "";
}

// 实况图角标：居中显示 Live 文字，无图标
function LiveDotBadge({ size = "sm" }: { size?: "sm" | "md" }) {
  const fontSize = size === "sm" ? "text-[9px]" : "text-[10px]";
  return (
    <span
      className={`pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/30 ${fontSize} font-semibold tracking-wide text-white`}
    >
      Live
    </span>
  );
}

function NotificationSkeleton({ variant }: { variant: "sidebar" | "mobile" }) {
  const count = variant === "sidebar" ? 3 : 5;
  const avatar = variant === "sidebar" ? "h-8 w-8" : "h-10 w-10";
  return (
    <div className="space-y-1">
      {[...Array(count)].map((_, i) => (
        <div key={i} className={`flex items-start gap-2 ${variant === "mobile" ? "px-2 py-2.5" : "px-1.5 py-2"}`}>
          <div className={`${avatar} shrink-0 animate-pulse rounded-[6px] bg-wechat-bubble dark:bg-white/5`} />
          <div className="flex-1 space-y-1.5 pt-1">
            <div className="h-3 w-1/3 animate-pulse rounded bg-wechat-bubble dark:bg-white/5" />
            <div className="h-2.5 w-1/2 animate-pulse rounded bg-wechat-bubble dark:bg-white/5" />
          </div>
          {variant === "mobile" && (
            <div className="h-10 w-10 shrink-0 animate-pulse rounded-md bg-wechat-bubble dark:bg-white/5" />
          )}
        </div>
      ))}
    </div>
  );
}

export default function AdminNotifications({ variant = "mobile" }: AdminNotificationsProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [open, setOpen] = useState(false);
  const [lastReadAt, setLastReadAt] = useState<number>(0);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  const defaultCover = useSiteSettings((s) => s.defaultCover);
  // useExitAnimation 必须在所有条件返回之前调用，否则违反 Rules of Hooks
  const notifExit = useExitAnimation(() => setOpen(false), 220);

  useEffect(() => {
    setMounted(true);
    setUser(getCurrentUser());
    const saved = localStorage.getItem("notifications_last_read");
    if (saved) setLastReadAt(Number(saved) || 0);
    try {
      const savedIds = localStorage.getItem("notifications_read_ids");
      if (savedIds) setReadIds(new Set(JSON.parse(savedIds) as string[]));
    } catch {
      // ignore
    }
  }, []);

  // 只有登录博主才能获取通知（分页，每页10条）
  useEffect(() => {
    if (!user?.isLoggedIn || !user.token) return;
    setLoading(true);
    setPage(1);

    fetch(`${API_URL}/notifications?page=1&limit=10`, {
      headers: { Authorization: `Bearer ${user.token}` },
    })
      .then((res) => (res.ok ? res.json() : { data: [], pagination: { hasMore: false } }))
      .then((data) => {
        setItems(Array.isArray(data.data) ? data.data : []);
        setHasMore(data.pagination?.hasMore || false);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [user]);

  const loadMore = async () => {
    if (loadingRef.current || !hasMore || !user?.token) return;
    loadingRef.current = true;
    setLoadingMore(true);
    const nextPage = page + 1;
    try {
      const res = await fetch(`${API_URL}/notifications?page=${nextPage}&limit=10`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      const data = await res.json();
      if (Array.isArray(data.data)) {
        setItems((prev) => [...prev, ...data.data]);
        setHasMore(data.pagination?.hasMore || false);
        setPage(nextPage);
      }
    } catch {
      // ignore
    } finally {
      setLoadingMore(false);
      loadingRef.current = false;
    }
  };

  // IntersectionObserver：滚动到底部自动加载更多
  useEffect(() => {
    if (!sentinelRef.current) return;
    const sentinel = sentinelRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: "50px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, page, loading, open]);

  // sidebar 模式：列表可见 2 秒后自动标记已读（把当前可见通知 ID 全部加入已读集合）
  useEffect(() => {
    if (variant === "sidebar" && mounted && items.length > 0) {
      const timer = setTimeout(() => {
        const now = Date.now();
        setLastReadAt(now);
        localStorage.setItem("notifications_last_read", String(now));
        setReadIds((prev) => {
          const next = new Set(prev);
          let changed = false;
          items.forEach((n) => {
            if (!next.has(n.id)) {
              next.add(n.id);
              changed = true;
            }
          });
          if (changed) {
            localStorage.setItem("notifications_read_ids", JSON.stringify([...next]));
          }
          return changed ? next : prev;
        });
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [variant, mounted, items.length, items]);

  // 未登录不显示
  if (!mounted || !user?.isLoggedIn) return null;

  const isItemUnread = (n: NotificationItem) =>
    new Date(n.createdAt).getTime() > lastReadAt && !readIds.has(n.id);

  const unreadCount = items.filter(isItemUnread).length;

  // 标记单条已读
  const markItemRead = (id: string) => {
    setReadIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      localStorage.setItem("notifications_read_ids", JSON.stringify([...next]));
      return next;
    });
  };

  // 一键全部已读
  const markAllRead = () => {
    setReadIds((prev) => {
      const next = new Set(prev);
      let changed = false;
      items.forEach((n) => {
        if (!next.has(n.id)) {
          next.add(n.id);
          changed = true;
        }
      });
      if (changed) {
        localStorage.setItem("notifications_read_ids", JSON.stringify([...next]));
      }
      return changed ? next : prev;
    });
    const now = Date.now();
    setLastReadAt(now);
    localStorage.setItem("notifications_last_read", String(now));
  };

  const handleItemClick = (postId: string, id: string, commentId?: string, shortId?: string, isArticle?: boolean) => {
    markItemRead(id);
    if (variant === "mobile") {
      setOpen(false);
    }
    // 文章通知跳转 /articles/{postId}，动态通知跳转 /moments/{shortId}
    const path = isArticle
      ? `/articles/${postId}`
      : `/moments/${shortId || postId}`;
    router.push(`${path}${commentId ? `#comment-${commentId}` : ""}`);
  };

  // ====== Sidebar 模式：直接渲染列表卡片（电脑版右侧） ======
  if (variant === "sidebar") {
    if (loading && items.length === 0) {
      return (
        <div className="rounded-2xl bg-wechat-white p-4 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_40px_-12px_rgba(0,0,0,0.4)]">
          <div className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-wechat-text">
            <Bell className="h-4 w-4 text-wechat-nickname" />
            消息通知
          </div>
          <NotificationSkeleton variant="sidebar" />
        </div>
      );
    }

    if (items.length === 0) return null;

    return (
      <div className="rounded-2xl bg-wechat-white p-4 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_40px_-12px_rgba(0,0,0,0.4)]">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-wechat-text">
            <Bell className="h-4 w-4 text-wechat-nickname" />
            消息通知
          </h3>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-medium leading-tight text-white transition-opacity hover:opacity-80"
              aria-label="全部已读"
            >
              全部已读 {unreadCount}
            </button>
          )}
        </div>
        <ul className="max-h-[280px] space-y-0.5 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {items.map((n) => {
            const isNew = isItemUnread(n);
            return (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => handleItemClick(n.postId, n.id, n.commentId, n.shortId, n.isArticle)}
                  className="flex w-full items-start gap-2 rounded-lg px-1.5 py-2 text-left transition-colors hover:bg-wechat-hover dark:hover:bg-white/5"
                >
                  <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-[6px] bg-wechat-bubble">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={actorAvatarUrl(n.actorEmail || "", n.actor, 64)}
                      alt={n.actor}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <span className="truncate text-[13px] font-medium text-wechat-nickname">
                        {n.actor}
                      </span>
                      {isNew && (
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                      )}
                    </div>
                    <p className="text-[11px] leading-tight text-wechat-time">
                      {actionText(n.type, n.isArticle, n.replyTo)}
                    </p>
                    {n.content && (
                      <p
                        className="mt-0.5 truncate text-[12px] text-wechat-text"
                        dangerouslySetInnerHTML={{ __html: renderTextWithEmoji(n.content) }}
                      />
                    )}
                    <p className="mt-0.5 text-[10px] text-wechat-time">
                      {formatTime(n.createdAt)}
                    </p>
                  </div>
                  {/* 动态缩略图 */}
                  {(() => {
                    const coverImg = n.postImage || (n.isArticle ? defaultCover : "");
                    if ((n.postType === "music" || n.postType === "image" || n.postType === "link" || n.postType === "video") && coverImg) {
                      return (
                        <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded bg-wechat-bubble">
                          <FadeImage
                            src={toAbsoluteUrl(coverImg)}
                            alt=""
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = "none";
                            }}
                          />
                          {n.postType === "music" && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                              <Music className="h-3 w-3 text-white" strokeWidth={2} />
                            </div>
                          )}
                          {n.postType === "link" && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                              <Link2 className="h-3 w-3 text-white" strokeWidth={2} />
                            </div>
                          )}
                          {n.postType === "video" && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                              <Play className="h-3 w-3 text-white" strokeWidth={2} fill="currentColor" />
                            </div>
                          )}
                          {n.postType === "image" && n.isLive && <LiveDotBadge size="sm" />}
                        </div>
                      );
                    }
                    // 文字动态：显示首字 + 浅灰色背景
                    if (n.postType === "text" && n.postPreview) {
                      const firstChar = n.postPreview.charAt(0);
                      return (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-gray-100 dark:bg-white/10">
                          <span className="text-[13px] font-medium text-gray-500 dark:text-gray-400">{firstChar}</span>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </button>
              </li>
            );
          })}
          {loadingMore && <li><NotificationSkeleton variant="sidebar" /></li>}
          <div ref={sentinelRef} className="h-1" />
        </ul>
      </div>
    );
  }

  // ====== Mobile 模式：按钮 + 弹窗（仅有未读消息时显示入口） ======
  if (!loading && (items.length === 0 || unreadCount === 0)) return null;

  const handleOpen = () => setOpen(true);
  const { closing, handleClose } = notifExit;

  return (
    <>
      {/* 微信风格紧凑入口 */}
      <div className="flex justify-center pt-3">
        <button
          type="button"
          onClick={handleOpen}
          className="flex h-[34px] items-center gap-2 rounded-[6px] bg-[#4c4c4c] px-4 text-white shadow-md transition-transform active:scale-95"
        >
          <MessageSquare className="h-[15px] w-[15px]" strokeWidth={1.8} />
          <span className="text-[14px] font-medium">
            {unreadCount > 0 ? `${unreadCount} 条新消息` : "消息"}
          </span>
        </button>
      </div>

      {/* 与我的互动消息列表 */}
      {(open || closing) && typeof document !== "undefined" && createPortal(
        <div
          data-modal="overlay"
          className={`fixed inset-0 z-[100] flex items-end justify-center bg-black/50 md:items-center md:p-4 ${closing ? "animate-overlay-out" : "animate-overlay-in"}`}
          onClick={handleClose}
        >
          <div
            className={`flex w-full max-w-[520px] flex-col rounded-t-2xl bg-wechat-white md:max-h-[80vh] md:rounded-2xl md:shadow-2xl dark:bg-[#232328] ${closing ? "animate-sheet-down md:animate-modal-out" : "animate-sheet-up md:animate-modal-in"}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-wechat-border px-4 py-3 dark:border-white/10">
              <h3 className="text-base font-semibold text-wechat-text">与我的互动消息</h3>
              <div className="flex items-center gap-3">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllRead}
                    className="text-[13px] font-medium text-wechat-nickname transition-colors hover:text-wechat-text"
                  >
                    全部已读
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleClose}
                  className="text-wechat-time transition-colors hover:text-wechat-text"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-2 md:max-h-[60vh]">
              {loading ? (
                <NotificationSkeleton variant="mobile" />
              ) : items.length === 0 ? (
                <div className="py-10 text-center text-sm text-wechat-time">暂无互动消息</div>
              ) : (
                <ul>
                  {items.map((n) => {
                    const isNew = isItemUnread(n);
                    return (
                      <li key={n.id}>
                        <button
                          type="button"
                          onClick={() => handleItemClick(n.postId, n.id, n.commentId, n.shortId, n.isArticle)}
                          className="flex w-full items-start gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-wechat-hover"
                        >
                          {/* 头像 */}
                          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-[8px] bg-wechat-bubble">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={actorAvatarUrl(n.actorEmail || "", n.actor, 80)}
                              alt={n.actor}
                              className="h-full w-full object-cover"
                            />
                          </div>

                          {/* 内容 */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[15px] font-medium text-wechat-nickname">
                                {n.actor}
                              </span>
                              <span className="text-[13px] text-wechat-time">
                                {actionText(n.type, n.isArticle, n.replyTo)}
                              </span>
                            </div>

                            {n.content && (
                              <p
                                className="mt-0.5 truncate text-[13px] text-wechat-text"
                                dangerouslySetInnerHTML={{ __html: renderTextWithEmoji(n.content) }}
                              />
                            )}

                            <p className="mt-0.5 text-[11px] text-wechat-time">
                              {formatTime(n.createdAt)}
                            </p>
                          </div>

                          {/* 动态预览：音乐显示封面，图片显示缩略图，链接显示卡片图，视频显示封面+播放图标，文章显示封面，文字显示首字 */}
                          <div className="flex max-w-[90px] shrink-0 items-center justify-end">
                            {(() => {
                              const coverImg = n.postImage || (n.isArticle ? defaultCover : "");
                              if (n.postType === "music" && coverImg) {
                                return (
                                  <div className="relative h-10 w-10 overflow-hidden rounded-md bg-wechat-bubble">
                                    <FadeImage
                                      src={toAbsoluteUrl(coverImg)}
                                      alt=""
                                      className="h-full w-full object-cover"
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = "none";
                                      }}
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                                      <Music className="h-4 w-4 text-white" strokeWidth={2} />
                                    </div>
                                  </div>
                                );
                              }
                              if (n.postType === "image" && coverImg) {
                                return (
                                  <div className="relative h-10 w-10 overflow-hidden rounded-md bg-wechat-bubble">
                                    <FadeImage
                                      src={toAbsoluteUrl(coverImg)}
                                      alt=""
                                      className="h-full w-full object-cover"
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = "none";
                                      }}
                                    />
                                    {n.isLive && <LiveDotBadge size="md" />}
                                  </div>
                                );
                              }
                              if (n.postType === "link" && coverImg) {
                                return (
                                  <div className="relative h-10 w-10 overflow-hidden rounded-md bg-wechat-bubble">
                                    <FadeImage
                                      src={toAbsoluteUrl(coverImg)}
                                      alt=""
                                      className="h-full w-full object-cover"
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = "none";
                                      }}
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                                      <Link2 className="h-4 w-4 text-white" strokeWidth={2} />
                                    </div>
                                  </div>
                                );
                              }
                              if (n.postType === "video" && coverImg) {
                                return (
                                  <div className="relative h-10 w-10 overflow-hidden rounded-md bg-wechat-bubble">
                                    <FadeImage
                                      src={toAbsoluteUrl(coverImg)}
                                      alt=""
                                      className="h-full w-full object-cover"
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = "none";
                                      }}
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                                      <Play className="h-4 w-4 text-white" strokeWidth={2} fill="currentColor" />
                                    </div>
                                  </div>
                                );
                              }
                              // 文字动态：显示首字 + 浅灰色背景
                              if (n.postType === "text" && n.postPreview) {
                                const firstChar = n.postPreview.charAt(0);
                                return (
                                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-gray-100 dark:bg-white/10">
                                    <span className="text-[16px] font-medium text-gray-500 dark:text-gray-400">{firstChar}</span>
                                  </div>
                                );
                              }
                              return null;
                            })()}
                          </div>

                          {/* 未读红点 */}
                          {isNew && (
                            <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-red-500" />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              {loadingMore && <NotificationSkeleton variant="mobile" />}
              <div ref={sentinelRef} className="h-1" />
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
