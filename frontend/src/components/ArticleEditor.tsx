"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import Highlight from "@tiptap/extension-highlight";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import { X } from "lucide-react";

import { CustomImage } from "./editor/nodes/custom-image";
import { MusicEmbed } from "./editor/nodes/music-embed";
import { VideoEmbed } from "./editor/nodes/video-embed";
import { DoubanEmbed } from "./editor/nodes/douban-embed";
import { ArticleEmbed } from "./editor/nodes/article-embed";
import { LinkCardNode } from "./editor/nodes/link-card";
import { SlashCommand } from "./editor/slash-command/slash-command";
import { TrailingParagraph } from "./editor/extensions/trailing-paragraph";
import { CodeBlockExit } from "./editor/extensions/code-block-exit";
import Toolbar from "./editor/Toolbar";
import { EditorContext } from "./editor/editor-context";
import ArticlePicker from "./editor/ArticlePicker";
import { encodePayload, type ArticleEmbedData } from "./editor/embed-utils";

import LinkCardPanel from "./admin/LinkCardPanel";
import MusicPanel from "./admin/MusicPanel";
import VideoPanel from "./admin/VideoPanel";
import DoubanPicker from "./DoubanPicker";
import { uploadImage, toAbsoluteUrl } from "@/lib/upload";
import { markdownToHtml } from "@/lib/markdown";
import { useExitAnimation } from "@/lib/use-exit-animation";
import type { PostMusic, PostVideo, PostDouban, LinkCard } from "@/lib/mock-data";

// Re-export build functions for backwards compatibility (ArticleEditorPage imports these)
export {
  buildMusicEmbedHtml,
  buildVideoEmbedHtml,
  buildDoubanEmbedHtml,
  buildLinkCardHtml,
  buildArticleEmbedHtml,
} from "./editor/embed-utils";

interface ArticleEditorProps {
  value: string;
  onChange: (html: string) => void;
  token: string;
  placeholder?: string;
}

export default function ArticleEditor({
  value,
  onChange,
  token,
  placeholder = "开始写作...",
}: ArticleEditorProps) {
  const [sourceMode, setSourceMode] = useState(false);
  const [sourceContent, setSourceContent] = useState(value);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const initializedRef = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Panel states
  const [showLinkCardPanel, setShowLinkCardPanel] = useState(false);
  const [showMusicPanel, setShowMusicPanel] = useState(false);
  const [showVideoPanel, setShowVideoPanel] = useState(false);
  const [showDoubanPicker, setShowDoubanPicker] = useState(false);
  const [showArticlePicker, setShowArticlePicker] = useState(false);
  const [showMdImport, setShowMdImport] = useState(false);
  const [mdText, setMdText] = useState("");

  const { closing: mdClosing, handleClose: handleMdClose } = useExitAnimation(() => {
    setShowMdImport(false);
    setMdText("");
  }, 220);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Link.extend({
        parseHTML() {
          return [{ tag: "a[href]:not(.link-card)" }];
        },
      }).configure({
        openOnClick: false,
        HTMLAttributes: {
          target: "_blank",
          rel: "noopener noreferrer",
        },
      }),
      CustomImage,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === "codeBlock") return "输入代码... 按 Ctrl+Enter 退出";
          return placeholder;
        },
      }),
      MusicEmbed,
      VideoEmbed,
      DoubanEmbed,
      ArticleEmbed,
      LinkCardNode,
      SlashCommand,
      TrailingParagraph,
      CodeBlockExit,
    ],
    content: value || "",
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChangeRef.current(editor.getHTML());
    },
  });

  // Sync external value changes to editor (e.g., when loading article for editing)
  useEffect(() => {
    if (!editor) return;
    if (!initializedRef.current && value) {
      editor.commands.setContent(value);
      initializedRef.current = true;
    }
  }, [editor, value]);

  // Set up slash command storage callbacks
  useEffect(() => {
    if (!editor) return;
    const slashStorage = (editor.storage as Record<string, any>).slashCommand as {
      openImagePicker?: () => void;
      openLinkPanel?: () => void;
      openLinkCardPanel?: () => void;
      openMusicPanel?: () => void;
      openVideoPanel?: () => void;
      openDoubanPicker?: () => void;
      openArticlePicker?: () => void;
    };
    slashStorage.openImagePicker = () => {
      if (fileInputRef.current) fileInputRef.current.click();
    };
    slashStorage.openLinkPanel = () => {
      if (!editor) return;
      const url = window.prompt("输入链接 URL:");
      if (!url) return;
      const finalUrl = url.startsWith("http") ? url : `https://${url}`;
      if (editor.state.selection.empty) {
        editor.chain().focus().insertContent({
          type: "text",
          text: finalUrl,
          marks: [{ type: "link", attrs: { href: finalUrl, target: "_blank", rel: "noopener noreferrer" } }],
        }).run();
      } else {
        editor.chain().focus().setLink({ href: finalUrl, target: "_blank", rel: "noopener noreferrer" }).run();
      }
    };
    slashStorage.openLinkCardPanel = () => setShowLinkCardPanel(true);
    slashStorage.openMusicPanel = () => setShowMusicPanel(true);
    slashStorage.openVideoPanel = () => setShowVideoPanel(true);
    slashStorage.openDoubanPicker = () => setShowDoubanPicker(true);
    slashStorage.openArticlePicker = () => setShowArticlePicker(true);
  }, [editor]);

  // Source mode toggle
  const handleToggleSourceMode = useCallback(() => {
    if (!editor) return;
    if (!sourceMode) {
      setSourceContent(editor.getHTML());
      setSourceMode(true);
    } else {
      editor.commands.setContent(sourceContent);
      onChangeRef.current(sourceContent);
      setSourceMode(false);
    }
  }, [editor, sourceMode, sourceContent]);

  const handleSourceChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setSourceContent(e.target.value);
      onChangeRef.current(e.target.value);
    },
    []
  );

  // Image upload
  const handleImageUpload = useCallback(
    async (file: File) => {
      if (!editor || !token) return;
      setUploading(true);
      try {
        const url = await uploadImage(file, token);
        editor.chain().focus().setImage({
          src: url,
          alt: "",
        } as any).run();
        // Apply style via setAttributes (CustomImage supports style attr)
        // The style is applied through the image node's style attribute
      } catch (err) {
        alert(err instanceof Error ? err.message : "图片上传失败");
      } finally {
        setUploading(false);
      }
    },
    [editor, token]
  );

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleImageUpload(file);
      e.target.value = "";
    },
    [handleImageUpload]
  );

  // Markdown import
  const handleMdImport = useCallback(() => {
    if (!editor) return;
    const html = markdownToHtml(mdText);
    editor.commands.setContent(html);
    onChangeRef.current(html);
    handleMdClose();
  }, [editor, mdText, handleMdClose]);

  // Panel confirm handlers
  const handleMusicConfirm = useCallback(
    (music: PostMusic) => {
      if (!editor) return;
      editor.chain().focus().insertContent({
        type: "musicEmbed",
        attrs: { payload: encodePayload(music) },
      }).run();
      setShowMusicPanel(false);
    },
    [editor]
  );

  const handleVideoConfirm = useCallback(
    (video: PostVideo) => {
      if (!editor) return;
      editor.chain().focus().insertContent({
        type: "videoEmbed",
        attrs: { payload: encodePayload(video) },
      }).run();
      setShowVideoPanel(false);
    },
    [editor]
  );

  const handleDoubanSelect = useCallback(
    (item: PostDouban) => {
      if (!editor) return;
      editor.chain().focus().insertContent({
        type: "doubanEmbed",
        attrs: { payload: encodePayload(item) },
      }).run();
      setShowDoubanPicker(false);
    },
    [editor]
  );

  const handleArticleSelect = useCallback(
    (article: ArticleEmbedData) => {
      if (!editor) return;
      editor.chain().focus().insertContent({
        type: "articleEmbed",
        attrs: { payload: encodePayload(article) },
      }).run();
      setShowArticlePicker(false);
    },
    [editor]
  );

  const handleLinkCardConfirm = useCallback(
    (card: LinkCard) => {
      if (!editor) return;
      editor.chain().focus().insertContent({
        type: "linkCard",
        attrs: {
          href: card.url,
          title: card.title || card.url,
          description: card.description || "",
          image: card.image ? toAbsoluteUrl(card.image) : "",
          siteName: card.siteName || "",
        },
      }).run();
      setShowLinkCardPanel(false);
    },
    [editor]
  );

  return (
    <EditorContext.Provider value={{ token }}>
      <div className="article-editor overflow-clip rounded-xl border border-gray-200 bg-white dark:border-white/10 dark:bg-[#1e1e22]">
        <Toolbar
          editor={editor}
          sourceMode={sourceMode}
          uploading={uploading}
          onToggleSourceMode={handleToggleSourceMode}
          onOpenMarkdownImport={() => setShowMdImport(true)}
          onOpenLinkCard={() => setShowLinkCardPanel(true)}
          onOpenMusic={() => setShowMusicPanel(true)}
          onOpenVideo={() => setShowVideoPanel(true)}
          onOpenDouban={() => setShowDoubanPicker(true)}
          onOpenArticle={() => setShowArticlePicker(true)}
          onOpenImagePicker={() => fileInputRef.current?.click()}
        />

        {/* Editor area / Source mode */}
        {sourceMode ? (
          <textarea
            value={sourceContent}
            onChange={handleSourceChange}
            className="h-[600px] w-full resize-y bg-white px-4 py-3 font-mono text-sm leading-6 text-gray-800 focus:outline-none dark:bg-[#1e1e22] dark:text-gray-200"
            placeholder="<p>HTML 源码...</p>"
            spellCheck={false}
          />
        ) : (
          <EditorContent
            editor={editor}
            className="article-editor-area"
          />
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          onChange={onFileChange}
          className="hidden"
        />

        {/* Markdown import modal */}
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

        {/* Panels */}
        <LinkCardPanel
          open={showLinkCardPanel}
          onClose={() => setShowLinkCardPanel(false)}
          onConfirm={handleLinkCardConfirm}
          token={token}
        />

        <MusicPanel
          open={showMusicPanel}
          onClose={() => setShowMusicPanel(false)}
          onConfirm={handleMusicConfirm}
          token={token}
        />

        <VideoPanel
          open={showVideoPanel}
          onClose={() => setShowVideoPanel(false)}
          onConfirm={handleVideoConfirm}
          token={token}
        />

        <DoubanPicker
          open={showDoubanPicker}
          onClose={() => setShowDoubanPicker(false)}
          onSelect={handleDoubanSelect}
        />

        <ArticlePicker
          open={showArticlePicker}
          onClose={() => setShowArticlePicker(false)}
          onSelect={handleArticleSelect}
        />
      </div>
    </EditorContext.Provider>
  );
}
