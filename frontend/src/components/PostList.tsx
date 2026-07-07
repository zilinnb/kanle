"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import PostCard from "@/components/PostCard";
import { PostCardSkeleton } from "@/components/Skeleton";
import { useSiteSettings } from "@/lib/site-settings-store";
import { authFetchHeaders } from "@/lib/auth";

const REVALIDATE_SECRET = process.env.NEXT_PUBLIC_REVALIDATE_SECRET || "kanle-revalidate";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
const PAGE_SIZE = 10;

interface PostListProps {
  initialPosts: any[];
  initialHasMore: boolean;
  initialPage: number;
}

export default function PostList({ initialPosts, initialHasMore, initialPage }: PostListProps) {
  const [posts, setPosts] = useState(initialPosts);
  const [page, setPage] = useState(initialPage);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [ads, setAds] = useState<any[]>([]);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  const fetchSettings = useSiteSettings((s) => s.fetchSettings);
  const router = useRouter();

  // 获取所有广告数据，前端每次访问随机选择一条（类似微信朋友圈）
  const fetchAds = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/ads`, { cache: "no-store", credentials: "include", headers: authFetchHeaders() });
      if (!res.ok) return;
      const json = await res.json();
      setAds(Array.isArray(json.data) ? json.data : []);
    } catch {
      // 静默失败
    }
  }, []);

  // 初始化时获取站点配置（折叠字数等）+ 广告
  useEffect(() => {
    fetchSettings();
    fetchAds();
  }, [fetchSettings, fetchAds]);

  // 客户端首次加载：用真实 IP/email/cookie/token 获取 meLiked 状态，覆盖 SSR 数据
  // SSR 拿不到 localStorage token 和客户端 cookie，初始 HTML 中 meLiked 全是 false，
  // 客户端 hydrate 后重新拉取。关键：登录用户必须带 Authorization header，
  // 否则后端走 cookie visitorId 维度，但该维度点赞已被 migrateLikesToUserId 升级，导致 meLiked 错误。
  useEffect(() => {
    const email = (typeof window !== "undefined" && localStorage.getItem("visitor_email")) || "";
    const url = `${API_URL}/posts?page=1&limit=${PAGE_SIZE}${email ? `&email=${encodeURIComponent(email)}` : ""}`;
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
      })
      .catch(() => {});
  }, []);

  // 监听动态发布/编辑事件：
  // 1) 客户端立即拉取第一页数据，绕过 ISR 缓存，瞬间显示最新内容
  // 2) 触发服务端按需 revalidate（重新生成首页 HTML），让刷新页面也能立即看到最新内容
  // 3) 调用 router.refresh() 重新执行 Server Components，刷新整页数据
  useEffect(() => {
    const triggerRevalidate = async () => {
      try {
        await fetch("/api/revalidate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ secret: REVALIDATE_SECRET }),
        });
      } catch {
        // 静默失败
      }
    };

    const refreshFirstPage = async () => {
      try {
        const email = (typeof window !== "undefined" && localStorage.getItem("visitor_email")) || "";
        const emailQ = email ? `&email=${encodeURIComponent(email)}` : "";
        const res = await fetch(`${API_URL}/posts?page=1&limit=${PAGE_SIZE}${emailQ}`, {
          cache: "no-store",
          credentials: "include",
          headers: authFetchHeaders(),
        });
        if (res.ok) {
          const json = await res.json();
          setPosts(json.data || []);
          setPage(1);
          setHasMore(json.pagination?.hasMore ?? false);
          setError(false);
        }
      } catch {
        // 静默失败，不影响现有列表
      }
    };

    const handler = async () => {
      // 客户端立即拉取最新数据
      await refreshFirstPage();
      // 同时触发服务端 ISR 重生成 + router.refresh，确保刷新页面立即看到最新内容
      triggerRevalidate();
      router.refresh();
    };

    // 页面重新可见时（从其他标签页切回、从后台切回）刷新数据，
    // 确保在文章详情页评论/点赞后返回首页时立即同步
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshFirstPage();
      }
    };

    window.addEventListener("post-published", handler);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("post-published", handler);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [fetchAds, router]);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore) return;
    loadingRef.current = true;
    setLoadingMore(true);
    setError(false);
    try {
      const email = (typeof window !== "undefined" && localStorage.getItem("visitor_email")) || "";
      const emailQ = email ? `&email=${encodeURIComponent(email)}` : "";
      const res = await fetch(`${API_URL}/posts?page=${page + 1}&limit=${PAGE_SIZE}${emailQ}`, {
        cache: "no-store",
        credentials: "include",
        headers: authFetchHeaders(),
      });
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
  }, [page, hasMore]);

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

  if (posts.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-wechat-time">暂无动态</div>
    );
  }

  // 构建展示列表：仅在第 5 个位置后插入一条随机广告（类似微信朋友圈）
  // 后续不再插入广告，避免广告刷屏
  // 使用 useMemo 稳定随机选择，避免每次重渲染都换广告
  const displayList = useMemo(() => {
    const AD_POSITION = 5;
    const list: any[] = [];
    posts.forEach((post, idx) => {
      list.push(post);
      // 仅在第 AD_POSITION 条后插入一条广告，且不在最后一条后插入
      if (idx + 1 === AD_POSITION && ads.length > 0 && idx < posts.length - 1) {
        const randomAd = ads[Math.floor(Math.random() * ads.length)];
        list.push({ ...randomAd, _isAd: true });
      }
    });
    return list;
  }, [posts, ads]);

  return (
    <>
      <section className="divide-hairline">
        {displayList.map((post, index) => (
          <PostCard key={post.id} post={post} index={index} />
        ))}
        {loadingMore &&
          Array.from({ length: 2 }).map((_, i) => (
            <PostCardSkeleton key={`sk-${i}`} />
          ))}
      </section>

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
    </>
  );
}
