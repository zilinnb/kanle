"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, FileText, Search } from "lucide-react";
import AdminModal from "@/components/admin/AdminModal";
import { apiFetch } from "@/lib/api-fetch";
import { toAbsoluteUrl } from "@/lib/upload";
import type { ArticleEmbedData } from "./embed-utils";

interface ArticlePickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (article: ArticleEmbedData) => void;
}

interface ArticleListItem {
  id: string;
  shortId?: string;
  title?: string;
  cover?: string;
  excerpt?: string;
}

export default function ArticlePicker({
  open,
  onClose,
  onSelect,
}: ArticlePickerProps) {
  const [articles, setArticles] = useState<ArticleListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch("/posts?type=article&limit=50");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "加载文章列表失败");
      }
      const data = await res.json();
      setArticles(data.posts || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setSearch("");
      fetchArticles();
    }
  }, [open, fetchArticles]);

  const filtered = search.trim()
    ? articles.filter((a) =>
        (a.title || "").toLowerCase().includes(search.toLowerCase())
      )
    : articles;

  const handleSelect = (article: ArticleListItem) => {
    onSelect({
      id: article.id,
      shortId: article.shortId,
      title: article.title || "无标题",
      cover: article.cover || "",
      excerpt: article.excerpt || "",
    });
  };

  return (
    <AdminModal
      open={open}
      onClose={onClose}
      title="插入文章卡片"
      width="md"
    >
      {/* 搜索框 */}
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-adm-text-tertiary" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索文章标题..."
          className="w-full rounded-lg border border-adm-border bg-adm-input py-2 pr-3 pl-9 text-sm text-adm-text placeholder:text-adm-text-tertiary focus:border-gray-400 focus:outline-none dark:focus:border-gray-500"
        />
      </div>

      {/* 加载中 */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-adm-text-tertiary" />
        </div>
      )}

      {/* 错误 */}
      {!loading && error && (
        <div className="py-8 text-center text-sm text-red-500">{error}</div>
      )}

      {/* 空列表 */}
      {!loading && !error && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-adm-text-tertiary">
          <FileText className="mb-2 h-8 w-8 opacity-40" />
          <p className="text-xs">
            {search ? "未找到匹配的文章" : "暂无文章"}
          </p>
        </div>
      )}

      {/* 文章列表 */}
      {!loading && !error && filtered.length > 0 && (
        <div className="max-h-[50vh] space-y-2 overflow-y-auto">
          {filtered.map((article) => (
            <button
              key={article.id}
              type="button"
              onClick={() => handleSelect(article)}
              className="flex w-full items-center gap-3 rounded-lg border border-adm-border bg-adm-card p-2.5 text-left transition-colors hover:bg-adm-card-hover"
            >
              {article.cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={toAbsoluteUrl(article.cover)}
                  alt=""
                  className="h-12 w-16 shrink-0 rounded object-cover"
                />
              ) : (
                <div className="flex h-12 w-16 shrink-0 items-center justify-center rounded bg-adm-input">
                  <FileText className="h-5 w-5 text-adm-text-tertiary" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-adm-text">
                  {article.title || "无标题"}
                </p>
                {article.excerpt && (
                  <p className="mt-0.5 truncate text-xs text-adm-text-tertiary">
                    {article.excerpt}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </AdminModal>
  );
}
