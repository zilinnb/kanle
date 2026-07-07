"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Pin, PinOff, Heart, MessageSquare } from "lucide-react";
import { apiFetch, getToken } from "@/lib/api-fetch";
import { Post } from "@/lib/mock-data";
import PostCard from "@/components/PostCard";
import { PostCardSkeleton } from "@/components/Skeleton";
import { useSiteSettings } from "@/lib/site-settings-store";

export default function AdminPosts() {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pinningId, setPinningId] = useState<string | null>(null);
  const [permId, setPermId] = useState<string | null>(null);

  const token = getToken();
  const fetchSettings = useSiteSettings((s) => s.fetchSettings);

  const fetchPosts = () => {
    if (!token) return;
    setLoading(true);
    apiFetch("/posts?limit=100")
      .then((res) => res.json())
      .then((data) => {
        setPosts(data.data || []);
      })
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!token) {
      router.replace("/");
      return;
    }
    fetchPosts();
    fetchSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, token]);

  const handleDelete = async (id: string) => {
    if (!token || !confirm("确定删除这条动态吗？")) return;
    setDeletingId(id);
    try {
      const res = await apiFetch(`/posts/${id}`, { method: "DELETE" });
      if (res.ok) {
        setPosts((prev) => prev.filter((p) => p.id !== id));
      } else {
        alert("删除失败");
      }
    } catch {
      alert("网络错误");
    } finally {
      setDeletingId(null);
    }
  };

  const handlePin = async (id: string, currentPinned: boolean) => {
    if (!token) return;
    setPinningId(id);
    try {
      const res = await apiFetch(`/posts/${id}/pin`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned: !currentPinned }),
      });
      if (res.ok) {
        const data = await res.json();
        setPosts((prev) =>
          prev.map((p) => (p.id === id ? { ...p, pinned: !!data.pinned } : p))
        );
      } else {
        alert("操作失败");
      }
    } catch {
      alert("网络错误");
    } finally {
      setPinningId(null);
    }
  };

  const handleTogglePermission = async (
    id: string,
    field: "likesDisabled" | "commentsDisabled",
    current: boolean
  ) => {
    if (!token) return;
    setPermId(id);
    try {
      const res = await apiFetch(`/posts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: !current }),
      });
      if (res.ok) {
        setPosts((prev) =>
          prev.map((p) => (p.id === id ? { ...p, [field]: !current } : p))
        );
      } else {
        alert("操作失败");
      }
    } catch {
      alert("网络错误");
    } finally {
      setPermId(null);
    }
  };

  if (loading) {
    return (
      <div className="divide-hairline rounded-xl bg-white dark:bg-adm-card">
        {Array.from({ length: 4 }).map((_, i) => (
          <PostCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-bold text-adm-text">动态管理</h2>
        <p className="mt-1 text-sm text-adm-text-secondary">
          共 {posts.length} 条动态（发布请使用顶栏「发表动态」按钮）
        </p>
      </div>

      {posts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-adm-border bg-adm-card py-12 text-center">
          <p className="text-sm text-adm-text-tertiary">暂无动态</p>
        </div>
      ) : (
        <div className="gap-3 sm:columns-2">
          {posts.map((post, index) => (
            <div key={post.id} className="mb-3 break-inside-avoid overflow-hidden rounded-2xl border border-adm-border bg-adm-card">
              <PostCard post={post} index={index} onDelete={() => handleDelete(post.id)} />
              <ActionBar
                post={post}
                permId={permId}
                pinningId={pinningId}
                deletingId={deletingId}
                onDelete={handleDelete}
                onPin={handlePin}
                onTogglePerm={handleTogglePermission}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Admin action bar */
function ActionBar({
  post,
  permId,
  pinningId,
  deletingId,
  onDelete,
  onPin,
  onTogglePerm,
}: {
  post: Post;
  permId: string | null;
  pinningId: string | null;
  deletingId: string | null;
  onDelete: (id: string) => void;
  onPin: (id: string, pinned: boolean) => void;
  onTogglePerm: (id: string, field: "likesDisabled" | "commentsDisabled", current: boolean) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2 border-t border-adm-border bg-adm-card-hover/40 px-4 py-2.5">
      <button
        onClick={() => onTogglePerm(post.id, "likesDisabled", !!post.likesDisabled)}
        disabled={permId === post.id}
        title={post.likesDisabled ? "已关闭点赞，点击开启" : "允许点赞，点击关闭"}
        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
          post.likesDisabled
            ? "text-adm-danger bg-adm-danger-bg"
            : "text-adm-text-secondary hover:bg-adm-card-hover"
        }`}
      >
        <Heart className="h-3.5 w-3.5" />
        {post.likesDisabled ? "点赞已关" : "允许点赞"}
      </button>
      <button
        onClick={() => onTogglePerm(post.id, "commentsDisabled", !!post.commentsDisabled)}
        disabled={permId === post.id}
        title={post.commentsDisabled ? "已关闭评论，点击开启" : "允许评论，点击关闭"}
        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
          post.commentsDisabled
            ? "text-adm-danger bg-adm-danger-bg"
            : "text-adm-text-secondary hover:bg-adm-card-hover"
        }`}
      >
        <MessageSquare className="h-3.5 w-3.5" />
        {post.commentsDisabled ? "评论已关" : "允许评论"}
      </button>
      <div className="mx-1 h-4 w-px bg-adm-border" />
      {!post.isAd && (
        <button
          onClick={() => onPin(post.id, !!post.pinned)}
          disabled={pinningId === post.id}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-adm-text-secondary transition-colors hover:bg-adm-card-hover disabled:opacity-50"
        >
          {post.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
          {pinningId === post.id ? "处理中..." : post.pinned ? "取消置顶" : "置顶动态"}
        </button>
      )}
      <button
        onClick={() => onDelete(post.id)}
        disabled={deletingId === post.id}
        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-adm-danger transition-colors hover:bg-adm-danger-bg disabled:opacity-50"
      >
        <Trash2 className="h-3.5 w-3.5" />
        {deletingId === post.id ? "删除中..." : "删除动态"}
      </button>
    </div>
  );
}
