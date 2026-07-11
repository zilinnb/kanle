"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/core";
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
  Film,
  FileText,
  Highlighter,
  Palette,
  Table as TableIcon,
  Plus as PlusIcon,
  Minus as MinusIcon,
  Trash2,
  LayoutGrid,
} from "lucide-react";
import { EMOJI_LIST } from "@/lib/emoji";
import EmojiPicker from "@/components/EmojiPicker";
import { useExitAnimation } from "@/lib/use-exit-animation";

const PARAGRAPH_STYLES = [
  { label: "正文", tag: "p" as const },
  { label: "标题1", tag: "h1" as const },
  { label: "标题2", tag: "h2" as const },
  { label: "标题3", tag: "h3" as const },
  { label: "引用", tag: "blockquote" as const },
];

const TEXT_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4",
  "#3b82f6", "#8b5cf6", "#ec4899", "#6b7280", "#1a1a1a",
];

const HIGHLIGHT_COLORS = [
  "#fef08a", "#bbf7d0", "#bfdbfe", "#fbcfe8", "#fed7aa",
  "#fef9c3", "#d9f99d", "#a5f3fc", "#fce7f3", "#fed7aa",
];

interface ToolbarProps {
  editor: Editor | null;
  sourceMode: boolean;
  uploading: boolean;
  onToggleSourceMode: () => void;
  onOpenMarkdownImport: () => void;
  onOpenLinkCard: () => void;
  onOpenMusic: () => void;
  onOpenVideo: () => void;
  onOpenDouban: () => void;
  onOpenArticle: () => void;
  onOpenImagePicker: () => void;
  onInsertImageGroup: () => void;
}

interface ToolBtn {
  key: string;
  title: string;
  icon: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}

export default function Toolbar({
  editor,
  sourceMode,
  uploading,
  onToggleSourceMode,
  onOpenMarkdownImport,
  onOpenLinkCard,
  onOpenMusic,
  onOpenVideo,
  onOpenDouban,
  onOpenArticle,
  onOpenImagePicker,
  onInsertImageGroup,
}: ToolbarProps) {
  const [showLink, setShowLink] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [showParaMenu, setShowParaMenu] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
  const linkBtnRef = useRef<HTMLButtonElement | null>(null);
  const [linkPos, setLinkPos] = useState<{ top: number; left: number } | null>(null);

  const { closing: linkClosing, handleClose: handleLinkClose } = useExitAnimation(() => {
    setShowLink(false);
    setLinkUrl("");
  }, 160);

  const { closing: emojiClosing, handleClose: handleEmojiClose } = useExitAnimation(() => {
    setShowEmoji(false);
  }, 160);

  useEffect(() => {
    if (!showLink || !linkBtnRef.current) return;
    const rect = linkBtnRef.current.getBoundingClientRect();
    const POPUP_WIDTH = 288;
    const GAP = 4;
    let left = rect.left;
    if (left + POPUP_WIDTH > window.innerWidth - 8) {
      left = Math.max(8, rect.right - POPUP_WIDTH);
    }
    setLinkPos({ top: rect.bottom + GAP, left });
  }, [showLink]);

  // Close color/highlight pickers when clicking outside
  useEffect(() => {
    if (!showColorPicker && !showHighlightPicker) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-color-picker]") || target.closest("[data-highlight-picker]")) return;
      setShowColorPicker(false);
      setShowHighlightPicker(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [showColorPicker, showHighlightPicker]);

  const preventBlur = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  const insertHyperlink = useCallback(() => {
    if (!editor) return;
    const url = linkUrl.trim();
    if (!url) return;
    const finalUrl = url.startsWith("http") ? url : `https://${url}`;
    editor.chain().focus().setLink({ href: finalUrl, target: "_blank", rel: "noopener noreferrer" }).run();
    handleLinkClose();
  }, [editor, linkUrl, handleLinkClose]);

  const insertEmoji = useCallback(
    (name: string) => {
      if (!editor) return;
      const item = EMOJI_LIST.find((e) => e.name === name);
      if (!item) return;
      editor.chain().focus().insertContent({
        type: "inlineEmoji",
        attrs: { src: item.url, alt: name },
      }).run();
      setShowEmoji(false);
    },
    [editor]
  );

  if (!editor) {
    return (
      <div className="sticky top-[120px] z-10 flex h-12 items-center border-b border-gray-200 bg-gray-50/95 px-2 backdrop-blur lg:top-0 dark:border-white/10 dark:bg-[#26262b]/95">
        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
      </div>
    );
  }

  const currentBlock = editor.isActive("heading", { level: 1 })
    ? "h1"
    : editor.isActive("heading", { level: 2 })
    ? "h2"
    : editor.isActive("heading", { level: 3 })
    ? "h3"
    : editor.isActive("blockquote")
    ? "blockquote"
    : "p";

  const currentStyleLabel =
    PARAGRAPH_STYLES.find((s) => s.tag === currentBlock)?.label || "正文";

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

  const formatBlock = (tag: string) => {
    if (sourceMode) return;
    editor.chain().focus();
    if (tag === "p") editor.chain().focus().setParagraph().run();
    else if (tag === "blockquote") editor.chain().focus().setBlockquote().run();
    else if (tag === "h1") editor.chain().focus().setHeading({ level: 1 }).run();
    else if (tag === "h2") editor.chain().focus().setHeading({ level: 2 }).run();
    else if (tag === "h3") editor.chain().focus().setHeading({ level: 3 }).run();
    setShowParaMenu(false);
  };

  return (
    <div className="sticky top-[120px] z-10 flex flex-wrap items-center gap-0.5 border-b border-gray-200 bg-gray-50/95 px-2 py-1.5 backdrop-blur lg:top-0 dark:border-white/10 dark:bg-[#26262b]/95">
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
        {renderBtn({ key: "undo", title: "撤销", icon: <Undo2 className="h-4 w-4" />, onClick: () => editor.chain().focus().undo().run(), disabled: sourceMode })}
        {renderBtn({ key: "redo", title: "重做", icon: <Redo2 className="h-4 w-4" />, onClick: () => editor.chain().focus().redo().run(), disabled: sourceMode })}
      </div>

      <Divider />

      {/* 加粗/斜体/下划线/删除线 */}
      <div className="flex items-center gap-0.5">
        {renderBtn({ key: "bold", title: "加粗", icon: <Bold className="h-4 w-4" />, onClick: () => editor.chain().focus().toggleBold().run(), active: editor.isActive("bold"), disabled: sourceMode })}
        {renderBtn({ key: "italic", title: "斜体", icon: <Italic className="h-4 w-4" />, onClick: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive("italic"), disabled: sourceMode })}
        {renderBtn({ key: "underline", title: "下划线", icon: <Underline className="h-4 w-4" />, onClick: () => editor.chain().focus().toggleUnderline().run(), active: editor.isActive("underline"), disabled: sourceMode })}
        {renderBtn({ key: "strike", title: "删除线", icon: <Strikethrough className="h-4 w-4" />, onClick: () => editor.chain().focus().toggleStrike().run(), active: editor.isActive("strike"), disabled: sourceMode })}
      </div>

      {/* 文字高亮 */}
      <div className="relative" data-highlight-picker>
        <button
          type="button"
          title="文字高亮"
          onMouseDown={preventBlur}
          onClick={() => { setShowHighlightPicker((v) => !v); setShowColorPicker(false); }}
          disabled={sourceMode}
          className={`flex h-8 w-8 items-center justify-center rounded transition-colors ${
            editor.isActive("highlight")
              ? "bg-gray-200 text-gray-900 dark:bg-white/15 dark:text-white"
              : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10"
          } disabled:cursor-not-allowed disabled:text-gray-300 dark:disabled:text-gray-600`}
        >
          <Highlighter className="h-4 w-4" />
        </button>
        {showHighlightPicker && (
          <div className="absolute left-0 top-9 z-30 w-48 rounded-lg border border-gray-200 bg-white p-2 shadow-lg dark:border-white/10 dark:bg-[#2a2a30]">
            <div className="grid grid-cols-5 gap-1.5">
              {HIGHLIGHT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onMouseDown={preventBlur}
                  onClick={() => { editor.chain().focus().setHighlight({ color: c }).run(); setShowHighlightPicker(false); }}
                  className="h-6 w-6 rounded border border-gray-200 transition-transform hover:scale-110 dark:border-white/10"
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            {/* 自定义调色盘 */}
            <div className="mt-2 flex items-center gap-2 border-t border-gray-100 pt-2 dark:border-white/10">
              <label
                className="relative flex h-7 w-7 cursor-pointer items-center justify-center rounded border border-gray-200 dark:border-white/10"
                onMouseDown={preventBlur}
                title="自定义高亮色"
              >
                <input
                  type="color"
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  onChange={(e) => {
                    editor.chain().focus().setHighlight({ color: e.target.value }).run();
                  }}
                />
                <div
                  className="h-4 w-4 rounded-full border border-gray-300 dark:border-white/20"
                  style={{ background: "conic-gradient(red, orange, yellow, green, cyan, blue, purple, magenta, red)" }}
                />
              </label>
              <span className="text-xs text-gray-500 dark:text-gray-400">自定义颜色</span>
            </div>
            <button
              type="button"
              onMouseDown={preventBlur}
              onClick={() => { editor.chain().focus().unsetHighlight().run(); setShowHighlightPicker(false); }}
              className="mt-2 w-full rounded py-1 text-xs text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/10"
            >
              清除高亮
            </button>
          </div>
        )}
      </div>

      {/* 文字颜色 */}
      <div className="relative" data-color-picker>
        <button
          type="button"
          title="文字颜色"
          onMouseDown={preventBlur}
          onClick={() => { setShowColorPicker((v) => !v); setShowHighlightPicker(false); }}
          disabled={sourceMode}
          className={`flex h-8 w-8 items-center justify-center rounded transition-colors ${
            showColorPicker
              ? "bg-gray-200 text-gray-900 dark:bg-white/15 dark:text-white"
              : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10"
          } disabled:cursor-not-allowed disabled:text-gray-300 dark:disabled:text-gray-600`}
        >
          <Palette className="h-4 w-4" />
        </button>
        {showColorPicker && (
          <div className="absolute left-0 top-9 z-30 w-48 rounded-lg border border-gray-200 bg-white p-2 shadow-lg dark:border-white/10 dark:bg-[#2a2a30]">
            <div className="grid grid-cols-5 gap-1.5">
              {TEXT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onMouseDown={preventBlur}
                  onClick={() => { editor.chain().focus().setColor(c).run(); setShowColorPicker(false); }}
                  className="h-6 w-6 rounded border border-gray-200 transition-transform hover:scale-110 dark:border-white/10"
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            {/* 自定义调色盘 */}
            <div className="mt-2 flex items-center gap-2 border-t border-gray-100 pt-2 dark:border-white/10">
              <label
                className="relative flex h-7 w-7 cursor-pointer items-center justify-center rounded border border-gray-200 dark:border-white/10"
                onMouseDown={preventBlur}
                title="自定义颜色"
              >
                <input
                  type="color"
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  onChange={(e) => {
                    editor.chain().focus().setColor(e.target.value).run();
                  }}
                />
                <div
                  className="h-4 w-4 rounded-full border border-gray-300 dark:border-white/20"
                  style={{ background: "conic-gradient(red, orange, yellow, green, cyan, blue, purple, magenta, red)" }}
                />
              </label>
              <span className="text-xs text-gray-500 dark:text-gray-400">自定义颜色</span>
            </div>
            <button
              type="button"
              onMouseDown={preventBlur}
              onClick={() => { editor.chain().focus().unsetColor().run(); setShowColorPicker(false); }}
              className="mt-2 w-full rounded py-1 text-xs text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/10"
            >
              清除颜色
            </button>
          </div>
        )}
      </div>

      <Divider />

      {/* 列表 */}
      <div className="flex items-center gap-0.5">
        {renderBtn({ key: "ul", title: "无序列表", icon: <ListIcon className="h-4 w-4" />, onClick: () => editor.chain().focus().toggleBulletList().run(), active: editor.isActive("bulletList"), disabled: sourceMode })}
        {renderBtn({ key: "ol", title: "有序列表", icon: <ListOrdered className="h-4 w-4" />, onClick: () => editor.chain().focus().toggleOrderedList().run(), active: editor.isActive("orderedList"), disabled: sourceMode })}
      </div>

      <Divider />

      {/* 对齐 */}
      <div className="flex items-center gap-0.5">
        {renderBtn({ key: "left", title: "左对齐", icon: <AlignLeft className="h-4 w-4" />, onClick: () => editor.chain().focus().setTextAlign("left").run(), active: editor.isActive({ textAlign: "left" }), disabled: sourceMode })}
        {renderBtn({ key: "center", title: "居中", icon: <AlignCenter className="h-4 w-4" />, onClick: () => editor.chain().focus().setTextAlign("center").run(), active: editor.isActive({ textAlign: "center" }), disabled: sourceMode })}
        {renderBtn({ key: "right", title: "右对齐", icon: <AlignRight className="h-4 w-4" />, onClick: () => editor.chain().focus().setTextAlign("right").run(), active: editor.isActive({ textAlign: "right" }), disabled: sourceMode })}
      </div>

      <Divider />

      {/* 引用 */}
      {renderBtn({ key: "quote", title: "引用", icon: <Quote className="h-4 w-4" />, onClick: () => editor.chain().focus().setBlockquote().run(), active: editor.isActive("blockquote"), disabled: sourceMode })}

      {/* 代码块 */}
      {renderBtn({ key: "code", title: "代码块", icon: <Code className="h-4 w-4" />, onClick: () => editor.chain().focus().setCodeBlock().run(), active: editor.isActive("codeBlock"), disabled: sourceMode })}

      {/* 分隔线 */}
      {renderBtn({ key: "hr", title: "分隔线", icon: <Minus className="h-4 w-4" />, onClick: () => editor.chain().focus().setHorizontalRule().run(), disabled: sourceMode })}

      {/* 表格 */}
      <Divider />
      <div className="flex items-center gap-0.5">
        {renderBtn({
          key: "table",
          title: "插入表格",
          icon: <TableIcon className="h-4 w-4" />,
          onClick: () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
          disabled: sourceMode,
        })}
        {editor.isActive("table") && (
          <>
            {renderBtn({
              key: "addRow",
              title: "在下方添加行",
              icon: <PlusIcon className="h-4 w-4" />,
              onClick: () => editor.chain().focus().addRowAfter().run(),
              disabled: sourceMode,
            })}
            {renderBtn({
              key: "addCol",
              title: "在右侧添加列",
              icon: <MinusIcon className="h-4 w-4 rotate-90" />,
              onClick: () => editor.chain().focus().addColumnAfter().run(),
              disabled: sourceMode,
            })}
            {renderBtn({
              key: "delTable",
              title: "删除表格",
              icon: <Trash2 className="h-4 w-4" />,
              onClick: () => editor.chain().focus().deleteTable().run(),
              disabled: sourceMode,
            })}
          </>
        )}
      </div>

      <Divider />

      {/* 链接 + 链接卡片 + 表情 + 图片 */}
      <div className="flex items-center gap-0.5">
        {/* 插入链接 */}
        <div className="relative">
          <button
            ref={linkBtnRef}
            type="button"
            title="插入链接"
            onMouseDown={preventBlur}
            onClick={() => { setShowLink((v) => !v); setShowEmoji(false); }}
            disabled={sourceMode}
            className="flex h-8 w-8 items-center justify-center rounded text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-300 dark:text-gray-300 dark:hover:bg-white/10 dark:disabled:text-gray-600"
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
        {renderBtn({ key: "linkCard", title: "插入链接卡片", icon: <LayoutTemplate className="h-4 w-4" />, onClick: onOpenLinkCard, disabled: sourceMode })}

        {/* 表情 */}
        <div className="relative">
          {renderBtn({ key: "emoji", title: "插入表情", icon: <Smile className="h-4 w-4" />, onClick: () => { setShowEmoji((v) => !v); setShowLink(false); }, disabled: sourceMode })}
          {(showEmoji || emojiClosing) && (
            <EmojiPicker onSelect={insertEmoji} onClose={handleEmojiClose} />
          )}
        </div>

        {/* 图片上传 */}
        <button
          type="button"
          title="插入图片"
          onMouseDown={preventBlur}
          onClick={onOpenImagePicker}
          disabled={uploading || sourceMode}
          className="flex h-8 w-8 items-center justify-center rounded text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-300 dark:text-gray-300 dark:hover:bg-white/10 dark:disabled:text-gray-600"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
        </button>

        {/* 图片网格 */}
        {renderBtn({
          key: "imageGrid",
          title: "图片网格",
          icon: <LayoutGrid className="h-4 w-4" />,
          onClick: onInsertImageGroup,
          disabled: sourceMode,
        })}
      </div>

      <Divider />

      {/* 音乐 / 视频 / 豆瓣 / 文章卡片 */}
      <div className="flex items-center gap-0.5">
        {renderBtn({ key: "music", title: "添加音乐", icon: <Music className="h-4 w-4" />, onClick: onOpenMusic, disabled: sourceMode })}
        {renderBtn({ key: "video", title: "插入视频", icon: <Video className="h-4 w-4" />, onClick: onOpenVideo, disabled: sourceMode })}
        {renderBtn({ key: "douban", title: "插入豆瓣卡片", icon: <Film className="h-4 w-4" />, onClick: onOpenDouban, disabled: sourceMode })}
        {renderBtn({ key: "article", title: "插入文章卡片", icon: <FileText className="h-4 w-4" />, onClick: onOpenArticle, disabled: sourceMode })}
      </div>

      <Divider />

      {/* 源码模式 */}
      {renderBtn({
        key: "source",
        title: sourceMode ? "退出源码模式" : "源码模式",
        icon: <FileCode2 className="h-4 w-4" />,
        onClick: onToggleSourceMode,
        active: sourceMode,
      })}

      {/* Markdown 导入 */}
      {renderBtn({
        key: "mdImport",
        title: "导入 Markdown",
        icon: <FileDown className="h-4 w-4" />,
        onClick: onOpenMarkdownImport,
        disabled: sourceMode,
      })}
    </div>
  );
}

function Divider() {
  return <span className="mx-1 h-5 w-px bg-gray-200 dark:bg-white/10" />;
}
