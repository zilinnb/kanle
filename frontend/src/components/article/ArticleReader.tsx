"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Heart, Share2, MessageCircle } from "lucide-react";
import { Post, formatArticleTime } from "@/lib/mock-data";
import { resolveAvatar } from "@/lib/avatar";
import { getCurrentUser, authFetchHeaders } from "@/lib/auth";
import { useEditPost } from "@/lib/edit-post-store";
import { useSiteSettings } from "@/lib/site-settings-store";
import ArticleCommentSection from "@/components/article/ArticleCommentSection";
import ArticleEmbedContent from "@/components/article/ArticleEmbedContent";
import MusicEmbedCard from "@/components/article/MusicEmbedCard";
import VideoPlayer from "@/components/VideoPlayer";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

interface ArticleReaderProps {
  post: Post;
}

const ARTICLE_TYPE_LABEL: Record<string, string> = {
  original: "原创",
  repost: "转载",
  ai: "AI生成",
};

export default function ArticleReader({ post }: ArticleReaderProps) {
  const [likes, setLikes] = useState<Array<{ name: string; email?: string }>>(post.likes || []);
  const [liked, setLiked] = useState(false);
  const [liking, setLiking] = useState(false);
  const [comments, setComments] = useState(post.comments || []);
  const [viewCount, setViewCount] = useState(post.viewCount || 0);
  const [canEdit, setCanEdit] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pinned, setPinned] = useState(!!post.pinned);
  const [focusSignal, setFocusSignal] = useState(0);
  const openEdit = useEditPost((s) => s.open);

  useEffect(() => {
    const user = getCurrentUser();
    if (user?.isLoggedIn) {
      setIsAdmin(true);
      const sameEmail = !!(post.author.email && user.email && user.email === post.author.email);
      const sameNickname = post.author.nickname === user.nickname;
      setCanEdit(sameEmail || sameNickname);
    }
  }, [post.author.email, post.author.nickname]);

  useEffect(() => {
    setLiked(!!post.meLiked);
  }, [post.id, post.meLiked]);

  useEffect(() => {
    setComments(post.comments || []);
  }, [post.comments]);

  useEffect(() => {
    const email = (typeof window !== "undefined" && localStorage.getItem("visitor_email")) || "";
    // 客户端 fetch 带 view=1 递增阅读量（SSR 不带此参数不递增）
    const params = new URLSearchParams();
    if (email) params.set("email", email);
    params.set("view", "1");
    const url = `${API_URL}/posts/${post.id}?${params.toString()}`;
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
        if (typeof data.viewCount === "number") setViewCount(data.viewCount);
      })
      .catch(() => {});
  }, [post.id]);

  useEffect(() => {
    window.scrollTo(0, 0);
    const scrollRoot = document.getElementById("scroll-root");
    if (scrollRoot) scrollRoot.scrollTop = 0;
  }, [post.id]);

  const handleLike = async () => {
    if (liking) return;
    setLiking(true);
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
        credentials: "include",
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
      if (Array.isArray(data.likes)) setLikes(data.likes);
    } catch {
      setLiked(prevLiked);
    } finally {
      setLiking(false);
    }
  };

  const handleShare = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: post.title || "文章", url });
      } catch {}
    } else {
      try {
        await navigator.clipboard.writeText(url);
        alert("链接已复制到剪贴板");
      } catch {}
    }
  };

  const handleCommentClick = () => {
    setFocusSignal((n) => n + 1);
  };

  const handleCommentsChange = (next: typeof comments) => {
    setComments(next);
  };

  const handleEdit = () => {
    openEdit(post);
  };

  const authorName = post.author.nickname || "博主";
  const siteName = useSiteSettings((s) => s.siteName);
  const articleTypeLabel = ARTICLE_TYPE_LABEL[post.articleType || "original"];
  const authorAvatar = resolveAvatar(post.author.avatar, post.author.email || "", 80);

  return (
    <article className="px-4 pb-28 pt-4 md:px-6 md:pb-20">
      {/* 分类标签 */}
      {post.category && (
        <div className="mb-3">
          <span className="inline-block rounded bg-wechat-bubble px-2 py-0.5 text-xs text-wechat-nickname">
            {post.category}
          </span>
        </div>
      )}

      {/* 标题（细字体） */}
      <h1 className="text-[24px] font-medium leading-tight text-wechat-text dark:text-white md:text-[28px]">
        {post.title || "无标题"}
      </h1>

      {/* 作者信息行：类型徽章 + 作者 网站名 时间 省份 */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[12px] text-wechat-time md:text-[13px]">
        <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-white/10 dark:text-gray-400">
          {articleTypeLabel}
        </span>
        <span>
          {authorName}{" "}
          <Link href="/" className="text-wechat-link hover:underline">
            {siteName}
          </Link>{" "}
          {formatArticleTime(post.createdAt)}
          {post.region ? ` ${post.region}` : ""}
        </span>
      </div>

      {/* 正文内容（含内联音乐/视频嵌入） */}
      <ArticleEmbedContent
        content={post.content}
        postId={post.id}
        className="article-content rich-content mt-5 text-[16px] leading-[1.8] text-wechat-text dark:text-gray-200 md:text-[18px] md:leading-[1.9]"
      />

      {/* 旧数据兼容：post.music / post.video 独立字段（新文章已内联到正文） */}
      {post.music && <MusicEmbedCard music={post.music} postId={post.id} />}
      {post.video && <VideoPlayer video={post.video} postId={post.id} />}

      {/* 阅读量 + 点赞数 — 左右分布 */}
      <div className="mt-4 flex items-center justify-between text-[12px] text-wechat-time md:text-[13px]">
        <span>阅读 {viewCount}</span>
        <span>点赞 {likes.length}</span>
      </div>

      {/* 微信公众号风格留言区 */}
      <ArticleCommentSection
        post={post}
        comments={comments}
        onCommentsChange={handleCommentsChange}
        focusSignal={focusSignal}
      />

      {/* 底部固定栏 — 类似微信公众号，贴底 fixed（桌面端贴 scroll-root 卡片底部） */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-wechat-white pb-[env(safe-area-inset-bottom)] md:left-[calc(50%-300px)] md:right-auto md:w-[600px] md:rounded-b-2xl md:pb-0">
        <div className="flex items-center justify-between px-4 py-2 md:py-3">
          {/* 左：头像 + 昵称（移动端也显示） */}
          <div className="flex min-w-0 items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={authorAvatar}
              alt={authorName}
              className="h-8 w-8 shrink-0 rounded-full object-cover md:h-9 md:w-9"
            />
            <span className="truncate text-[14px] text-wechat-text md:text-[15px]">{authorName}</span>
          </div>
          {/* 右：赞 | 分享 | 写留言 — 移动端垂直布局（图标上文字下），桌面端横向 */}
          <div className="flex shrink-0 items-center gap-4 md:gap-2.5">
            {!post.likesDisabled && (
              <button
                type="button"
                onClick={handleLike}
                disabled={liking}
                className="flex flex-col items-center gap-0.5 text-wechat-text-secondary transition-colors hover:text-wechat-text active:opacity-60 md:flex-row md:gap-1.5"
              >
                <Heart
                  className={`h-[20px] w-[20px] md:h-[17px] md:w-[17px] ${liked ? "fill-current text-red-500" : ""}`}
                />
                <span className="text-[10px] md:text-[13px]">赞</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleShare}
              className="flex flex-col items-center gap-0.5 text-wechat-text-secondary transition-colors hover:text-wechat-text active:opacity-60 md:flex-row md:gap-1.5"
            >
              <Share2 className="h-[20px] w-[20px] md:h-[17px] md:w-[17px]" />
              <span className="text-[10px] md:text-[13px]">分享</span>
            </button>
            {!post.commentsDisabled && (
              <button
                type="button"
                data-no-collapse
                onClick={handleCommentClick}
                className="flex flex-col items-center gap-0.5 text-wechat-text-secondary transition-colors hover:text-wechat-text active:opacity-60 md:flex-row md:gap-1.5"
              >
                <MessageCircle className="h-[20px] w-[20px] md:h-[17px] md:w-[17px]" />
                <span className="text-[10px] md:text-[13px]">写留言</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
