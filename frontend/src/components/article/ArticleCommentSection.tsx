"use client";

import { useEffect, useLayoutEffect, useRef, useState, useCallback, useMemo } from "react";
import { flushSync } from "react-dom";
import { Comment, Post, formatRelativeTime } from "@/lib/mock-data";
import { cravatarUrl } from "@/lib/avatar";
import { findParentComment, findRootCommentId } from "@/lib/comment-utils";
import { getCurrentUser, CurrentUser } from "@/lib/auth";
import { EMOJI_LIST, editableToShortcode, renderTextWithEmoji } from "@/lib/emoji";
import { Smile, ThumbsUp, X, ChevronDown, ChevronUp } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

interface ArticleCommentSectionProps {
  post: Post;
  comments: Comment[];
  onCommentsChange: (comments: Comment[]) => void;
  /** 外部触发回复目标（来自评论列表的"回复"按钮） */
  pendingReplyTo?: string;
  onPendingReplyConsumed?: () => void;
  /** 递增信号：每次变化时聚焦输入框并滚动到输入区域（用于底部栏"写留言"按钮） */
  focusSignal?: number;
}

interface VisitorInfo {
  nickname: string;
  email: string;
  website: string;
}

function saveVisitorInfo(info: VisitorInfo) {
  localStorage.setItem("visitor_name", info.nickname);
  localStorage.setItem("visitor_email", info.email);
  localStorage.setItem("visitor_website", info.website);
}

export default function ArticleCommentSection({
  post,
  comments,
  onCommentsChange,
  pendingReplyTo,
  onPendingReplyConsumed,
  focusSignal,
}: ArticleCommentSectionProps) {
  const [content, setContent] = useState("");
  const [replyTo, setReplyTo] = useState<string | undefined>(undefined);
  // replyTo 存储父评论 ID；显示用名字需用 ID 查找
  const replyToName = replyTo ? comments.find((c) => c.id === replyTo)?.author : undefined;
  const [submitting, setSubmitting] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [emojiExpanded, setEmojiExpanded] = useState(false);
  const [error, setError] = useState("");
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [editing, setEditing] = useState(false);
  const [formNickname, setFormNickname] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formWebsite, setFormWebsite] = useState("");
  // 输入区是否展开：默认收起为横条，点击后展开成完整编辑器
  const [expanded, setExpanded] = useState(false);
  // 内联回复状态：点击"回复"后在该评论下方展开输入框
  const [inlineReplyId, setInlineReplyId] = useState<string | null>(null);
  const [inlineContent, setInlineContent] = useState("");
  const [inlineSubmitting, setInlineSubmitting] = useState(false);
  const [inlineShowEmoji, setInlineShowEmoji] = useState(false);
  const [inlineError, setInlineError] = useState("");
  // 回复折叠状态：默认折叠，点击"N条回复"展开
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());
  const inlineEditorRef = useRef<HTMLDivElement>(null);
  const inlineSavedRange = useRef<Range | null>(null);

  // 评论点赞局部状态（乐观更新，不写回 onCommentsChange）
  const [commentLikes, setCommentLikes] = useState<Record<string, { likeCount: number; meLiked: boolean }>>(() => {
    const map: Record<string, { likeCount: number; meLiked: boolean }> = {};
    for (const c of comments) {
      map[c.id] = { likeCount: c.likeCount || 0, meLiked: !!c.meLiked };
    }
    return map;
  });

  const editorRef = useRef<HTMLDivElement>(null);
  const savedRange = useRef<Range | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const inputContainerRef = useRef<HTMLDivElement>(null);
  // 跟踪 expanded 当前值，供 focusSignal 切换判断使用（避免 setState 回调中触发副作用）
  const expandedRef = useRef(false);
  useEffect(() => { expandedRef.current = expanded; }, [expanded]);

  // 从邮件/通知链接跳转：/articles/{id}#comment-{commentId} → 展开线程并滚动到评论
  const hashScrolledRef = useRef(false);
  useEffect(() => {
    if (hashScrolledRef.current) return;
    if (comments.length === 0) return;
    const hash = window.location.hash;
    if (!hash.startsWith("#comment-")) return;
    const commentId = hash.substring(9);
    const target = comments.find((c) => c.id === commentId);
    if (!target) return;

    hashScrolledRef.current = true;

    // 如果是子回复，展开所属线程
    if (target.replyTo || target.replyToId) {
      const rootId = findRootCommentId(target, comments);
      if (rootId) {
        setExpandedThreads((prev) => new Set(prev).add(rootId));
      }
    }

    // 等线程展开后滚动（requestAnimationFrame 两帧确保 DOM 已更新）
    const scrollToComment = () => {
      const el = document.getElementById(`comment-${commentId}`);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.style.transition = "background-color 0.3s ease";
      el.style.backgroundColor = "rgba(128, 128, 128, 0.14)";
      setTimeout(() => { el.style.backgroundColor = ""; }, 2500);
      // 清除 hash 避免刷新重复触发
      window.history.replaceState({}, "", window.location.pathname);
    };
    requestAnimationFrame(() => requestAnimationFrame(scrollToComment));
  }, [comments]);

  useEffect(() => {
    const user = getCurrentUser();
    setCurrentUser(user);
    if (user && !user.isLoggedIn) {
      setFormNickname(user.nickname);
      setFormEmail(user.email);
      setFormWebsite(user.website);
    }
  }, []);

  // 同步外部传入的回复目标（comment ID，来自评论列表"回复"按钮）→ 展开内联回复
  useLayoutEffect(() => {
    if (pendingReplyTo) {
      const target = comments.find((c) => c.id === pendingReplyTo);
      if (target) {
        // 目标是子回复时，用 findRootCommentId 找根评论 id 用于展开线程
        let rootId: string | null = null;
        if (target.replyTo || target.replyToId) {
          rootId = findRootCommentId(target, comments);
        }
        flushSync(() => {
          if (rootId) {
            setExpandedThreads((prev) => new Set(prev).add(rootId!));
          }
          setInlineReplyId(target.id);
          setInlineContent("");
          setInlineShowEmoji(false);
          setInlineError("");
        });
        inlineEditorRef.current?.focus();
      }
      onPendingReplyConsumed?.();
    }
  }, [pendingReplyTo, onPendingReplyConsumed, comments]);

  // 底部栏"写留言"按钮触发：展开编辑器（focus 和滚动由 ArticleReader 直接处理，
  // 确保在用户手势栈内同步 focus，手机端能自动弹键盘）
  useLayoutEffect(() => {
    if (!focusSignal) return;
    if (!expandedRef.current) {
      setExpanded(true);
    }
  }, [focusSignal]);

  // 点击横条展开 — flushSync 同步更新 DOM 后立即 focus（手机端自动弹键盘）
  const handleExpand = () => {
    flushSync(() => setExpanded(true));
    editorRef.current?.focus();
    requestAnimationFrame(() => {
      const target = inputContainerRef.current;
      if (!target) return;
      const scrollRoot = document.getElementById("scroll-root");
      if (scrollRoot && window.innerWidth >= 768) {
        const scrollRect = scrollRoot.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        const offset = 80;
        const top = scrollRoot.scrollTop + (targetRect.top - scrollRect.top) - offset;
        scrollRoot.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
      } else {
        target.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
  };

  // 展开后点击外部收起（保留草稿与回复状态）
  useEffect(() => {
    if (!expanded) return;
    const handlePointerDown = (e: MouseEvent) => {
      const form = formRef.current;
      if (!form) return;
      if (form.contains(e.target as Node)) return;
      // 标记 data-no-collapse 的元素不收起（回复按钮、底部栏"写留言"按钮等需要保持展开避免闪烁）
      const target = e.target as HTMLElement;
      if (target.closest("[data-no-collapse]")) return;
      setExpanded(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [expanded]);

  // ===== 表情编辑器逻辑（从 CommentSection 复制）=====
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
    setContent(text);
    const isEmpty = !text;
    editor.setAttribute("data-empty", isEmpty ? "true" : "false");
    if (isEmpty && editor.innerHTML !== "") {
      editor.innerHTML = "";
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(true);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      savedRange.current = null;
    }
  }, []);

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
    const imgHtml = `<img src="${item.url}" alt="${name}" class="inline-emoji" />`;
    document.execCommand("insertHTML", false, imgHtml);
    requestAnimationFrame(() => saveSelection());
    syncContent();
  };

  const handleEditorKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      cancelReply();
      setExpanded(false);
    }
  };

  // ===== 评论提交公共逻辑（底部编辑器和内联回复共用）=====
  const submitComment = async (
    text: string,
    replyToAuthor: string | undefined,
    replyToEmail: string,
    errorSetter: (msg: string) => void,
    replyToId?: string
  ): Promise<boolean> => {
    const trimmedText = text.trim();
    if (!trimmedText) return false;

    let authorName = "";
    let authorEmail = "";
    let authorWebsite = "";

    if (currentUser?.isLoggedIn) {
      authorName = currentUser.nickname;
      authorEmail = currentUser.email;
    } else {
      const nickname = formNickname.trim();
      const email = formEmail.trim();
      const website = formWebsite.trim();
      const info = { nickname, email, website };
      saveVisitorInfo(info);
      setCurrentUser({ isLoggedIn: false, nickname, email, website });
      setEditing(false);
      authorName = nickname;
      authorEmail = email;
      authorWebsite = website;
    }

    errorSetter("");
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (currentUser?.isLoggedIn && currentUser.token) {
        headers.Authorization = `Bearer ${currentUser.token}`;
      }
      const res = await fetch(`${API_URL}/posts/${post.id}/comments`, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          authorName,
          email: authorEmail,
          website: authorWebsite || undefined,
          content: trimmedText,
          replyTo: replyToAuthor,
          replyToEmail: replyToEmail || undefined,
          replyToId: replyToId || undefined,
        }),
      });
      if (!res.ok) {
        if (res.status === 429 || res.status === 403) {
          const data = await res.json().catch(() => ({ message: "" }));
          errorSetter(data?.message || (res.status === 429 ? "评论太快了，请稍后再试" : "您已被限制评论"));
        } else {
          errorSetter("发送失败，请重试");
        }
        return false;
      }
      const newComment = await res.json();
      const updated = [...comments, newComment];
      onCommentsChange(updated);
      setCommentLikes((prev) => ({
        ...prev,
        [newComment.id]: { likeCount: 0, meLiked: false },
      }));

      // 游客填写昵称后，同步历史点赞的显示名
      if (!currentUser?.isLoggedIn && authorName && authorEmail) {
        try {
          await fetch(`${API_URL}/posts/likes/update-name`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ email: authorEmail, newName: authorName }),
          });
        } catch {
          // 非关键操作
        }
      }
      return true;
    } catch {
      errorSetter("发送失败，请重试");
      return false;
    }
  };

  // 底部编辑器提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const editor = editorRef.current;
    const text = editor ? editableToShortcode(editor) : content;
    if (!text.trim() || submitting) return;

    let replyToEmail = "";
    let replyToAuthor = "";
    if (replyTo) {
      const parent = comments.find((c) => c.id === replyTo);
      if (parent) {
        replyToEmail = parent.email || "";
        replyToAuthor = parent.author;
      }
    }

    setSubmitting(true);
    const ok = await submitComment(text, replyToAuthor || undefined, replyToEmail, setError, replyTo);
    setSubmitting(false);

    if (ok) {
      if (editorRef.current) {
        editorRef.current.innerHTML = "";
        editorRef.current.setAttribute("data-empty", "true");
      }
      setContent("");
      setReplyTo(undefined);
      setExpanded(false);
    }
  };

  // 内联回复提交
  const handleInlineSubmit = async () => {
    const targetComment = comments.find((c) => c.id === inlineReplyId);
    const editor = inlineEditorRef.current;
    const text = editor ? editableToShortcode(editor) : inlineContent;
    if (!targetComment || !text.trim() || inlineSubmitting) return;
    setInlineSubmitting(true);
    const ok = await submitComment(
      text,
      targetComment.author,
      targetComment.email || "",
      setInlineError,
      targetComment.id
    );
    setInlineSubmitting(false);
    if (ok) {
      // 自动展开所属线程，让新回复可见
      if (targetComment.replyTo || targetComment.replyToId) {
        // 回复的是子回复：向上找根评论并展开（用 findParentComment 避免同名歧义）
        const rootId = findRootCommentId(targetComment, comments);
        if (rootId) {
          setExpandedThreads((prev) => new Set(prev).add(rootId));
        }
      } else {
        // 回复的是顶级评论：直接展开
        setExpandedThreads((prev) => new Set(prev).add(targetComment.id));
      }
      if (editor) {
        editor.innerHTML = "";
        editor.setAttribute("data-empty", "true");
      }
      setInlineContent("");
      setInlineReplyId(null);
      setInlineShowEmoji(false);
      setInlineError("");
    }
  };

  // ===== 内联回复编辑器逻辑（contentEditable，与底部编辑器同方案）=====
  const inlineSaveSelection = useCallback(() => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (inlineEditorRef.current && inlineEditorRef.current.contains(range.commonAncestorContainer)) {
        inlineSavedRange.current = range.cloneRange();
      }
    }
  }, []);

  const inlineRestoreSelection = useCallback(() => {
    const range = inlineSavedRange.current;
    if (!range) return;
    const sel = window.getSelection();
    if (!sel) return;
    sel.removeAllRanges();
    sel.addRange(range);
  }, []);

  const inlineSyncContent = useCallback(() => {
    const editor = inlineEditorRef.current;
    if (!editor) return;
    const text = editableToShortcode(editor);
    setInlineContent(text);
    const isEmpty = !text;
    editor.setAttribute("data-empty", isEmpty ? "true" : "false");
    if (isEmpty && editor.innerHTML !== "") {
      editor.innerHTML = "";
    }
  }, []);

  const insertInlineEmoji = (name: string) => {
    const item = EMOJI_LIST.find((e) => e.name === name);
    if (!item) return;
    const editor = inlineEditorRef.current;
    if (!editor) return;
    editor.focus();
    if (!inlineSavedRange.current) {
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    } else {
      inlineRestoreSelection();
    }
    const imgHtml = `<img src="${item.url}" alt="${name}" class="inline-emoji" />`;
    document.execCommand("insertHTML", false, imgHtml);
    requestAnimationFrame(() => inlineSaveSelection());
    inlineSyncContent();
  };

  const handleSaveInfo = () => {
    if (!formRef.current?.reportValidity()) return;
    const nickname = formNickname.trim();
    const email = formEmail.trim();
    const website = formWebsite.trim();
    const info = { nickname, email, website };
    saveVisitorInfo(info);
    setCurrentUser({ isLoggedIn: false, nickname, email, website });
    setEditing(false);
  };

  const cancelReply = () => {
    setReplyTo(undefined);
  };

  // ===== 评论点赞 toggle =====
  const handleCommentLike = async (commentId: string) => {
    const current = commentLikes[commentId] || { likeCount: 0, meLiked: false };
    const newMeLiked = !current.meLiked;
    const newLikeCount = newMeLiked ? current.likeCount + 1 : Math.max(0, current.likeCount - 1);
    // 乐观更新
    setCommentLikes((prev) => ({
      ...prev,
      [commentId]: { likeCount: newLikeCount, meLiked: newMeLiked },
    }));
    try {
      const user = getCurrentUser();
      const name = user?.nickname || "访客";
      const email = user?.email || "";
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (user?.isLoggedIn && user.token) {
        headers.Authorization = `Bearer ${user.token}`;
      }
      const res = await fetch(`${API_URL}/posts/${post.id}/comments/${commentId}/likes`, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ name, email }),
      });
      if (!res.ok) {
        // 回滚
        setCommentLikes((prev) => ({ ...prev, [commentId]: current }));
        return;
      }
      const data = await res.json();
      setCommentLikes((prev) => ({
        ...prev,
        [commentId]: { likeCount: data.likeCount, meLiked: data.liked },
      }));
    } catch {
      setCommentLikes((prev) => ({ ...prev, [commentId]: current }));
    }
  };

  const handleReply = (comment: Comment) => {
    // toggle：再次点击同一条评论的"回复"则关闭
    if (inlineReplyId === comment.id) {
      setInlineReplyId(null);
      setInlineContent("");
      setInlineShowEmoji(false);
      setInlineError("");
      return;
    }
    // 回复的是子回复时，展开其所属线程（用 findRootCommentId 避免同名歧义）
    if (comment.replyTo || comment.replyToId) {
      const rootId = findRootCommentId(comment, comments);
      if (rootId) {
        setExpandedThreads((prev) => new Set(prev).add(rootId));
      }
    }
    flushSync(() => {
      setInlineReplyId(comment.id);
      setInlineContent("");
      setInlineShowEmoji(false);
      setInlineError("");
    });
    inlineEditorRef.current?.focus();
    inlineEditorRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  const isLoggedIn = currentUser?.isLoggedIn;
  const showInfoForm = !isLoggedIn && (!currentUser || editing);
  const commentCount = comments.length;

  // 按线程分组：顶级评论 + 其下所有回复（含跨级回复，如 C 回复 B 仍归入 A 的线程）
  // 通过 replyToId / replyTo 链向上查找根评论，确保整条对话归在一起
  const threads = useMemo(() => {
    const topLevel = comments.filter((c) => !c.replyTo && !c.replyToId);
    const replies = comments.filter((c) => c.replyTo || c.replyToId);

    const repliesByRoot = new Map<string, Comment[]>();
    const orphans: Comment[] = [];
    for (const reply of replies) {
      const rootId = findRootCommentId(reply, comments);
      if (rootId) {
        if (!repliesByRoot.has(rootId)) repliesByRoot.set(rootId, []);
        repliesByRoot.get(rootId)!.push(reply);
      } else {
        orphans.push(reply);
      }
    }
    // 每组回复按时间正序（对话顺序）
    for (const group of repliesByRoot.values()) {
      group.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }
    orphans.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    const result: { parent: Comment; replies: Comment[] }[] = [];
    for (const tc of topLevel) {
      result.push({ parent: tc, replies: repliesByRoot.get(tc.id) || [] });
    }
    // 孤儿回复（父链断裂，例如父评论被删除）渲染为独立条目
    for (const orphan of orphans) {
      result.push({ parent: orphan, replies: [] });
    }
    return result;
  }, [comments]);

  const toggleThread = useCallback((id: string) => {
    setExpandedThreads((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // 内联回复框（顶级评论和回复共用）
  const renderInlineReplyForm = (comment: Comment) => {
    if (inlineReplyId !== comment.id) return null;
    return (
      <div className="mt-2">
        {/* 游客信息表单（与底部编辑器同风格） */}
        {showInfoForm && (
          <div className="mb-2 grid grid-cols-2 gap-1.5 sm:grid-cols-[1fr_1fr_1fr_auto]">
            <input
              type="text"
              required
              value={formNickname}
              onChange={(e) => {
                setFormNickname(e.target.value);
                e.currentTarget.setCustomValidity("");
              }}
              onInvalid={(e) => e.currentTarget.setCustomValidity("请输入昵称")}
              placeholder="昵称 *"
              className="min-w-0 rounded-[4px] bg-gray-50 px-2.5 py-2 text-[13px] text-wechat-text placeholder:text-wechat-time focus:outline-none focus:bg-white dark:bg-white/[0.06] dark:focus:bg-white/[0.08]"
            />
            <input
              type="email"
              required
              value={formEmail}
              onChange={(e) => {
                setFormEmail(e.target.value);
                e.currentTarget.setCustomValidity("");
              }}
              onInvalid={(e) => {
                const input = e.currentTarget;
                input.setCustomValidity(input.value ? "请输入有效的邮箱" : "请输入邮箱");
              }}
              placeholder="邮箱 *"
              className="min-w-0 rounded-[4px] bg-gray-50 px-2.5 py-2 text-[13px] text-wechat-text placeholder:text-wechat-time focus:outline-none focus:bg-white dark:bg-white/[0.06] dark:focus:bg-white/[0.08]"
            />
            <input
              type="text"
              value={formWebsite}
              onChange={(e) => setFormWebsite(e.target.value)}
              placeholder="网站 (选填)"
              className="min-w-0 rounded-[4px] bg-gray-50 px-2.5 py-2 text-[13px] text-wechat-text placeholder:text-wechat-time focus:outline-none focus:bg-white dark:bg-white/[0.06] dark:focus:bg-white/[0.08]"
            />
          </div>
        )}
        {/* 灰色输入容器 — 与底部编辑器同风格 */}
        <div className="rounded-md bg-gray-100 dark:bg-[#232328]">
          <div className="relative">
            <div
              ref={inlineEditorRef}
              contentEditable
              suppressContentEditableWarning
              data-empty="true"
              data-placeholder={`回复 ${comment.author}...`}
              onInput={inlineSyncContent}
              onKeyUp={inlineSaveSelection}
              onMouseUp={inlineSaveSelection}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleInlineSubmit();
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  setInlineReplyId(null);
                  setInlineContent("");
                  setInlineShowEmoji(false);
                  setInlineError("");
                }
              }}
              className="inline-comment-editor w-full resize-none rounded-md bg-transparent px-3 py-2.5 pr-8 text-[15px] leading-[23px] text-wechat-text focus:outline-none md:text-[16px]"
            />
            <button
              type="button"
              data-no-collapse
              onClick={() => setInlineShowEmoji((v) => !v)}
              className={`absolute bottom-2 right-2 transition-colors ${inlineShowEmoji ? "text-[#07c160]" : "text-wechat-time hover:text-wechat-text"}`}
              aria-label="表情"
            >
              <Smile className="h-5 w-5 md:h-[18px] md:w-[18px]" />
            </button>
          </div>
          {/* emoji 选择器 — 与底部编辑器同风格 */}
          {inlineShowEmoji && (
            <div className="border-t border-gray-200 px-2 py-2 animate-emoji-fade-in dark:border-white/5">
              <div
                className="grid grid-cols-8 gap-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                style={{ maxHeight: "220px" }}
              >
                {EMOJI_LIST.map((emoji) => (
                  <button
                    key={emoji.name}
                    type="button"
                    data-no-collapse
                    onClick={() => insertInlineEmoji(emoji.name)}
                    className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-white dark:hover:bg-white/10"
                    title={emoji.name}
                  >
                    <img src={emoji.url} alt={emoji.name} className="h-6 w-6" loading="lazy" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        {/* 底部：错误 / 发送按钮 */}
        <div className="mt-1.5 flex items-center justify-between px-1">
          <span className="text-[13px] text-wechat-time">
            {inlineError ? (
              <span className="text-red-500 dark:text-red-400">{inlineError}</span>
            ) : inlineContent.length > 0 ? (
              `${inlineContent.length} 字`
            ) : (
              <span className="hidden sm:inline">Ctrl + Enter 发送</span>
            )}
          </span>
          {inlineContent.trim() && (
            <button
              type="button"
              onClick={handleInlineSubmit}
              disabled={inlineSubmitting}
              className="rounded-[4px] bg-[#07c160] px-4 py-1.5 text-[14px] font-medium text-white transition-colors hover:bg-[#06ad56] disabled:bg-gray-300 disabled:text-white"
            >
              {inlineSubmitting ? "发送中" : "发送"}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="mt-6">
      {/* "留言 {count}" 标题 — 留言和数字都加粗 */}
      <h3 className="mb-3 flex items-center gap-1 text-[16px] font-bold text-wechat-text dark:text-white md:text-[17px]">
        <span>留言</span>
        {commentCount > 0 && (
          <span className="text-[14px] font-bold md:text-[15px]">{commentCount}</span>
        )}
      </h3>

      {/* 输入框区域（commentsDisabled 时隐藏） */}
      {!post.commentsDisabled && (
        <form ref={formRef} onSubmit={handleSubmit}>
          {!expanded ? (
            /* 默认状态：写留言横条 + 右侧表情图标，点击展开 */
            <div
              onClick={handleExpand}
              className="flex cursor-text items-center justify-between rounded-md bg-gray-100 px-3 py-2.5 transition-colors hover:bg-gray-200/60 dark:bg-[#232328] dark:hover:bg-[#2a2a30]"
            >
              <span className="text-[15px] text-wechat-time md:text-[16px]">写留言</span>
              <Smile className="h-5 w-5 text-wechat-time md:h-[18px] md:w-[18px]" />
            </div>
          ) : (
            <>
              {/* 游客信息表单（未登录时展开后显示） */}
              {showInfoForm && (
                <div className="mb-2 grid grid-cols-2 gap-1.5 sm:grid-cols-[1fr_1fr_1fr_auto]">
                  <input
                    type="text"
                    required
                    value={formNickname}
                    onChange={(e) => {
                      setFormNickname(e.target.value);
                      e.currentTarget.setCustomValidity("");
                    }}
                    onInvalid={(e) => e.currentTarget.setCustomValidity("请输入昵称")}
                    placeholder="昵称 *"
                    className="min-w-0 rounded-[4px] bg-gray-50 px-2.5 py-2 text-[13px] text-wechat-text placeholder:text-wechat-time focus:outline-none focus:bg-white dark:bg-white/[0.06] dark:focus:bg-white/[0.08]"
                  />
                  <input
                    type="email"
                    required
                    value={formEmail}
                    onChange={(e) => {
                      setFormEmail(e.target.value);
                      e.currentTarget.setCustomValidity("");
                    }}
                    onInvalid={(e) => {
                      const input = e.currentTarget;
                      input.setCustomValidity(input.value ? "请输入有效的邮箱" : "请输入邮箱");
                    }}
                    placeholder="邮箱 *"
                    className="min-w-0 rounded-[4px] bg-gray-50 px-2.5 py-2 text-[13px] text-wechat-text placeholder:text-wechat-time focus:outline-none focus:bg-white dark:bg-white/[0.06] dark:focus:bg-white/[0.08]"
                  />
                  <input
                    type="text"
                    value={formWebsite}
                    onChange={(e) => setFormWebsite(e.target.value)}
                    placeholder="网站 (选填)"
                    className="min-w-0 rounded-[4px] bg-gray-50 px-2.5 py-2 text-[13px] text-wechat-text placeholder:text-wechat-time focus:outline-none focus:bg-white dark:bg-white/[0.06] dark:focus:bg-white/[0.08]"
                  />
                  {editing && (
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => setEditing(false)}
                        className="flex-1 rounded-[4px] bg-gray-100 px-1.5 py-2 text-center text-[13px] text-gray-500 transition-colors hover:bg-gray-200 dark:bg-white/5 dark:text-gray-400 dark:hover:bg-white/10"
                      >
                        取消
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveInfo}
                        className="flex-1 rounded-[4px] bg-[#07c160] px-1.5 py-2 text-center text-[13px] font-medium text-white transition-colors hover:bg-[#06ad56]"
                      >
                        保存
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* 身份栏 + 回复指示 */}
              <div className="mb-1.5 flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  {isLoggedIn ? (
                    <span className="text-[13px] font-medium text-wechat-nickname md:text-[14px]">
                      {currentUser!.nickname}
                    </span>
                  ) : currentUser && !editing ? (
                    <span className="text-[13px] font-medium text-wechat-nickname md:text-[14px]">
                      {currentUser.nickname}
                    </span>
                  ) : null}
                  {replyToName && (
                    <span className="ml-1 flex items-center gap-1 text-[13px] text-wechat-time">
                      <span>回复</span>
                      <span className="text-wechat-nickname">{replyToName}</span>
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {!isLoggedIn && currentUser && !editing && (
                    <button
                      type="button"
                      onClick={() => setEditing(true)}
                      className="text-[13px] text-wechat-time transition-colors hover:text-wechat-nickname"
                    >
                      修改信息
                    </button>
                  )}
                  {replyTo && (
                    <button
                      type="button"
                      onClick={cancelReply}
                      className="text-wechat-time transition-colors hover:text-wechat-text"
                      aria-label="取消回复"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* 灰色输入框 + 表情图标 */}
              <div ref={inputContainerRef} className="rounded-md bg-gray-100 dark:bg-[#232328]">
                <div className="relative">
                  <div
                    ref={editorRef}
                    contentEditable
                    suppressContentEditableWarning
                    data-empty="true"
                    data-placeholder={replyToName ? `回复 ${replyToName}...` : "写留言"}
                    onInput={syncContent}
                    onKeyUp={saveSelection}
                    onMouseUp={saveSelection}
                    onKeyDown={handleEditorKeyDown}
                    style={{ opacity: submitting ? 0.6 : 1 }}
                    className="comment-editor w-full resize-none rounded-md bg-transparent px-3 py-2.5 pr-8 text-[15px] leading-[23px] text-wechat-text focus:outline-none md:text-[16px]"
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
                    className={`absolute bottom-2 right-2 transition-colors ${showEmoji ? "text-[#07c160]" : "text-wechat-time hover:text-wechat-text"}`}
                    aria-label="表情"
                  >
                    <Smile className="h-5 w-5 md:h-[18px] md:w-[18px]" />
                  </button>
                </div>

                {/* 表情选择器 */}
                {showEmoji && (
                  <div className="border-t border-gray-200 px-2 py-2 animate-emoji-fade-in dark:border-white/5">
                    <div
                      className="grid grid-cols-8 gap-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                      style={{ maxHeight: emojiExpanded ? "220px" : "none" }}
                    >
                      {(emojiExpanded ? EMOJI_LIST : EMOJI_LIST.slice(0, 20)).map((emoji) => (
                        <button
                          key={emoji.file}
                          type="button"
                          onClick={() => insertEmoji(emoji.name)}
                          className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-white dark:hover:bg-white/10"
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
                          className="flex h-8 w-8 items-center justify-center rounded-md text-wechat-time transition-colors hover:bg-white dark:hover:bg-white/10"
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

              {/* 底部：字数 / 错误 / 发送按钮 */}
              <div className="mt-1.5 flex items-center justify-between px-1">
                <span className="text-[13px] text-wechat-time">
                  {error ? (
                    <span className="text-red-500 dark:text-red-400">{error}</span>
                  ) : content.length > 0 ? (
                    `${content.length} 字`
                  ) : (
                    <span className="hidden sm:inline">Ctrl + Enter 发送</span>
                  )}
                </span>
                {content.trim() && (
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-[4px] bg-[#07c160] px-4 py-1.5 text-[14px] font-medium text-white transition-colors hover:bg-[#06ad56] disabled:bg-gray-300 disabled:text-white"
                  >
                    {submitting ? "发送中" : "发送"}
                  </button>
                )}
              </div>
            </>
          )}
        </form>
      )}

      {/* 评论列表 — 线程化分组：顶级评论 + 可折叠回复 */}
      {commentCount > 0 ? (
        <div className="mt-4 space-y-4">
          {threads.map((thread, threadIndex) => {
            const parent = thread.parent;
            const replies = thread.replies;
            const isExpanded = expandedThreads.has(parent.id);
            const likeData = commentLikes[parent.id] || { likeCount: parent.likeCount || 0, meLiked: !!parent.meLiked };
            const isOrphan = !!parent.replyTo;

            return (
              <div key={parent.id} id={`comment-${parent.id}`} className="flex gap-3 scroll-mt-20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={cravatarUrl(parent.email || parent.author, 80)}
                  alt={parent.author}
                  className="h-10 w-10 shrink-0 rounded-lg object-cover"
                />
                <div className="min-w-0 flex-1">
                  {/* 昵称 + 作者 + 孤儿回复前缀 + 省份 + 时间 */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[14px] font-medium text-wechat-nickname md:text-[15px]">
                      {parent.author}
                    </span>
                    {parent.isAuthor && (
                      <span className="text-[12px] font-medium text-[#07c160]">作者</span>
                    )}
                    {isOrphan && (
                      <span className="text-[12px] text-wechat-time">
                        回复 <span className="text-wechat-nickname">@{parent.replyTo}</span>
                      </span>
                    )}
                    {parent.region && (
                      <span className="text-[12px] text-wechat-time md:text-[13px]">
                        {parent.region}
                      </span>
                    )}
                    <span className="text-[12px] text-wechat-time md:text-[13px]">
                      {formatRelativeTime(parent.createdAt)}
                    </span>
                  </div>
                  {/* 内容 + 回复/点赞 */}
                  <div className="mt-1 flex items-end justify-between gap-3">
                    <div
                      className="min-w-0 flex-1 text-[14px] leading-[1.6] text-wechat-text dark:text-gray-200 md:text-[15px]"
                      dangerouslySetInnerHTML={{ __html: renderTextWithEmoji(parent.content) }}
                    />
                    <div className="flex shrink-0 items-center gap-4 pb-0.5">
                      <button
                        type="button"
                        data-no-collapse
                        onClick={() => handleReply(parent)}
                        className="text-[12px] text-wechat-time transition-colors hover:text-wechat-nickname md:text-[13px]"
                      >
                        回复
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCommentLike(parent.id)}
                        className="flex items-center gap-1 text-[12px] transition-colors md:text-[13px]"
                        aria-label="点赞"
                      >
                        <ThumbsUp
                          className={`h-[15px] w-[15px] transition-colors md:h-[16px] md:w-[16px] ${
                            likeData.meLiked
                              ? "fill-current text-[#07c160]"
                              : "text-wechat-time hover:text-wechat-text"
                          }`}
                        />
                        {likeData.likeCount > 0 && (
                          <span className={likeData.meLiked ? "text-[#07c160]" : "text-wechat-time"}>
                            {likeData.likeCount}
                          </span>
                        )}
                      </button>
                    </div>
                  </div>
                  {/* 首评标签（仅第一条顶级评论） */}
                  {threadIndex === 0 && !isOrphan && (
                    <div className="mt-1 text-[12px] text-[#07c160]">首评</div>
                  )}
                  {/* 内联回复框 */}
                  {renderInlineReplyForm(parent)}
                  {/* N条回复 展开按钮（折叠时显示在顶部） */}
                  {replies.length > 0 && !isExpanded && (
                    <button
                      type="button"
                      data-no-collapse
                      onClick={() => toggleThread(parent.id)}
                      className="mt-2 flex items-center gap-1 text-[12px] text-[#576b95] transition-colors hover:text-[#07c160] dark:text-[#7d8db5]"
                    >
                      {replies.length}条回复
                      <ChevronDown className="h-3 w-3" />
                    </button>
                  )}
                  {/* 展开后的回复列表：带头像、无引用竖线 */}
                  {isExpanded && replies.length > 0 && (
                    <>
                      <div className="mt-2 space-y-3">
                        {replies.map((reply) => {
                          const replyLikeData = commentLikes[reply.id] || { likeCount: reply.likeCount || 0, meLiked: !!reply.meLiked };
                          // 直接回复顶级评论的：不显示"回复 @X"；回复其他回复的：显示
                          // 优先用 replyToId 精确比较，旧数据 fallback 到 author name 比较
                          const showReplyTo = reply.replyToId
                            ? reply.replyToId !== parent.id
                            : reply.replyTo !== parent.author;
                          return (
                            <div key={reply.id} id={`comment-${reply.id}`} className="flex gap-2 scroll-mt-20">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={cravatarUrl(reply.email || reply.author, 80)}
                                alt={reply.author}
                                className="h-8 w-8 shrink-0 rounded-md object-cover"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-1">
                                  <span className="text-[13px] font-medium text-wechat-nickname">
                                    {reply.author}
                                  </span>
                                  {reply.isAuthor && (
                                    <span className="text-[11px] font-medium text-[#07c160]">作者</span>
                                  )}
                                  {showReplyTo && (
                                    <span className="text-[12px] text-wechat-time">
                                      回复 <span className="text-wechat-nickname">@{reply.replyTo}</span>
                                    </span>
                                  )}
                                  {reply.region && (
                                    <span className="text-[11px] text-wechat-time">{reply.region}</span>
                                  )}
                                  <span className="text-[11px] text-wechat-time">
                                    {formatRelativeTime(reply.createdAt)}
                                  </span>
                                </div>
                                <div className="mt-0.5 flex items-end justify-between gap-2">
                                  <div
                                    className="min-w-0 flex-1 text-[13px] leading-[1.5] text-wechat-text dark:text-gray-200"
                                    dangerouslySetInnerHTML={{ __html: renderTextWithEmoji(reply.content) }}
                                  />
                                  <div className="flex shrink-0 items-center gap-3 pb-0.5">
                                    <button
                                      type="button"
                                      data-no-collapse
                                      onClick={() => handleReply(reply)}
                                      className="text-[11px] text-wechat-time transition-colors hover:text-wechat-nickname"
                                    >
                                      回复
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleCommentLike(reply.id)}
                                      className="flex items-center gap-1 text-[11px] transition-colors"
                                      aria-label="点赞"
                                    >
                                      <ThumbsUp
                                        className={`h-[14px] w-[14px] transition-colors ${
                                          replyLikeData.meLiked
                                            ? "fill-current text-[#07c160]"
                                            : "text-wechat-time hover:text-wechat-text"
                                        }`}
                                      />
                                      {replyLikeData.likeCount > 0 && (
                                        <span className={replyLikeData.meLiked ? "text-[#07c160]" : "text-wechat-time"}>
                                          {replyLikeData.likeCount}
                                        </span>
                                      )}
                                    </button>
                                  </div>
                                </div>
                                {renderInlineReplyForm(reply)}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {/* 收起按钮在最后一条回复下面 */}
                      <button
                        type="button"
                        data-no-collapse
                        onClick={() => toggleThread(parent.id)}
                        className="mt-2 flex items-center gap-1 text-[12px] text-[#576b95] transition-colors hover:text-[#07c160] dark:text-[#7d8db5]"
                      >
                        <ChevronUp className="h-3 w-3" />
                        收起
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-4 text-center text-[13px] text-wechat-time">还没有留言，快来抢沙发~</p>
      )}
    </div>
  );
}
