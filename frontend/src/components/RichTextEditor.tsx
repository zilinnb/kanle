"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Link as LinkIcon,
  Eraser,
  Undo2,
  Redo2,
  Loader2,
  ExternalLink,
  LayoutTemplate,
  Smile,
} from "lucide-react";
import { sanitizeHtml } from "@/lib/sanitize";
import { EMOJI_LIST } from "@/lib/emoji";
import EmojiPicker from "./EmojiPicker";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  /** 链接卡片回调：传入 URL，由父组件获取预览并展示卡片 */
  onLinkCard?: (url: string) => void;
  /** 链接卡片加载中状态 */
  linkCardLoading?: boolean;
  /** 已有链接卡片时禁用链接按钮 */
  hasLinkCard?: boolean;
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = "这一刻的想法...",
  minHeight = 180,
  onLinkCard,
  linkCardLoading = false,
  hasLinkCard = false,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const savedRange = useRef<Range | null>(null);
  const [active, setActive] = useState<Record<string, boolean>>({});
  const [showLink, setShowLink] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [mounted, setMounted] = useState(false);

  const updateEmpty = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const hasText = (el.textContent || "").trim() !== "";
    const hasImg = el.querySelectorAll("img").length > 0;
    const isEmpty = !hasText && !hasImg;
    el.setAttribute("data-empty", isEmpty ? "true" : "false");
  }, []);

  useEffect(() => {
    setMounted(true);
    if (editorRef.current && value && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
    updateEmpty();
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

  const exec = useCallback((cmd: string, val?: string) => {
    editorRef.current?.focus();
    restoreSelection();
    try {
      document.execCommand(cmd, false, val);
    } catch {
      // ignore
    }
    refreshActive();
    emitChange();
  }, [restoreSelection]);

  const submitLinkCard = useCallback(() => {
    const url = linkUrl.trim();
    if (!url || !onLinkCard || hasLinkCard || linkCardLoading) return;
    const finalUrl = url.startsWith("http") ? url : `https://${url}`;
    onLinkCard(finalUrl);
    setShowLink(false);
    setLinkUrl("");
  }, [linkUrl, onLinkCard, hasLinkCard, linkCardLoading]);

  const insertHyperlink = useCallback(() => {
    const url = linkUrl.trim();
    if (!url) return;
    const finalUrl = url.startsWith("http") ? url : `https://${url}`;
    editorRef.current?.focus();
    restoreSelection();

    const sel = window.getSelection();
    const selectedText = sel?.toString().trim() || "";

    if (selectedText) {
      document.execCommand("createLink", false, finalUrl);
      const links = editorRef.current?.querySelectorAll(`a[href="${finalUrl}"]`);
      links?.forEach((a) => {
        a.setAttribute("target", "_blank");
        a.setAttribute("rel", "noopener noreferrer");
      });
    } else {
      const escaped = finalUrl.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      document.execCommand("insertHTML", false, `<a href="${finalUrl}" target="_blank" rel="noopener noreferrer">${escaped}</a>`);
    }

    refreshActive();
    emitChange();
    setShowLink(false);
    setLinkUrl("");
  }, [linkUrl, restoreSelection]);

  const clearFormat = useCallback(() => {
    editorRef.current?.focus();
    restoreSelection();
    try {
      document.execCommand("removeFormat");
      document.execCommand("formatBlock", false, "<p>");
    } catch {}
    refreshActive();
    emitChange();
  }, [restoreSelection]);

  const emitChange = useCallback(() => {
    if (!editorRef.current) return;
    onChange(editorRef.current.innerHTML);
  }, [onChange]);

  const refreshActive = useCallback(() => {
    if (typeof document === "undefined") return;
    const next: Record<string, boolean> = {};
    try {
      next.bold = document.queryCommandState("bold");
      next.italic = document.queryCommandState("italic");
      next.underline = document.queryCommandState("underline");
      next.strikeThrough = document.queryCommandState("strikeThrough");
    } catch {
      // ignore
    }
    setActive(next);
  }, []);

  const handleInput = useCallback(() => {
    refreshActive();
    updateEmpty();
    emitChange();
  }, [refreshActive, updateEmpty, emitChange]);

  const preventBlur = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  const openLinkPanel = useCallback(() => {
    saveSelection();
    setShowLink(!showLink);
  }, [saveSelection, showLink]);

  useEffect(() => {
    if (!showLink) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-popover]") || target.closest("[data-popover-trigger]")) return;
      setShowLink(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [showLink]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const html = e.clipboardData.getData("text/html");
    const text = e.clipboardData.getData("text/plain");
    if (html) {
      const cleaned = sanitizeHtml(html);
      try { document.execCommand("insertHTML", false, cleaned); } catch {}
    } else if (text) {
      try { document.execCommand("insertText", false, text); } catch {}
    }
    updateEmpty();
    emitChange();
  }, [updateEmpty, emitChange]);

  const handleLinkKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      insertHyperlink();
    }
  }, [insertHyperlink]);

  const insertEmoji = useCallback((name: string) => {
    const item = EMOJI_LIST.find((e) => e.name === name);
    if (!item) return;
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    // 没有保存选区时，将光标移到编辑器末尾
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
    refreshActive();
    updateEmpty();
    emitChange();
    setShowEmoji(false);
  }, [restoreSelection, refreshActive, updateEmpty, emitChange]);

  interface ToolBtn {
    key: string;
    title: string;
    icon: React.ReactNode;
    onClick: () => void;
    active?: boolean;
    disabled?: boolean;
  }

  const groupUndo: ToolBtn[] = [
    { key: "undo", title: "撤销", icon: <Undo2 className="h-4 w-4" />, onClick: () => exec("undo") },
    { key: "redo", title: "重做", icon: <Redo2 className="h-4 w-4" />, onClick: () => exec("redo") },
  ];

  const groupFormat: ToolBtn[] = [
    { key: "bold", title: "加粗", icon: <Bold className="h-4 w-4" />, onClick: () => exec("bold"), active: active.bold },
    { key: "italic", title: "斜体", icon: <Italic className="h-4 w-4" />, onClick: () => exec("italic"), active: active.italic },
    { key: "underline", title: "下划线", icon: <Underline className="h-4 w-4" />, onClick: () => exec("underline"), active: active.underline },
    { key: "strike", title: "删除线", icon: <Strikethrough className="h-4 w-4" />, onClick: () => exec("strikeThrough"), active: active.strikeThrough },
  ];

  const renderBtn = (btn: ToolBtn) => (
    <button
      key={btn.key}
      type="button"
      title={btn.title}
      onMouseDown={preventBlur}
      onClick={btn.onClick}
      disabled={btn.disabled}
      className={`flex h-8 w-8 items-center justify-center rounded transition-colors ${
        btn.disabled
          ? "cursor-not-allowed text-wechat-time/40 dark:text-gray-600"
          : btn.active
          ? "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400"
          : "text-wechat-text hover:bg-wechat-hover dark:text-gray-200 dark:hover:bg-white/10"
      }`}
    >
      {btn.icon}
    </button>
  );

  return (
    <div className="rich-editor rounded-xl border border-wechat-border bg-wechat-white dark:border-white/10 dark:bg-[#232328]">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 border-b border-wechat-border bg-wechat-white px-2 py-1.5 dark:border-white/10 dark:bg-[#232328]">
        {/* 撤销 / 重做 */}
        <div className="flex items-center gap-0.5">{groupUndo.map(renderBtn)}</div>
        <Divider />
        {/* 加粗 / 斜体 / 下划线 / 删除线 */}
        <div className="flex items-center gap-0.5">{groupFormat.map(renderBtn)}</div>
        <Divider />
        {/* 链接：超链接 / 链接卡片 */}
        <div className="relative">
          <button
            type="button"
            title="插入链接"
            data-popover-trigger
            onMouseDown={preventBlur}
            onClick={openLinkPanel}
            className="flex h-8 w-8 items-center justify-center rounded text-wechat-text transition-colors hover:bg-wechat-hover dark:text-gray-200 dark:hover:bg-white/10"
          >
            {linkCardLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LinkIcon className="h-4 w-4" />
            )}
          </button>
          {showLink && mounted && (
            <div data-popover className="fixed left-1/2 top-20 z-[200] w-72 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-lg border border-wechat-border bg-wechat-white p-3 shadow-lg dark:border-white/10 dark:bg-[#2a2a30] sm:absolute sm:left-0 sm:top-9 sm:z-30 sm:translate-x-0">
              <input
                type="text"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={handleLinkKeyDown}
                placeholder="粘贴链接 https://"
                autoFocus
                className="w-full rounded-md border border-wechat-border bg-wechat-bubble px-2.5 py-1.5 text-sm text-wechat-text placeholder:text-wechat-time focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-gray-200"
              />
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onMouseDown={preventBlur}
                  onClick={insertHyperlink}
                  disabled={!linkUrl.trim()}
                  className="flex flex-1 items-center justify-center gap-1 rounded-md py-1.5 text-sm font-medium transition-colors disabled:bg-wechat-bubble disabled:text-wechat-time enabled:bg-green-500 enabled:text-white enabled:hover:bg-green-600 dark:disabled:bg-white/5 dark:disabled:text-gray-500"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  超链接
                </button>
                {onLinkCard && (
                  <button
                    type="button"
                    onMouseDown={preventBlur}
                    onClick={submitLinkCard}
                    disabled={!linkUrl.trim() || hasLinkCard || linkCardLoading}
                    title={hasLinkCard ? "已有链接卡片" : undefined}
                    className="flex flex-1 items-center justify-center gap-1 rounded-md border border-wechat-border py-1.5 text-sm font-medium text-wechat-text transition-colors hover:bg-wechat-hover disabled:cursor-not-allowed disabled:text-wechat-time/40 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/10 dark:disabled:text-gray-600"
                  >
                    {linkCardLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <LayoutTemplate className="h-3.5 w-3.5" />
                    )}
                    {hasLinkCard ? "已有卡片" : "链接卡片"}
                  </button>
                )}
              </div>
              {onLinkCard && !hasLinkCard && (
                <p className="mt-2 text-[11px] leading-tight text-wechat-time">
                  超链接插入正文；链接卡片展示在正文下方
                </p>
              )}
            </div>
          )}
        </div>
        <Divider />
        {/* 表情 */}
        <div className="relative">
          <button
            type="button"
            title="表情"
            onMouseDown={preventBlur}
            onClick={() => setShowEmoji((v) => !v)}
            className="flex h-8 w-8 items-center justify-center rounded text-wechat-text transition-colors hover:bg-wechat-hover dark:text-gray-200 dark:hover:bg-white/10"
          >
            <Smile className="h-4 w-4" />
          </button>
          {showEmoji && (
            <EmojiPicker onSelect={insertEmoji} onClose={() => setShowEmoji(false)} />
          )}
        </div>
        {/* 清除格式 */}
        <button
          type="button"
          title="清除格式"
          onMouseDown={preventBlur}
          onClick={clearFormat}
          className="flex h-8 w-8 items-center justify-center rounded text-wechat-text transition-colors hover:bg-wechat-hover dark:text-gray-200 dark:hover:bg-white/10"
        >
          <Eraser className="h-4 w-4" />
        </button>
      </div>

      {/* Editable area */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyUp={refreshActive}
        onMouseUp={refreshActive}
        onPaste={handlePaste}
        data-placeholder={placeholder}
        data-empty="true"
        className="rich-editor-area relative w-full max-h-[40vh] overflow-y-auto px-4 py-3 text-[15px] leading-6 text-wechat-text focus:outline-none dark:text-gray-200"
        style={{ minHeight }}
      />
    </div>
  );
}

function Divider() {
  return <span className="mx-1 h-5 w-px bg-wechat-border dark:bg-white/10" />;
}
