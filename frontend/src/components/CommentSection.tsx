"use client";

import Image from "next/image";
import { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react";
import { Comment } from "@/lib/mock-data";
import { cravatarUrl } from "@/lib/avatar";
import { getCurrentUser, CurrentUser } from "@/lib/auth";
import { X, Smile, ChevronDown, ChevronUp } from "lucide-react";
import { EMOJI_LIST, editableToShortcode } from "@/lib/emoji";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

interface CommentSectionProps {
  postId: string;
  initialComments: Comment[];
  initialReplyTo?: string;
  onReplyCleared?: () => void;
  onCommentAdded?: (comment: Comment) => void;
  /** 紧跟在 InteractionBubble 下方时为 true，去掉上边距和顶部圆角，视觉上合为一体 */
  connected?: boolean;
  /** 挂载时自动聚焦编辑器（详情页点击"评论"按钮后直接弹出手机键盘） */
  autoFocus?: boolean;
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

export default function CommentSection({
  postId,
  initialComments,
  initialReplyTo,
  onReplyCleared,
  onCommentAdded,
  connected = false,
  autoFocus = false,
}: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [content, setContent] = useState("");
  const [replyTo, setReplyTo] = useState<string | undefined>(initialReplyTo);
  // replyTo 存储父评论 ID；显示用名字需用 ID 查找
  const replyToName = replyTo
    ? initialComments.find((c) => c.id === replyTo)?.author
    : undefined;
  const [submitting, setSubmitting] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [emojiExpanded, setEmojiExpanded] = useState(false);
  // 仅用于网络/服务端失败的提示（输入校验交给浏览器原生 form 验证）
  const [error, setError] = useState("");

  // 当前用户（登录博主 / 游客 / null）
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [editing, setEditing] = useState(false);

  // 游客信息表单
  const [formNickname, setFormNickname] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formWebsite, setFormWebsite] = useState("");

  const editorRef = useRef<HTMLDivElement>(null);
  const savedRange = useRef<Range | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    setComments(initialComments);
  }, [initialComments]);

  // 同步外部传入的回复目标，并同步聚焦输入框（useLayoutEffect 保证在用户手势栈内）
  useLayoutEffect(() => {
    if (initialReplyTo) {
      setReplyTo(initialReplyTo);
      editorRef.current?.focus();
    }
  }, [initialReplyTo]);

  // 挂载时自动聚焦编辑器（详情页"评论"按钮触发：mount → focus 在用户手势栈内 → 手机弹键盘）
  useLayoutEffect(() => {
    if (autoFocus && !initialReplyTo) {
      editorRef.current?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const user = getCurrentUser();
    setCurrentUser(user);
    if (user && !user.isLoggedIn) {
      setFormNickname(user.nickname);
      setFormEmail(user.email);
      setFormWebsite(user.website);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // 从 contentEditable 直接获取最新内容（避免 React 状态延迟）
    const editor = editorRef.current;
    const text = editor ? editableToShortcode(editor).trim() : content.trim();
    if (!text || submitting) return;

    let authorName = "";
    let authorEmail = "";
    let authorWebsite = "";

    if (currentUser?.isLoggedIn) {
      // 博主直接用登录信息
      authorName = currentUser.nickname;
      authorEmail = currentUser.email;
    } else {
      // 游客：原生验证已确保昵称/邮箱有效
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

    // replyTo 现在存储的是父评论 ID，用 ID 精确查找父评论（避免同名歧义）
    let replyToEmail = "";
    let replyToAuthor = "";
    if (replyTo) {
      const parent = initialComments.find((c) => c.id === replyTo);
      if (parent) {
        replyToEmail = parent.email || "";
        replyToAuthor = parent.author;
      }
    }

    setError("");
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorName,
          email: authorEmail,
          website: authorWebsite || undefined,
          content: text,
          replyTo: replyToAuthor || undefined,
          replyToEmail: replyToEmail || undefined,
          replyToId: replyTo || undefined,
        }),
      });
      if (!res.ok) {
        // 429：触发限流；403：黑名单封禁；后端返回友好中文 message
        if (res.status === 429 || res.status === 403) {
          const data = await res.json().catch(() => ({ message: "" }));
          setError(data?.message || (res.status === 429 ? "评论太快了，请稍后再试" : "您已被限制评论"));
        } else {
          setError("发送失败，请重试");
        }
        return;
      }
      const newComment = await res.json();
      setComments((prev) => [...prev, newComment]);
      onCommentAdded?.(newComment);

      // 游客填写昵称后，更新其历史点赞的显示名（从"访客"变为昵称）
      if (!currentUser?.isLoggedIn && authorName && authorEmail) {
        try {
          await fetch(`${API_URL}/posts/likes/update-name`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            credentials: "include", // 携带 visitorId cookie 用于维度升级
            body: JSON.stringify({ email: authorEmail, newName: authorName }),
          });
        } catch {
          // 非关键操作，失败不影响评论
        }
      }

      if (editorRef.current) {
        editorRef.current.innerHTML = "";
        editorRef.current.setAttribute("data-empty", "true");
      }
      setContent("");
      setReplyTo(undefined);
      onReplyCleared?.();
    } catch {
      setError("发送失败，请重试");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveInfo = () => {
    // 触发浏览器原生验证：不通过会弹出系统提示气泡，不执行后续逻辑
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
    onReplyCleared?.();
  };

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
    // 修复：内容为空时清空残留节点（<br>、空文本节点等），
    // 避免 :before 占位符显示后光标停留在占位符后面
    if (isEmpty && editor.innerHTML !== "") {
      editor.innerHTML = "";
      // 清空后重置光标到 editor 开头（:before 占位符之前）
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(true); // 折叠到开头
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      // 同步清空 savedRange，下次插入表情时会自动定位到末尾
      savedRange.current = null;
    }
  }, []);

  const insertEmoji = (name: string) => {
    const item = EMOJI_LIST.find((e) => e.name === name);
    if (!item) return;
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    // 没有保存选区时，将光标移到末尾
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
    // 保存新光标位置，支持连续插入
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
    }
  };

  const isLoggedIn = currentUser?.isLoggedIn;
  // 博主：永远不显示信息表单
  // 游客：未保存信息 或 正在编辑 时显示
  const showInfoForm = !isLoggedIn && (!currentUser || editing);

  return (
    <div className={`bg-wechat-bubble p-2 ${connected ? "mt-0 rounded-b-lg rounded-t-none pt-0" : "mt-2 rounded-lg"}`}>
      {/* Identity bar + reply indicator row */}
      <div className="mb-1.5 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          {isLoggedIn ? (
            <>
              <div className="relative h-5 w-5 shrink-0 overflow-hidden rounded-[3px] md:h-6 md:w-6">
                <Image
                  src={cravatarUrl(currentUser!.email, 40)}
                  alt={currentUser!.nickname}
                  fill
                  className="object-cover"
                  sizes="20px"
                  unoptimized
                />
              </div>
              <span className="text-[13px] font-medium text-wechat-nickname md:text-[14px]">
                {currentUser!.nickname}
              </span>
            </>
          ) : currentUser && !editing ? (
            <>
              <div className="relative h-5 w-5 shrink-0 overflow-hidden rounded-[3px] md:h-6 md:w-6">
                <Image
                  src={cravatarUrl(currentUser.email, 40)}
                  alt={currentUser.nickname}
                  fill
                  className="object-cover"
                  sizes="20px"
                  unoptimized
                />
              </div>
              <span className="text-[13px] font-medium text-wechat-nickname md:text-[14px]">
                {currentUser.nickname}
              </span>
            </>
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

      {/* 表单容器：用原生 form 触发浏览器系统级校验提示（required / type=email） */}
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className="mt-1.5 rounded-[4px] p-0.5"
      >
      {/* 游客信息表单 — 紧凑折叠式 */}
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
            className="min-w-0 rounded-[4px] bg-wechat-white px-2.5 py-2 text-[13px] text-wechat-text placeholder:text-wechat-time focus:outline-none dark:bg-white/[0.06] dark:focus:bg-white/[0.08]"
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
            className="min-w-0 rounded-[4px] bg-wechat-white px-2.5 py-2 text-[13px] text-wechat-text placeholder:text-wechat-time focus:outline-none dark:bg-white/[0.06] dark:focus:bg-white/[0.08]"
          />
          <input
            type="text"
            value={formWebsite}
            onChange={(e) => setFormWebsite(e.target.value)}
            placeholder="网站 (选填)"
            className="min-w-0 rounded-[4px] bg-wechat-white px-2.5 py-2 text-[13px] text-wechat-text placeholder:text-wechat-time focus:outline-none dark:bg-white/[0.06] dark:focus:bg-white/[0.08]"
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

      {/* 评论输入框 + 内联表情列表合为一个容器：白色背景 + 无重边框（嵌入式） */}
      <div className="rounded-md bg-wechat-white dark:bg-[#232328]">
        {/* contentEditable 输入区 */}
        <div className="relative">
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            autoFocus
            data-empty="true"
            data-placeholder={replyToName ? `回复 ${replyToName}...` : "评论..."}
            onInput={syncContent}
            onKeyUp={saveSelection}
            onMouseUp={saveSelection}
            onKeyDown={handleEditorKeyDown}
            style={{ opacity: submitting ? 0.6 : 1 }}
            className="comment-editor w-full resize-none rounded-md bg-transparent px-3 py-2.5 pr-8 text-[15px] leading-[23px] text-wechat-text focus:outline-none md:text-[16px]"
          />
          {/* 表情图标在输入框内右下角 */}
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
            <Smile className="h-4 w-4 md:h-[18px] md:w-[18px]" />
          </button>
        </div>

        {/* 内联表情列表：贴合输入框下方（同一容器内），展开时固定高度内部滚动 */}
        {showEmoji && (
          <div className="border-t border-wechat-divider px-2 py-2 animate-emoji-fade-in dark:border-white/5">
            <div
              className="grid grid-cols-8 gap-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
              style={{ maxHeight: emojiExpanded ? "220px" : "none" }}
            >
              {(emojiExpanded ? EMOJI_LIST : EMOJI_LIST.slice(0, 20)).map((emoji) => (
                <button
                  key={emoji.file}
                  type="button"
                  onClick={() => insertEmoji(emoji.name)}
                  className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-wechat-hover dark:hover:bg-white/10"
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
              {/* 展开/收起图标作为网格最后一个 cell，只显示图标 */}
              {EMOJI_LIST.length > 20 && (
                <button
                  type="button"
                  onClick={() => setEmojiExpanded((v) => !v)}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-wechat-time transition-colors hover:bg-wechat-hover dark:hover:bg-white/10"
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

      {/* Footer */}
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
      </form>
    </div>
  );
}
