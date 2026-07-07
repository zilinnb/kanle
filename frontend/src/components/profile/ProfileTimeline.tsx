"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PostCardSkeleton } from "@/components/Skeleton";
import { useSiteSettings } from "@/lib/site-settings-store";
import { groupByTime } from "@/lib/time-group";
import { authFetchHeaders } from "@/lib/auth";
import type { Post } from "@/lib/mock-data";
import ProfilePinnedStrip from "./ProfilePinnedStrip";
import TimelinePostCard from "./TimelinePostCard";

const REVALIDATE_SECRET = process.env.NEXT_PUBLIC_REVALIDATE_SECRET || "kanle-revalidate";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
const PAGE_SIZE = 10;

/**
 * 格式化完整定位信息：城市 · 地点名
 * 两者都有用 "·" 连接，只有其一则单独显示。
 */
function formatLocation(loc: Post["location"]): string {
  if (!loc || typeof loc !== "object") return "";
  const city = (loc.city || "").trim();
  const name = (loc.name || "").trim();
  if (city && name) return `${city} · ${name}`;
  return city || name;
}

interface ProfileTimelineProps {
  initialPosts: Post[];
  initialHasMore: boolean;
  initialPage: number;
  ownerId: string;
}

export default function ProfileTimeline({
  initialPosts,
  initialHasMore,
  initialPage,
  ownerId,
}: ProfileTimelineProps) {
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [page, setPage] = useState(initialPage);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [ads, setAds] = useState<Post[]>([]);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  const fetchSettings = useSiteSettings((s) => s.fetchSettings);
  const adOnArchives = useSiteSettings((s) => s.adOnArchives);
  const settingsLoaded = useSiteSettings((s) => s.loaded);
  const router = useRouter();

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // 客户端首次加载：用真实 IP/email/cookie/token 获取 meLiked 状态，覆盖 SSR 数据
  // 关键：登录用户必须带 Authorization header，否则后端走 cookie visitorId 维度
  // 但该维度点赞已被 migrateLikesToUserId 升级，导致 meLiked 错误
  useEffect(() => {
    const email = (typeof window !== "undefined" && localStorage.getItem("visitor_email")) || "";
    const url = `${API_URL}/posts?userId=${ownerId}&page=1&limit=${PAGE_SIZE}${email ? `&email=${encodeURIComponent(email)}` : ""}`;
    fetch(url, {
      cache: "no-store",
      credentials: "include",
      headers: authFetchHeaders(),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!json?.data) return;
        setPosts(json.data);
        setPage(1);
        setHasMore(json.pagination?.hasMore ?? false);
        setError(false);
      })
      .catch(() => {});
  }, [ownerId]);

  // 根据设置决定是否获取广告（拉取全部，前端随机选一条，类似微信朋友圈）
  useEffect(() => {
    if (!settingsLoaded || !adOnArchives) {
      setAds([]);
      return;
    }
    let cancelled = false;
    fetch(`${API_URL}/ads`, { cache: "no-store", credentials: "include", headers: authFetchHeaders() })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (cancelled) return;
        setAds(Array.isArray(json?.data) ? json.data : []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [settingsLoaded, adOnArchives]);

  useEffect(() => {
    const triggerRevalidate = async () => {
      try {
        await fetch("/api/revalidate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ secret: REVALIDATE_SECRET }),
        });
      } catch {
        // ignore
      }
    };

    const handler = async () => {
      try {
        const email = (typeof window !== "undefined" && localStorage.getItem("visitor_email")) || "";
        const emailQ = email ? `&email=${encodeURIComponent(email)}` : "";
        const res = await fetch(
          `${API_URL}/posts?userId=${ownerId}&page=1&limit=${PAGE_SIZE}${emailQ}`,
          {
            cache: "no-store",
            credentials: "include",
            headers: authFetchHeaders(),
          }
        );
        if (res.ok) {
          const json = await res.json();
          setPosts(json.data || []);
          setPage(1);
          setHasMore(json.pagination?.hasMore ?? false);
          setError(false);
        }
      } catch {
        // ignore
      }
      triggerRevalidate();
      router.refresh();
    };

    window.addEventListener("post-published", handler);
    return () => window.removeEventListener("post-published", handler);
  }, [ownerId, router]);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore) return;
    loadingRef.current = true;
    setLoadingMore(true);
    setError(false);
    try {
      const email = (typeof window !== "undefined" && localStorage.getItem("visitor_email")) || "";
      const emailQ = email ? `&email=${encodeURIComponent(email)}` : "";
      const res = await fetch(
        `${API_URL}/posts?userId=${ownerId}&page=${page + 1}&limit=${PAGE_SIZE}${emailQ}`,
        {
          cache: "no-store",
          credentials: "include",
          headers: authFetchHeaders(),
        }
      );
      if (!res.ok) throw new Error("fetch failed");
      const json = await res.json();
      setPosts((prev) => [...prev, ...(json.data || [])]);
      setPage((p) => p + 1);
      setHasMore(json.pagination?.hasMore ?? false);
    } catch {
      setError(true);
    } finally {
      setLoadingMore(false);
      loadingRef.current = false;
    }
  }, [page, hasMore, ownerId]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const isDesktop = window.matchMedia("(min-width: 768px)").matches;
    const root = isDesktop ? document.getElementById("scroll-root") : null;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { root, rootMargin: "300px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  const { pinnedPosts, groups } = useMemo(() => {
    const pinned = posts.filter((p) => p.pinned);
    const baseTimelinePosts = posts.filter((p) => !p.pinned);
    // 广告插入到第 5 个位置，从广告池随机选一条，使用前一条动态的时间以便归入同一时间分组
    const AD_POSITION = 4;
    const ad = ads.length > 0 ? ads[Math.floor(Math.random() * ads.length)] : null;
    const timelinePosts =
      ad && baseTimelinePosts.length >= AD_POSITION
        ? (() => {
            const refPost = baseTimelinePosts[AD_POSITION - 1];
            const adWithTime: Post = { ...ad, createdAt: refPost.createdAt };
            return [
              ...baseTimelinePosts.slice(0, AD_POSITION),
              adWithTime,
              ...baseTimelinePosts.slice(AD_POSITION),
            ];
          })()
        : baseTimelinePosts;
    return { pinnedPosts: pinned, groups: groupByTime(timelinePosts) };
  }, [posts, ads]);

  if (posts.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-wechat-time">暂无动态</div>
    );
  }

  return (
    <section>
      <ProfilePinnedStrip posts={pinnedPosts} />

      <div>
        {groups.map((group) => (
          <div key={group.key} className="mb-4 last:mb-0">
            {group.items.map((post, idx) => {
              const loc = formatLocation(post.location);
              return (
                <div key={post.id} className="flex">
                  {/* Left column: date (first item) + location */}
                  <div className="w-[68px] shrink-0 pl-4 pt-2 sm:pl-5 md:pl-6">
                    {idx === 0 &&
                      (group.type === "today" || group.type === "yesterday" ? (
                        <span className="text-[15px] font-semibold leading-tight text-wechat-text">
                          {group.label}
                        </span>
                      ) : (
                        <div className="flex items-baseline gap-0.5 leading-none">
                          <span className="text-[19px] font-semibold text-wechat-text">
                            {group.dayLabel}
                          </span>
                          <span className="text-[10px] text-wechat-time">
                            {group.monthLabel}
                          </span>
                        </div>
                      ))}
                    {loc && (
                      <p
                        className={`break-words text-[9px] leading-[1.25] text-wechat-time ${idx === 0 ? "mt-1.5" : "pt-2"}`}
                      >
                        {loc}
                      </p>
                    )}
                  </div>

                  {/* Right: post card */}
                  <div className="min-w-0 flex-1">
                    <TimelinePostCard post={post} />
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        {loadingMore &&
          Array.from({ length: 2 }).map((_, i) => (
            <div key={`sk-${i}`} className="flex">
              <div className="w-[68px] shrink-0 pl-4 sm:pl-5 md:pl-6" />
              <div className="min-w-0 flex-1">
                <PostCardSkeleton />
              </div>
            </div>
          ))}
      </div>

      {/* Sentinel for IntersectionObserver */}
      <div ref={sentinelRef} className="h-1" />

      {error && (
        <div className="py-6 text-center">
          <button
            type="button"
            onClick={loadMore}
            className="text-sm text-wechat-link transition-opacity hover:opacity-70"
          >
            加载失败，点击重试
          </button>
        </div>
      )}

      {!hasMore && !loadingMore && posts.length > 0 && (
        <footer className="py-8 text-center text-xs text-wechat-time">
          已经到底了
        </footer>
      )}
    </section>
  );
}
