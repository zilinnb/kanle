"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { MessageCircle, Trash2, Search, Link2, Pencil, Check, X, Smile, ChevronDown, ChevronUp } from "lucide-react";
import { cravatarUrl } from "@/lib/avatar";
import { apiFetch, getToken } from "@/lib/api-fetch";
import { renderTextWithEmoji, EMOJI_LIST, shortcodeToHtml, editableToShortcode, emojiImgTag } from "@/lib/emoji";
import { CommentRowSkeleton } from "@/components/Skeleton";

interface AdminComment {
  id: string;
  author: string;
  email: string;
  website?: string;
  content: string;
  replyTo?: string;
  region?: string;
  createdAt: string;
  post: {
    id: string;
    content: string;
    author: string;
  } | null;
}

/** Strip HTML tags + decode entities + truncate for preview */
function stripHtml(html: string): string {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return (tmp.textContent || tmp.innerText || "").replace(/\s+/g, " ").trim();
}

function truncate(text: string, max = 40): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + "...";
}

export default function AdminComments() {
  const router = useRouter();
  const [comments, setComments] = useState<AdminComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ author: "", email: "", website: "", content: "" });
  const [saving, setSaving] = useState(false);

  const token = getToken();

  const fetchComments = () => {
    if (!token) return;
    setLoading(true);
    apiFetch("/admin/comments")
      .then((res) => res.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setComments(list);
        if (list.length > 0 && !selectedId) setSelectedId(list[0].id);
      })
      .catch(() => setComments([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!token) {
      router.replace("/");
      return;
    }
    fetchComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, token]);

  const handleDelete = async (id: string) => {
    if (!token || !confirm("确定删除这条评论吗？")) return;
    const res = await apiFetch(`/admin/comments/${id}`, { method: "DELETE" });
    if (res.ok) {
      setComments((prev) => prev.filter((c) => c.id !== id));
      if (selectedId === id) setSelectedId(null);
    }
  };

  const startEdit = (c: AdminComment) => {
    setEditingId(c.id);
    setEditForm({ author: c.author, email: c.email, website: c.website || "", content: c.content });
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = async (id: string, content: string) => {
    setSaving(true);
    try {
      const res = await apiFetch(`/admin/comments/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          author: editForm.author.trim(),
          email: editForm.email.trim(),
          website: editForm.website.trim(),
          content: content.trim(),
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setComments((prev) => prev.map((c) => (c.id === id ? { ...c, ...updated } : c)));
        setEditingId(null);
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.message || "保存失败，请重试");
      }
    } catch {
      alert("网络错误，请重试");
    } finally {
      setSaving(false);
    }
  };

  const filtered = comments.filter(
    (c) =>
      c.author.toLowerCase().includes(search.toLowerCase()) ||
      c.content.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase())
  );

  const selected = comments.find((c) => c.id === selectedId) || null;

  if (loading) {
    return (
      <div className="divide-hairline rounded-xl bg-white dark:bg-adm-card">
        {Array.from({ length: 5 }).map((_, i) => (
          <CommentRowSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-bold text-adm-text">评论管理</h2>
        <p className="mt-1 text-sm text-adm-text-secondary">
          共 {comments.length} 条评论
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-adm-text-tertiary" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索昵称、邮箱或内容..."
          className="w-full rounded-xl border border-adm-border bg-adm-card py-2.5 pl-10 pr-3 text-sm text-adm-text transition-colors focus:border-adm-text-secondary focus:outline-none"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-adm-border bg-adm-card py-12 text-center">
          <MessageCircle className="mx-auto mb-2 h-8 w-8 text-adm-text-tertiary" />
          <p className="text-sm text-adm-text-tertiary">
            {search ? "未找到匹配的评论" : "暂无评论"}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop: double-column list + detail */}
          <div className="hidden gap-3 lg:grid lg:grid-cols-[360px_1fr]">
            <div className="space-y-2 lg:max-h-[calc(100vh-16rem)] lg:overflow-y-auto lg:pr-1">
              {filtered.map((comment) => (
                <CommentListItem
                  key={comment.id}
                  comment={comment}
                  selected={selectedId === comment.id}
                  onSelect={() => {
                    setSelectedId(comment.id);
                    setEditingId(null);
                  }}
                />
              ))}
            </div>
            <div>
              {selected ? (
                <CommentDetail
                  comment={selected}
                  editingId={editingId}
                  editForm={editForm}
                  setEditForm={setEditForm}
                  saving={saving}
                  onStartEdit={startEdit}
                  onCancelEdit={cancelEdit}
                  onSaveEdit={saveEdit}
                  onDelete={handleDelete}
                />
              ) : (
                <div className="rounded-2xl border border-dashed border-adm-border bg-adm-card py-16 text-center">
                  <MessageCircle className="mx-auto mb-2 h-8 w-8 text-adm-text-tertiary" />
                  <p className="text-sm text-adm-text-tertiary">选择左侧评论查看详情</p>
                </div>
              )}
            </div>
          </div>

          {/* Mobile: single column with inline edit */}
          <div className="space-y-2 lg:hidden">
            {filtered.map((comment) => (
              <div key={`mobile-${comment.id}`}>
                {editingId === comment.id ? (
                  <CommentEditCard
                    editForm={editForm}
                    setEditForm={setEditForm}
                    saving={saving}
                    onCancelEdit={cancelEdit}
                    onSaveEdit={(content) => saveEdit(comment.id, content)}
                  />
                ) : (
                  <CommentMobileCard
                    comment={comment}
                    onStartEdit={startEdit}
                    onDelete={handleDelete}
                  />
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** List item (desktop left column) */
function CommentListItem({
  comment,
  selected,
  onSelect,
}: {
  comment: AdminComment;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full rounded-xl border p-3 text-left transition-colors ${
        selected
          ? "border-adm-primary bg-adm-primary/5"
          : "border-adm-border bg-adm-card hover:bg-adm-card-hover"
      }`}
    >
      <div className="flex items-start gap-2.5">
        <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-lg bg-adm-input">
          <Image
            src={cravatarUrl(comment.email || "", 64)}
            alt={comment.author}
            fill
            className="object-cover"
            sizes="32px"
            unoptimized
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium text-adm-text">{comment.author}</span>
            <span className="text-[10px] text-adm-text-tertiary">{comment.email}</span>
          </div>
          <p
            className="mt-0.5 line-clamp-2 text-xs text-adm-text-secondary"
            dangerouslySetInnerHTML={{ __html: renderTextWithEmoji(comment.content) }}
          />
          <div className="mt-1 flex items-center gap-2 text-[10px] text-adm-text-tertiary">
            <span>{new Date(comment.createdAt).toLocaleDateString("zh-CN")}</span>
            {comment.region && (
              <span>{comment.region}</span>
            )}
            {comment.post && (
              <span className="truncate">
                来自：{comment.post.author} · {truncate(stripHtml(comment.post.content), 20)}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

/** Detail panel (desktop right column) */
function CommentDetail({
  comment,
  editingId,
  editForm,
  setEditForm,
  saving,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
}: {
  comment: AdminComment;
  editingId: string | null;
  editForm: { author: string; email: string; website: string; content: string };
  setEditForm: React.Dispatch<React.SetStateAction<{ author: string; email: string; website: string; content: string }>>;
  saving: boolean;
  onStartEdit: (c: AdminComment) => void;
  onCancelEdit: () => void;
  onSaveEdit: (id: string, content: string) => void;
  onDelete: (id: string) => void;
}) {
  if (editingId === comment.id) {
    return (
      <CommentEditCard
        editForm={editForm}
        setEditForm={setEditForm}
        saving={saving}
        onCancelEdit={onCancelEdit}
        onSaveEdit={(content) => onSaveEdit(comment.id, content)}
      />
    );
  }

  return (
    <div className="rounded-2xl border border-adm-border bg-adm-card p-4">
      <div className="flex items-start gap-3">
        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-adm-input">
          <Image
            src={cravatarUrl(comment.email || "", 80)}
            alt={comment.author}
            fill
            className="object-cover"
            sizes="40px"
            unoptimized
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="text-sm font-medium text-adm-text">{comment.author}</span>
            <span className="text-xs text-adm-text-tertiary">{comment.email}</span>
            {comment.website && (
              <a
                href={comment.website.startsWith("http") ? comment.website : `https://${comment.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-0.5 text-xs text-adm-text-secondary transition-colors hover:text-adm-primary"
              >
                <Link2 className="h-3 w-3" />
                {comment.website}
              </a>
            )}
            {comment.replyTo && (
              <span className="text-xs text-adm-text-tertiary">
                回复 <span className="text-adm-text-secondary">{comment.replyTo}</span>
              </span>
            )}
          </div>

          <div
            className="mt-2 text-[15px] leading-6 text-adm-text-secondary"
            dangerouslySetInnerHTML={{ __html: renderTextWithEmoji(comment.content) }}
          />

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-adm-text-tertiary">
            <span>{new Date(comment.createdAt).toLocaleString("zh-CN")}</span>
            {comment.region && (
              <span>{comment.region}</span>
            )}
            {comment.post && (
              <span className="truncate">
                来自：{comment.post.author} · {truncate(stripHtml(comment.post.content), 30)}
              </span>
            )}
          </div>

          <div className="mt-3 flex gap-1.5">
            <button
              onClick={() => onStartEdit(comment)}
              className="flex items-center gap-1 rounded-lg bg-adm-card-hover px-3 py-1.5 text-xs text-adm-text-secondary transition-colors hover:bg-adm-card-hover/80"
            >
              <Pencil className="h-3 w-3" />
              编辑
            </button>
            <button
              onClick={() => onDelete(comment.id)}
              className="flex items-center gap-1 rounded-lg bg-adm-danger-bg px-3 py-1.5 text-xs text-adm-danger transition-colors hover:bg-adm-danger/10"
            >
              <Trash2 className="h-3 w-3" />
              删除
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Edit card (shared by desktop detail and mobile) */
function CommentEditCard({
  editForm,
  setEditForm,
  saving,
  onCancelEdit,
  onSaveEdit,
}: {
  editForm: { author: string; email: string; website: string; content: string };
  setEditForm: React.Dispatch<React.SetStateAction<{ author: string; email: string; website: string; content: string }>>;
  saving: boolean;
  onCancelEdit: () => void;
  onSaveEdit: (content: string) => void;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const savedRange = useRef<Range | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [emojiExpanded, setEmojiExpanded] = useState(false);

  // 初始化：将短代码文本转为 HTML（表情以 img 显示）写入 contentEditable
  // 组件每次进入编辑模式都会重新挂载，所以 [] 依赖即可
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.innerHTML = shortcodeToHtml(editForm.content);
    const text = editableToShortcode(editor);
    editor.setAttribute("data-empty", text ? "false" : "true");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveSelection = useCallback(() => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (editorRef.current && editorRef.current.contains(range.commonAncestorContainer)) {
        savedRange.current = range.cloneRange();
      }
    }
  }, []);

  const restoreSelection = useCallback(() => {
    const range = savedRange.current;
    if (!range) return;
    const sel = window.getSelection();
    if (!sel) return;
    sel.removeAllRanges();
    sel.addRange(range);
  }, []);

  const syncContent = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const text = editableToShortcode(editor);
    setEditForm((prev) => ({ ...prev, content: text }));
    const isEmpty = !text;
    editor.setAttribute("data-empty", isEmpty ? "true" : "false");
    if (isEmpty && editor.innerHTML !== "") {
      editor.innerHTML = "";
      savedRange.current = null;
    }
  }, [setEditForm]);

  const insertEmoji = (name: string) => {
    const item = EMOJI_LIST.find((e) => e.name === name);
    if (!item) return;
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    if (!savedRange.current) {
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    } else {
      restoreSelection();
    }
    const imgHtml = emojiImgTag(name);
    document.execCommand("insertHTML", false, imgHtml);
    requestAnimationFrame(() => saveSelection());
    syncContent();
  };

  const handleSave = () => {
    const editor = editorRef.current;
    const text = editor ? editableToShortcode(editor) : editForm.content;
    onSaveEdit(text);
  };

  return (
    <div className="rounded-2xl border border-adm-border bg-adm-card p-4">
      <div className="space-y-2">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <input
            type="text"
            value={editForm.author}
            onChange={(e) => setEditForm({ ...editForm, author: e.target.value })}
            placeholder="昵称"
            className="rounded-lg border border-adm-border bg-adm-input px-2.5 py-1.5 text-sm text-adm-text focus:border-adm-text-secondary focus:outline-none"
          />
          <input
            type="email"
            value={editForm.email}
            onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
            placeholder="邮箱"
            className="rounded-lg border border-adm-border bg-adm-input px-2.5 py-1.5 text-sm text-adm-text focus:border-adm-text-secondary focus:outline-none"
          />
          <input
            type="text"
            value={editForm.website}
            onChange={(e) => setEditForm({ ...editForm, website: e.target.value })}
            placeholder="网址"
            className="rounded-lg border border-adm-border bg-adm-input px-2.5 py-1.5 text-sm text-adm-text focus:border-adm-text-secondary focus:outline-none"
          />
        </div>
        <div className="rounded-lg border border-adm-border bg-adm-input">
          <div className="relative">
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              data-empty="true"
              data-placeholder="评论内容"
              onInput={syncContent}
              onKeyUp={saveSelection}
              onMouseUp={saveSelection}
              className="comment-editor w-full min-h-[72px] resize-none px-2.5 py-1.5 pr-8 text-[15px] leading-6 text-adm-text focus:outline-none"
            />
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                saveSelection();
                const next = !showEmoji;
                setShowEmoji(next);
                if (next) setEmojiExpanded(false);
              }}
              className={`absolute bottom-1.5 right-1.5 transition-colors ${showEmoji ? "text-adm-primary" : "text-adm-text-tertiary hover:text-adm-text-secondary"}`}
              aria-label="表情"
            >
              <Smile className="h-4 w-4" />
            </button>
          </div>
          {showEmoji && (
            <div className="border-t border-adm-border px-2 py-2 animate-emoji-fade-in">
              <div
                className="grid grid-cols-8 gap-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                style={{ maxHeight: emojiExpanded ? "220px" : "none" }}
              >
                {(emojiExpanded ? EMOJI_LIST : EMOJI_LIST.slice(0, 20)).map((emoji) => (
                  <button
                    key={emoji.file}
                    type="button"
                    onClick={() => insertEmoji(emoji.name)}
                    className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-adm-card-hover"
                    title={emoji.name}
                  >
                    <img
                      src={emoji.url}
                      alt={emoji.name}
                      className="inline-emoji h-6 w-6"
                      loading="lazy"
                    />
                  </button>
                ))}
                {EMOJI_LIST.length > 20 && (
                  <button
                    type="button"
                    onClick={() => setEmojiExpanded((v) => !v)}
                    className="flex h-8 w-8 items-center justify-center rounded-md text-adm-text-tertiary transition-colors hover:bg-adm-card-hover"
                    title={emojiExpanded ? "收起" : "展开全部"}
                    aria-label={emojiExpanded ? "收起表情" : "展开全部表情"}
                  >
                    {emojiExpanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-1.5">
          <button
            onClick={onCancelEdit}
            className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs text-adm-text-secondary transition-colors hover:bg-adm-card-hover"
          >
            <X className="h-3 w-3" />
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1 rounded-lg bg-adm-primary px-3 py-1.5 text-xs font-medium text-adm-primary-text transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Check className="h-3 w-3" />
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

/** Mobile comment card (single column) */
function CommentMobileCard({
  comment,
  onStartEdit,
  onDelete,
}: {
  comment: AdminComment;
  onStartEdit: (c: AdminComment) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="rounded-xl border border-adm-border bg-adm-card p-3">
      <div className="flex items-start gap-2.5">
        <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-lg bg-adm-input">
          <Image
            src={cravatarUrl(comment.email || "", 64)}
            alt={comment.author}
            fill
            className="object-cover"
            sizes="32px"
            unoptimized
          />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="text-sm font-medium text-adm-text">{comment.author}</span>
            <span className="text-xs text-adm-text-tertiary">{comment.email}</span>
            {comment.website && (
              <a
                href={comment.website.startsWith("http") ? comment.website : `https://${comment.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-0.5 text-xs text-adm-text-secondary transition-colors hover:text-adm-primary"
              >
                <Link2 className="h-3 w-3" />
                {comment.website}
              </a>
            )}
            {comment.replyTo && (
              <span className="text-xs text-adm-text-tertiary">
                回复 <span className="text-adm-text-secondary">{comment.replyTo}</span>
              </span>
            )}
          </div>

          <p
            className="text-[15px] leading-6 text-adm-text-secondary break-words"
            dangerouslySetInnerHTML={{ __html: renderTextWithEmoji(comment.content) }}
          />

          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 pt-0.5">
            <div className="flex min-w-0 flex-1 items-center gap-2 text-xs text-adm-text-tertiary">
              <span>{new Date(comment.createdAt).toLocaleString("zh-CN")}</span>
              {comment.region && (
                <span>{comment.region}</span>
              )}
              {comment.post && (
                <span className="truncate">
                  来自：{comment.post.author} · {truncate(stripHtml(comment.post.content), 20)}
                </span>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                onClick={() => onStartEdit(comment)}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-adm-text-secondary transition-colors hover:bg-adm-card-hover"
              >
                <Pencil className="h-3 w-3" />
                编辑
              </button>
              <button
                onClick={() => onDelete(comment.id)}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-adm-danger transition-colors hover:bg-adm-danger-bg"
              >
                <Trash2 className="h-3 w-3" />
                删除
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
