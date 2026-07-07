"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { PenLine, Trash2, Loader2, FileText, ExternalLink, Pin, PinOff } from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";
import { toAbsoluteUrl } from "@/lib/upload";

interface ArticleListItem {
  id: string;
  shortId: string;
  type: string;
  title: string;
  excerpt: string;
  cover: string;
  category: string;
  content: string;
  pinned: boolean;
  isAd: boolean;
  status: "published" | "draft";
  createdAt: string;
  author: string;
}

export default function AdminArticlesPage() {
  const [articles, setArticles] = useState<ArticleListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [pinning, setPinning] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchArticles = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await apiFetch(`/admin/posts?type=article&page=${p}&limit=20`);
      if (!res.ok) throw new Error("加载失败");
      const data = await res.json();
      setArticles(data.data || []);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchArticles(1);
  }, [fetchArticles]);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm("确定删除这篇文章吗？")) return;
      setDeleting(id);
      try {
        const res = await apiFetch(`/posts/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("删除失败");
        setArticles((prev) => prev.filter((a) => a.id !== id));
      } catch (err) {
        alert(err instanceof Error ? err.message : "删除失败");
      } finally {
        setDeleting(null);
      }
    },
    []
  );

  const handlePin = useCallback(
    async (id: string, currentPinned: boolean) => {
      setPinning(id);
      try {
        const res = await apiFetch(`/posts/${id}/pin`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pinned: !currentPinned }),
        });
        if (!res.ok) throw new Error("操作失败");
        const data = await res.json();
        setArticles((prev) =>
          prev.map((a) => (a.id === id ? { ...a, pinned: !!data.pinned } : a))
        );
      } catch (err) {
        alert(err instanceof Error ? err.message : "操作失败");
      } finally {
        setPinning(null);
      }
    },
    []
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-adm-text">文章管理</h1>
          <p className="mt-0.5 text-sm text-adm-text-secondary">
            管理已发布与草稿文章
          </p>
        </div>
        <Link
          href="/admin/articles/new"
          className="flex items-center gap-1.5 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
        >
          <PenLine className="h-4 w-4" />
          写文章
        </Link>
      </div>

      {/* Article list */}
      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-adm-text-tertiary" />
        </div>
      ) : articles.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-adm-border py-20">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-adm-input">
            <FileText className="h-7 w-7 text-adm-text-tertiary" />
          </div>
          <p className="mt-3 text-sm text-adm-text-secondary">还没有文章</p>
          <Link
            href="/admin/articles/new"
            className="mt-4 text-sm font-medium text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
          >
            写第一篇文章 →
          </Link>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {articles.map((article) => (
              <div
                key={article.id}
                className="flex gap-4 rounded-xl border border-adm-border bg-adm-card p-4 transition-colors hover:bg-adm-card-hover"
              >
                {/* Cover */}
                <div className="h-20 w-32 shrink-0 overflow-hidden rounded-lg bg-adm-input">
                  {article.cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={toAbsoluteUrl(article.cover)}
                      alt={article.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <FileText className="h-6 w-6 text-adm-text-tertiary" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate font-medium text-adm-text">
                          {article.title || "无标题"}
                        </h3>
                        {article.status === "draft" && (
                          <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
                            草稿
                          </span>
                        )}
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm text-adm-text-secondary">
                        {article.excerpt || article.content || "无摘要"}
                      </p>
                      <div className="mt-2 flex items-center gap-2 text-xs text-adm-text-tertiary">
                        {article.category && (
                          <span className="rounded bg-adm-input px-1.5 py-0.5">
                            {article.category}
                          </span>
                        )}
                        <span>
                          {new Date(article.createdAt).toLocaleDateString("zh-CN")}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex shrink-0 items-center gap-1">
                      {article.status === "published" && (
                        <Link
                          href={`/articles/${article.shortId || article.id}`}
                          target="_blank"
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-adm-text-secondary transition-colors hover:bg-adm-input hover:text-adm-text"
                          title="查看文章"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      )}
                      {article.status === "published" && (
                        <button
                          type="button"
                          onClick={() => handlePin(article.id, !!article.pinned)}
                          disabled={pinning === article.id}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-adm-text-secondary transition-colors hover:bg-adm-input hover:text-adm-text disabled:opacity-50"
                          title={article.pinned ? "取消置顶" : "置顶"}
                        >
                          {pinning === article.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : article.pinned ? (
                            <PinOff className="h-4 w-4" />
                          ) : (
                            <Pin className="h-4 w-4" />
                          )}
                        </button>
                      )}
                      <Link
                        href={`/admin/articles/${article.id}`}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-adm-text-secondary transition-colors hover:bg-adm-input hover:text-adm-text"
                        title="编辑"
                      >
                        <PenLine className="h-4 w-4" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDelete(article.id)}
                        disabled={deleting === article.id}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-adm-text-secondary transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-50 dark:hover:bg-red-500/10"
                        title="删除"
                      >
                        {deleting === article.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const p = Math.max(1, page - 1);
                  setPage(p);
                  fetchArticles(p);
                }}
                disabled={page <= 1}
                className="rounded-lg border border-adm-border px-3 py-1.5 text-sm text-adm-text-secondary transition-colors hover:bg-adm-card-hover disabled:opacity-50"
              >
                上一页
              </button>
              <span className="px-3 text-sm text-adm-text-secondary">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => {
                  const p = Math.min(totalPages, page + 1);
                  setPage(p);
                  fetchArticles(p);
                }}
                disabled={page >= totalPages}
                className="rounded-lg border border-adm-border px-3 py-1.5 text-sm text-adm-text-secondary transition-colors hover:bg-adm-card-hover disabled:opacity-50"
              >
                下一页
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
