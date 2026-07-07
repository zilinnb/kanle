"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List as ListIcon,
  ListOrdered,
  Link as LinkIcon,
  Image as ImageIcon,
  Code,
  Quote,
  Undo2,
  Redo2,
  Minus,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Loader2,
  ChevronDown,
  FileCode2,
  FileDown,
  X,
  Music,
  Video,
  LayoutTemplate,
  Smile,
} from "lucide-react";
import { sanitizeHtml } from "@/lib/sanitize";
import { markdownToHtml } from "@/lib/markdown";
import { uploadImage, toAbsoluteUrl } from "@/lib/upload";
import { EMOJI_LIST } from "@/lib/emoji";
import EmojiPicker from "./EmojiPicker";
import LinkCardPanel from "./admin/LinkCardPanel";
import MusicPanel from "./admin/MusicPanel";
import VideoPanel from "./admin/VideoPanel";
import type { LinkCard, PostMusic, PostVideo } from "@/lib/mock-data";
import { useExitAnimation } from "@/lib/use-exit-animation";

interface ArticleEditorProps {
  value: string;
  onChange: (html: string) => void;
  token: string;
  placeholder?: string;
}

const PARAGRAPH_STYLES = [
  { label: "正文", tag: "p" },
  { label: "标题1", tag: "h1" },
  { label: "标题2", tag: "h2" },
  { label: "标题3", tag: "h3" },
  { label: "引用", tag: "blockquote" },
];

export default function ArticleEditor({
  value,
  onChange,
  token,
  placeholder = "开始写作...",
}: ArticleEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const savedRange = useRef<Range | null>(null);
  const [active, setActive] = useState<Record<string, boolean>>({});
  const [currentBlock, setCurrentBlock] = useState("p");
  const [mounted, setMounted] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [showParaMenu, setShowParaMenu] = useState(false);
  const [sourceMode, setSourceMode] = useState(false);
  const [showMdImport, setShowMdImport] = useState(false);
  const [mdText, setMdText] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [showLinkCardPanel, setShowLinkCardPanel] = useState(false);
  const [showMusicPanel, setShowMusicPanel] = useState(false);
  const [showVideoPanel, setShowVideoPanel] = useState(false);
  const [editingMusic, setEditingMusic] = useState<PostMusic | null>(null);
  const editingEmbedRef = useRef<HTMLElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const linkBtnRef = useRef<HTMLButtonElement | null>(null);
  const [linkPos, setLinkPos] = useState<{ top: number; left: number } | null>(null);

  // Markdown 导入弹窗退出动画
  const { closing: mdClosing, handleClose: handleMdClose } = useExitAnimation(() => {
    setShowMdImport(false);
    setMdText("");
  }, 220);

  // 链接小弹窗退出动画
  const { closing: linkClosing, handleClose: handleLinkClose } = useExitAnimation(() => {
    setShowLink(false);
    setLinkUrl("");
  }, 160);

  // 链接弹窗显示时，计算按钮位置（用 fixed 定位脱离 overflow-hidden 容器）
  useEffect(() => {
    if (!showLink || !linkBtnRef.current) return;
    const rect = linkBtnRef.current.getBoundingClientRect();
    const POPUP_WIDTH = 288; // w-72
    const GAP = 4;
    // 水平：优先左对齐按钮，若右侧溢出视口则右对齐
    let left = rect.left;
    if (left + POPUP_WIDTH > window.innerWidth - 8) {
      left = Math.max(8, rect.right - POPUP_WIDTH);
    }
    setLinkPos({ top: rect.bottom + GAP, left });
  }, [showLink]);

  // 表情面板退出动画
  const { closing: emojiClosing, handleClose: handleEmojiClose } = useExitAnimation(() => {
    setShowEmoji(false);
  }, 160);

  // 初始化：设置 innerHTML
  useEffect(() => {
    setMounted(true);
    if (editorRef.current && value) {
      editorRef.current.innerHTML = value;
      enhanceEmbeds(editorRef.current, handleEditMusic);
    }
    refreshActive();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 卸载时清理 rAF
  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // 源码模式切换时同步内容
  useEffect(() => {
    if (!sourceMode && editorRef.current && value) {
      // 从源码模式切回富文本：用最新 value 更新 DOM
      if (editorRef.current.innerHTML !== value) {
        editorRef.current.innerHTML = value;
      }
      enhanceEmbeds(editorRef.current, handleEditMusic);
    }
  }, [sourceMode]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const emitChange = useCallback(() => {
    if (!editorRef.current) return;
    onChange(stripEditorOnly(editorRef.current.innerHTML));
  }, [onChange]);

  // 编辑音乐嵌入的回调（稳定引用，供 enhanceEmbeds 使用）
  const handleEditMusic = useCallback((el: HTMLElement, music: PostMusic) => {
    editingEmbedRef.current = el;
    setEditingMusic(music);
    setShowMusicPanel(true);
  }, []);

  // 重新增强嵌入块（带编辑回调）
  const reEnhanceEmbeds = useCallback(() => {
    if (editorRef.current) enhanceEmbeds(editorRef.current, handleEditMusic);
  }, [handleEditMusic]);

  const refreshActive = useCallback(() => {
    if (typeof document === "undefined") return;
    const next: Record<string, boolean> = {};
    try {
      next.bold = document.queryCommandState("bold");
      next.italic = document.queryCommandState("italic");
      next.underline = document.queryCommandState("underline");
      next.strikeThrough = document.queryCommandState("strikeThrough");
      next.insertUnorderedList = document.queryCommandState("insertUnorderedList");
      next.insertOrderedList = document.queryCommandState("insertOrderedList");
      next.justifyLeft = document.queryCommandState("justifyLeft");
      next.justifyCenter = document.queryCommandState("justifyCenter");
      next.justifyRight = document.queryCommandState("justifyRight");
      const block = document.queryCommandValue("formatBlock");
      if (block) {
        setCurrentBlock(block.toLowerCase().replace(/[<>]/g, ""));
      } else {
        setCurrentBlock("p");
      }
    } catch {
      // ignore
    }
    setActive(next);
  }, []);

  const exec = useCallback(
    (cmd: string, val?: string) => {
      if (sourceMode) return;
      editorRef.current?.focus();
      restoreSelection();
      try {
        document.execCommand(cmd, false, val);
      } catch {
        // ignore
      }
      refreshActive();
      emitChange();
    },
    [restoreSelection, refreshActive, emitChange, sourceMode]
  );

  const formatBlock = useCallback(
    (tag: string) => {
      if (sourceMode) return;
      editorRef.current?.focus();
      restoreSelection();
      try {
        document.execCommand("formatBlock", false, `<${tag}>`);
      } catch {
        // ignore
      }
      refreshActive();
      emitChange();
      setShowParaMenu(false);
    },
    [restoreSelection, refreshActive, emitChange, sourceMode]
  );

  const insertHtml = useCallback(
    (html: string) => {
      if (sourceMode) return;
      editorRef.current?.focus();
      restoreSelection();
      try {
        document.execCommand("insertHTML", false, html);
      } catch {
        // ignore
      }
      if (editorRef.current) enhanceEmbeds(editorRef.current, handleEditMusic);
      refreshActive();
      emitChange();
    },
    [restoreSelection, refreshActive, emitChange, sourceMode, handleEditMusic]
  );

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
      document.execCommand(
        "insertHTML",
        false,
        `<a href="${finalUrl}" target="_blank" rel="noopener noreferrer">${escaped}</a>`
      );
    }
    refreshActive();
    emitChange();
    handleLinkClose();
  }, [linkUrl, restoreSelection, refreshActive, emitChange, handleLinkClose]);

  const handleImageUpload = useCallback(
    async (file: File) => {
      if (!token) return;
      setUploading(true);
      try {
        const url = await uploadImage(file, token);
        insertHtml(
          `<img src="${url}" alt="" style="max-width:100%;border-radius:8px;margin:8px 0;" />`
        );
      } catch (err) {
        alert(err instanceof Error ? err.message : "图片上传失败");
      } finally {
        setUploading(false);
      }
    },
    [token, insertHtml]
  );

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleImageUpload(file);
      }
      e.target.value = "";
    },
    [handleImageUpload]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      if (sourceMode) return;
      e.preventDefault();
      const html = e.clipboardData.getData("text/html");
      const text = e.clipboardData.getData("text/plain");
      if (html) {
        const cleaned = sanitizeHtml(html);
        try {
          document.execCommand("insertHTML", false, cleaned);
        } catch {
          // ignore
        }
      } else if (text) {
        try {
          document.execCommand("insertText", false, text);
        } catch {
          // ignore
        }
      }
      if (editorRef.current) enhanceEmbeds(editorRef.current, handleEditMusic);
      refreshActive();
      emitChange();
    },
    [sourceMode, refreshActive, emitChange, handleEditMusic]
  );

  // rAF 句柄：延迟 refreshActive，避免每次输入都同步执行多次 queryCommandState
  const rafRef = useRef<number | null>(null);

  const handleInput = useCallback(() => {
    emitChange();
    // 工具栏状态更新延迟到下一帧，让浏览器先渲染输入的字符
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      refreshActive();
      rafRef.current = null;
    });
  }, [refreshActive, emitChange]);

  const preventBlur = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  const handleMdImport = useCallback(() => {
    const html = markdownToHtml(mdText);
    if (editorRef.current) {
      // 替换整个编辑器内容
      editorRef.current.innerHTML = html;
      enhanceEmbeds(editorRef.current, handleEditMusic);
      emitChange();
    }
    handleMdClose();
  }, [mdText, emitChange, handleMdClose, handleEditMusic]);

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
    emitChange();
    setShowEmoji(false);
  }, [restoreSelection, refreshActive, emitChange]);

  // 源码模式：更新 textarea 时同步到 onChange
  const handleSourceChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value);
    },
    [onChange]
  );

  interface ToolBtn {
    key: string;
    title: string;
    icon: React.ReactNode;
    onClick: () => void;
    active?: boolean;
    disabled?: boolean;
  }

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
          ? "cursor-not-allowed text-gray-300 dark:text-gray-600"
          : btn.active
          ? "bg-gray-200 text-gray-900 dark:bg-white/15 dark:text-white"
          : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10"
      }`}
    >
      {btn.icon}
    </button>
  );

  const currentStyleLabel =
    PARAGRAPH_STYLES.find((s) => s.tag === currentBlock)?.label || "正文";

  return (
    <div className="article-editor overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/10 dark:bg-[#1e1e22]">
      {/* Toolbar */}
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 border-b border-gray-200 bg-gray-50/95 px-2 py-1.5 backdrop-blur dark:border-white/10 dark:bg-[#26262b]/95">
        {/* 段落样式下拉 */}
        <div className="relative">
          <button
            type="button"
            onMouseDown={preventBlur}
            onClick={() => setShowParaMenu((v) => !v)}
            className="flex h-8 items-center gap-1 rounded px-2 text-sm text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10"
          >
            <span className="min-w-[3rem] text-left">{currentStyleLabel}</span>
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          {showParaMenu && (
            <div className="absolute left-0 top-9 z-30 w-28 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-white/10 dark:bg-[#2a2a30]">
              {PARAGRAPH_STYLES.map((style) => (
                <button
                  key={style.tag}
                  type="button"
                  onMouseDown={preventBlur}
                  onClick={() => formatBlock(style.tag)}
                  className={`block w-full px-3 py-1.5 text-left text-sm transition-colors hover:bg-gray-100 dark:hover:bg-white/10 ${
                    style.tag === "h1"
                      ? "text-lg font-bold"
                      : style.tag === "h2"
                      ? "text-base font-bold"
                      : style.tag === "h3"
                      ? "text-sm font-bold"
                      : style.tag === "blockquote"
                      ? "border-l-2 pl-2 italic text-gray-500"
                      : ""
                  } ${currentBlock === style.tag ? "text-gray-900 dark:text-white font-semibold" : "text-gray-700 dark:text-gray-200"}`}
                >
                  {style.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <Divider />

        {/* 撤销/重做 */}
        <div className="flex items-center gap-0.5">
          {renderBtn({ key: "undo", title: "撤销", icon: <Undo2 className="h-4 w-4" />, onClick: () => exec("undo") })}
          {renderBtn({ key: "redo", title: "重做", icon: <Redo2 className="h-4 w-4" />, onClick: () => exec("redo") })}
        </div>

        <Divider />

        {/* 加粗/斜体/下划线/删除线 */}
        <div className="flex items-center gap-0.5">
          {renderBtn({ key: "bold", title: "加粗", icon: <Bold className="h-4 w-4" />, onClick: () => exec("bold"), active: active.bold })}
          {renderBtn({ key: "italic", title: "斜体", icon: <Italic className="h-4 w-4" />, onClick: () => exec("italic"), active: active.italic })}
          {renderBtn({ key: "underline", title: "下划线", icon: <Underline className="h-4 w-4" />, onClick: () => exec("underline"), active: active.underline })}
          {renderBtn({ key: "strike", title: "删除线", icon: <Strikethrough className="h-4 w-4" />, onClick: () => exec("strikeThrough"), active: active.strikeThrough })}
        </div>

        <Divider />

        {/* 列表 */}
        <div className="flex items-center gap-0.5">
          {renderBtn({ key: "ul", title: "无序列表", icon: <ListIcon className="h-4 w-4" />, onClick: () => exec("insertUnorderedList"), active: active.insertUnorderedList })}
          {renderBtn({ key: "ol", title: "有序列表", icon: <ListOrdered className="h-4 w-4" />, onClick: () => exec("insertOrderedList"), active: active.insertOrderedList })}
        </div>

        <Divider />

        {/* 对齐 */}
        <div className="flex items-center gap-0.5">
          {renderBtn({ key: "left", title: "左对齐", icon: <AlignLeft className="h-4 w-4" />, onClick: () => exec("justifyLeft"), active: active.justifyLeft })}
          {renderBtn({ key: "center", title: "居中", icon: <AlignCenter className="h-4 w-4" />, onClick: () => exec("justifyCenter"), active: active.justifyCenter })}
          {renderBtn({ key: "right", title: "右对齐", icon: <AlignRight className="h-4 w-4" />, onClick: () => exec("justifyRight"), active: active.justifyRight })}
        </div>

        <Divider />

        {/* 引用 */}
        {renderBtn({ key: "quote", title: "引用", icon: <Quote className="h-4 w-4" />, onClick: () => formatBlock("blockquote"), active: currentBlock === "blockquote" })}

        {/* 代码块 */}
        {renderBtn({ key: "code", title: "代码块", icon: <Code className="h-4 w-4" />, onClick: () => formatBlock("pre") })}

        {/* 分隔线 */}
        {renderBtn({ key: "hr", title: "分隔线", icon: <Minus className="h-4 w-4" />, onClick: () => insertHtml("<hr/>") })}

        <Divider />

        {/* 链接 + 链接卡片 + 表情 + 图片（一组：插入内容） */}
        <div className="flex items-center gap-0.5">
          {/* 插入链接 */}
          <div className="relative">
            <button
              ref={linkBtnRef}
              type="button"
              title="插入链接"
              onMouseDown={preventBlur}
              onClick={() => { saveSelection(); setShowLink((v) => !v); setShowEmoji(false); }}
              className="flex h-8 w-8 items-center justify-center rounded text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10"
            >
              <LinkIcon className="h-4 w-4" />
            </button>
            {(showLink || linkClosing) && linkPos && typeof document !== "undefined" && createPortal(
              <div
                data-popover
                style={{ top: linkPos.top, left: linkPos.left }}
                className={`fixed z-[200] w-72 max-w-[calc(100vw-1rem)] rounded-lg border border-gray-200 bg-white p-3 shadow-lg dark:border-white/10 dark:bg-[#2a2a30] ${
                  linkClosing ? "animate-emoji-fade-out" : "animate-emoji-fade-in"
                }`}
              >
                <input
                  type="text"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); insertHyperlink(); } }}
                  placeholder="粘贴链接 https://"
                  autoFocus
                  className="w-full rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-gray-200"
                />
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onMouseDown={preventBlur}
                    onClick={insertHyperlink}
                    disabled={!linkUrl.trim()}
                    className="flex flex-1 items-center justify-center rounded-md bg-gray-900 py-1.5 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200 dark:disabled:bg-white/5 dark:disabled:text-gray-600"
                  >
                    插入链接
                  </button>
                </div>
              </div>,
              document.body
            )}
          </div>

          {/* 链接卡片 */}
          {renderBtn({ key: "linkCard", title: "插入链接卡片", icon: <LayoutTemplate className="h-4 w-4" />, onClick: () => { saveSelection(); setShowLinkCardPanel(true); setShowLink(false); setShowEmoji(false); }, disabled: sourceMode })}

          {/* 表情 */}
          <div className="relative">
            {renderBtn({ key: "emoji", title: "插入表情", icon: <Smile className="h-4 w-4" />, onClick: () => { saveSelection(); setShowEmoji((v) => !v); setShowLink(false); } })}
            {(showEmoji || emojiClosing) && (
              <EmojiPicker onSelect={insertEmoji} onClose={handleEmojiClose} />
            )}
          </div>

          {/* 图片上传 */}
          <button
            type="button"
            title="插入图片"
            onMouseDown={preventBlur}
            onClick={() => { fileInputRef.current?.click(); setShowLink(false); setShowEmoji(false); }}
            disabled={uploading || sourceMode}
            className="flex h-8 w-8 items-center justify-center rounded text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-300 dark:text-gray-300 dark:hover:bg-white/10 dark:disabled:text-gray-600"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            onChange={onFileChange}
            className="hidden"
          />
        </div>

        <Divider />

        {/* 音乐 / 视频（一组：媒体） */}
        <div className="flex items-center gap-0.5">
          {renderBtn({ key: "music", title: "添加音乐", icon: <Music className="h-4 w-4" />, onClick: () => { saveSelection(); setShowMusicPanel(true); setShowLink(false); setShowEmoji(false); }, disabled: sourceMode })}
          {renderBtn({ key: "video", title: "插入视频", icon: <Video className="h-4 w-4" />, onClick: () => { saveSelection(); setShowVideoPanel(true); setShowLink(false); setShowEmoji(false); }, disabled: sourceMode })}
        </div>

        <Divider />

        {/* 源码模式 */}
        {renderBtn({
          key: "source",
          title: sourceMode ? "退出源码模式" : "源码模式",
          icon: <FileCode2 className="h-4 w-4" />,
          onClick: () => { setSourceMode((v) => !v); setShowLink(false); setShowParaMenu(false); },
          active: sourceMode,
        })}

        {/* Markdown 导入 */}
        {renderBtn({
          key: "mdImport",
          title: "导入 Markdown",
          icon: <FileDown className="h-4 w-4" />,
          onClick: () => { setShowMdImport(true); setShowLink(false); },
          disabled: sourceMode,
        })}
      </div>

      {/* Editor area / Source mode */}
      {sourceMode ? (
        <textarea
          value={value}
          onChange={handleSourceChange}
          className="h-[600px] w-full resize-y bg-white px-4 py-3 font-mono text-sm leading-6 text-gray-800 focus:outline-none dark:bg-[#1e1e22] dark:text-gray-200"
          placeholder="<p>HTML 源码...</p>"
          spellCheck={false}
        />
      ) : (
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onKeyUp={refreshActive}
          onMouseUp={refreshActive}
          onPaste={handlePaste}
          data-placeholder={placeholder}
          className="article-editor-area h-[600px] w-full overflow-y-auto px-6 py-4 text-[16px] leading-7 text-gray-800 focus:outline-none dark:text-gray-200 md:px-12 md:text-[17px] md:leading-8"
        />
      )}

      {/* Markdown 导入弹窗 */}
      {(showMdImport || mdClosing) && (
        <div
          className={`fixed inset-0 z-[300] flex items-center justify-center bg-black/40 p-4 ${
            mdClosing ? "animate-overlay-out" : "animate-overlay-in"
          }`}
          onClick={handleMdClose}
        >
          <div
            className={`w-full max-w-2xl rounded-xl bg-white p-5 shadow-xl dark:bg-[#2a2a30] ${
              mdClosing ? "animate-modal-out" : "animate-modal-in"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">导入 Markdown</h3>
              <button type="button" onClick={handleMdClose} className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
              粘贴 Markdown 文本，将转换为富文本插入编辑器（替换当前内容）：
            </p>
            <textarea
              value={mdText}
              onChange={(e) => setMdText(e.target.value)}
              placeholder={"# 标题\n\n正文内容...\n\n- 列表项\n- 列表项\n\n> 引用\n\n```code\n```"}
              className="h-64 w-full resize-y rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-sm text-gray-800 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-gray-200"
              autoFocus
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={handleMdClose}
                className="rounded-lg px-4 py-2 text-sm text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/10"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleMdImport}
                disabled={!mdText.trim() || mdClosing}
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200 dark:disabled:bg-white/5 dark:disabled:text-gray-600"
              >
                导入
              </button>
            </div>
          </div>
        </div>
      )}

      <LinkCardPanel
        open={showLinkCardPanel}
        onClose={() => setShowLinkCardPanel(false)}
        onConfirm={(card) => {
          insertHtml(buildLinkCardHtml(card));
          setShowLinkCardPanel(false);
        }}
        token={token}
      />

      <MusicPanel
        open={showMusicPanel}
        initial={editingMusic}
        onClose={() => {
          setShowMusicPanel(false);
          setEditingMusic(null);
          editingEmbedRef.current = null;
        }}
        onConfirm={(music) => {
          if (editingEmbedRef.current) {
            // 编辑模式：替换已有嵌入
            const newHtml = buildMusicEmbedHtml(music);
            const tmp = document.createElement("div");
            tmp.innerHTML = newHtml;
            const newEl = tmp.firstElementChild as HTMLElement;
            if (newEl && editingEmbedRef.current.parentNode) {
              editingEmbedRef.current.replaceWith(newEl);
              if (editorRef.current) enhanceEmbeds(editorRef.current, handleEditMusic);
              emitChange();
            }
          } else {
            insertHtml(buildMusicEmbedHtml(music));
          }
          setShowMusicPanel(false);
          setEditingMusic(null);
          editingEmbedRef.current = null;
        }}
        token={token}
      />

      <VideoPanel
        open={showVideoPanel}
        onClose={() => setShowVideoPanel(false)}
        onConfirm={(video) => {
          insertHtml(buildVideoEmbedHtml(video));
          setShowVideoPanel(false);
        }}
        token={token}
      />
    </div>
  );
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildLinkCardHtml(card: LinkCard): string {
  const url = escapeHtml(card.url);
  const title = escapeHtml(card.title || card.url);
  const desc = card.description ? escapeHtml(card.description) : "";
  const image = card.image ? escapeHtml(toAbsoluteUrl(card.image)) : "";
  let html = `<a href="${url}" target="_blank" rel="noopener noreferrer" class="link-card" contenteditable="false">`;
  if (image) {
    html += `<span class="link-card-image"><img src="${image}" alt="" /></span>`;
  }
  html += `<span class="link-card-body"><span class="link-card-title">${title}</span>`;
  if (desc) {
    html += `<span class="link-card-desc">${desc}</span>`;
  }
  html += `</span></a>`;
  return html;
}

function encodePayload(obj: unknown): string {
  return btoa(encodeURIComponent(JSON.stringify(obj)));
}

function decodePayload(str: string): any {
  try {
    return JSON.parse(decodeURIComponent(atob(str)));
  } catch {
    return null;
  }
}

export function buildMusicEmbedHtml(music: PostMusic): string {
  const payload = encodePayload(music);
  const cover = music.cover ? escapeHtml(toAbsoluteUrl(music.cover)) : "";
  const title = escapeHtml(music.name || "未知歌曲");
  const artist = escapeHtml(music.artist || "未知艺术家");
  return `<div data-embed="music" data-payload="${payload}" contenteditable="false" class="embed-block embed-music">` +
    `<span class="embed-cover">${cover ? `<img src="${cover}" alt="" />` : ""}</span>` +
    `<span class="embed-info"><span class="embed-title">${title}</span>` +
    `<span class="embed-subtitle">${artist}</span></span>` +
    `</div>`;
}

export function buildVideoEmbedHtml(video: PostVideo): string {
  const payload = encodePayload(video);
  const cover = video.cover ? escapeHtml(toAbsoluteUrl(video.cover)) : "";
  const title = escapeHtml(video.title || "视频");
  return `<div data-embed="video" data-payload="${payload}" contenteditable="false" class="embed-block embed-video">` +
    `<span class="embed-cover">${cover ? `<img src="${cover}" alt="" />` : ""}</span>` +
    `<span class="embed-info"><span class="embed-title">${title}</span></span>` +
    `</div>`;
}

/**
 * 增强编辑器中的嵌入块：确保 contenteditable="false"，添加删除/编辑按钮。
 * 幂等：重复调用安全，不会重复添加按钮。
 */
function enhanceEmbeds(
  editor: HTMLElement,
  onEditMusic?: (el: HTMLElement, music: PostMusic) => void
) {
  const embeds = editor.querySelectorAll<HTMLElement>(
    '.embed-block, a.link-card'
  );
  embeds.forEach((el) => {
    el.setAttribute("contenteditable", "false");
    if (getComputedStyle(el).position === "static") {
      el.style.position = "relative";
    }
    if (!el.querySelector('[data-editor-only="delete"]')) {
      const btn = document.createElement("span");
      btn.setAttribute("data-editor-only", "delete");
      btn.setAttribute("contenteditable", "false");
      btn.className = "embed-delete-btn";
      btn.innerHTML = "&times;";
      btn.title = "删除";
      btn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        let next = el.nextSibling;
        el.remove();
        while (next && next.nodeType === Node.TEXT_NODE && /^\s*$/.test(next.textContent || "")) {
          const after = next.nextSibling;
          next.remove();
          next = after;
        }
        const event = new InputEvent("input", { bubbles: true });
        editor.dispatchEvent(event);
      });
      el.appendChild(btn);
    }
    // 音乐嵌入：添加编辑按钮
    if (
      el.getAttribute("data-embed") === "music" &&
      onEditMusic &&
      !el.querySelector('[data-editor-only="edit"]')
    ) {
      const editBtn = document.createElement("span");
      editBtn.setAttribute("data-editor-only", "edit");
      editBtn.setAttribute("contenteditable", "false");
      editBtn.className = "embed-edit-btn";
      editBtn.innerHTML = "&#9998;";
      editBtn.title = "编辑";
      editBtn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
      editBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const payload = el.getAttribute("data-payload");
        if (payload) {
          const music = decodePayload(payload) as PostMusic;
          if (music) onEditMusic(el, music);
        }
      });
      el.appendChild(editBtn);
    }
  });
}

/**
 * 从编辑器 HTML 中移除编辑器专用元素（如删除按钮），返回干净的 HTML 供保存。
 */
function stripEditorOnly(html: string): string {
  if (!html) return "";
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  tmp.querySelectorAll('[data-editor-only]').forEach((el) => el.remove());
  return tmp.innerHTML;
}

function Divider() {
  return <span className="mx-1 h-5 w-px bg-gray-200 dark:bg-white/10" />;
}
