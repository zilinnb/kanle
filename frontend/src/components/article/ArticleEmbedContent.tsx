"use client";

import { useMemo, useRef, useState, useCallback, useEffect } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import hljs from "highlight.js/lib/common";
import {
  sanitizeHtml,
  plainTextToHtml,
  looksLikeHtml,
} from "@/lib/sanitize";
import { replaceEmojiShortcodes, normalizeInlineEmoji } from "@/lib/emoji";
import type { PostMusic, PostVideo, PostDouban, PostImage } from "@/lib/mock-data";
import { getImageUrl } from "@/lib/site-settings-store";
import MusicEmbedCard from "./MusicEmbedCard";
import VideoPlayer from "@/components/VideoPlayer";
import DoubanEmbedCard from "./DoubanEmbedCard";
import ArticleEmbedCard from "./ArticleEmbedCard";
import ImageViewer from "@/components/ImageViewer";
import type { ArticleEmbedData } from "../editor/embed-utils";

interface ArticleEmbedContentProps {
  content: string;
  postId: string;
  className?: string;
}

interface HtmlSegment {
  kind: "html";
  html: string;
}
interface MusicSegment {
  kind: "music";
  payload: PostMusic;
}
interface VideoSegment {
  kind: "video";
  payload: PostVideo;
}
interface DoubanSegment {
  kind: "douban";
  payload: PostDouban;
}
interface ArticleSegment {
  kind: "article";
  payload: ArticleEmbedData;
}
type Segment = HtmlSegment | MusicSegment | VideoSegment | DoubanSegment | ArticleSegment;

function decodePayload(str: string): PostMusic | PostVideo | PostDouban | ArticleEmbedData | null {
  try {
    return JSON.parse(decodeURIComponent(atob(str))) as PostMusic | PostVideo | PostDouban | ArticleEmbedData;
  } catch {
    return null;
  }
}

function renderHtmlSegment(html: string): string {
  if (!html) return "";
  const processed = looksLikeHtml(html) ? sanitizeHtml(html) : plainTextToHtml(html);
  const withEmoji = normalizeInlineEmoji(replaceEmojiShortcodes(processed));
  return enhanceCodeBlocks(withEmoji);
}

/**
 * 用 highlight.js 对代码文本进行语法高亮，返回带 <span class="hljs-xxx"> 的 HTML。
 * 高亮失败时返回转义后的纯文本，确保安全。
 */
function highlightCode(codeText: string, lang: string): string {
  const escaped = codeText
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  try {
    const language = lang.toLowerCase().trim();
    if (language && language !== "plaintext" && hljs.getLanguage(language)) {
      return hljs.highlight(codeText, { language }).value;
    }
    return hljs.highlightAuto(codeText).value;
  } catch {
    return escaped;
  }
}

/**
 * 将 HTML 中的 <pre><code> 代码块增强为 macOS 风格结构
 * （红黄绿圆点 + 语言标签 + 复制按钮 + 行号 + 语法高亮）。
 */
function enhanceCodeBlocks(html: string): string {
  if (!html) return "";
  if (html.indexOf("<pre") === -1) return html;

  return html.replace(
    /<pre([^>]*)>([\s\S]*?)<\/pre>/gi,
    (_match, preAttrs: string, inner: string) => {
      // 从 data-language 属性或 code class 中提取语言
      const dataLangMatch = (preAttrs || "").match(/data-language="([^"]*)"/i);
      const codeClassMatch = inner.match(/<code[^>]*class="[^"]*language-(\w+)[^"]*"/i);
      const lang = (dataLangMatch?.[1] || codeClassMatch?.[1] || "plaintext").trim();
      const langLabel = lang === "plaintext" ? "Text" : lang.charAt(0).toUpperCase() + lang.slice(1);

      // 提取 <code> 标签内的纯文本
      const codeMatch = inner.match(/<code[^>]*>([\s\S]*?)<\/code>/i);
      const codeInner = codeMatch?.[1] || inner;
      // 去除 HTML 标签获取纯文本，再解码 HTML 实体
      const codeText = codeInner
        .replace(/<[^>]*>/g, "")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");

      // 用 highlight.js 进行语法高亮
      const highlighted = highlightCode(codeText, lang);

      // 计算行号
      const lineCount = codeText.split("\n").length;
      const actualLines = codeText.endsWith("\n") ? lineCount - 1 : lineCount;
      const lineNumbers = Array.from(
        { length: Math.max(1, actualLines) },
        (_, i) => i + 1
      ).join("\n");

      // 构建 <pre><code> 标签，保留 hljs 类供 CSS 识别
      const codeTag = `<code class="hljs language-${lang}">${highlighted}</code>`;
      const preTag = `<pre class="macos-enhanced-code"${(preAttrs || "").replace(/\s*class="[^"]*"/gi, "").replace(/\s*data-language="[^"]*"/gi, "")}>${codeTag}</pre>`;

      return `<div class="macos-enhanced-pre"><div class="macos-enhanced-header"><div class="macos-traffic-lights"><span class="macos-traffic-light macos-traffic-red"></span><span class="macos-traffic-light macos-traffic-yellow"></span><span class="macos-traffic-light macos-traffic-green"></span></div><span class="macos-enhanced-lang">${langLabel}</span><button class="macos-enhanced-copy" type="button"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg><span>复制</span></button></div><div class="macos-enhanced-body"><div class="macos-line-numbers">${lineNumbers}</div>${preTag}</div></div>`;
    }
  );
}

// 匹配带有 data-embed 属性的 div 开标签（属性顺序不限）
const EMBED_OPEN_REGEX =
  /<div\s+[^>]*?data-embed="(music|video|douban|article)"[^>]*>/gi;

function splitContent(content: string): Segment[] {
  if (!content) return [];
  const segments: Segment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  EMBED_OPEN_REGEX.lastIndex = 0;
  while ((match = EMBED_OPEN_REGEX.exec(content)) !== null) {
    const openTag = match[0];
    const embedType = match[1] as "music" | "video" | "douban" | "article";

    // 从开标签中提取 data-payload
    const payloadMatch = openTag.match(/data-payload="([^"]*)"/i);
    const payloadStr = payloadMatch ? payloadMatch[1] : "";

    // 查找对应的 </div> 闭合标签
    // embed div 内部使用 <span>（无嵌套 <div>），所以第一个 </div> 即为闭合标签
    const afterOpen = content.slice(match.index + openTag.length);
    const closeIdx = afterOpen.indexOf("</div>");
    if (closeIdx === -1) continue; // 没有闭合标签，跳过

    const fullMatchEnd = match.index + openTag.length + closeIdx + 6;

    if (match.index > lastIndex) {
      segments.push({ kind: "html", html: content.slice(lastIndex, match.index) });
    }

    const payload = decodePayload(payloadStr);
    if (payload) {
      if (embedType === "music") {
        segments.push({ kind: "music", payload: payload as PostMusic });
      } else if (embedType === "video") {
        segments.push({ kind: "video", payload: payload as PostVideo });
      } else if (embedType === "article") {
        segments.push({ kind: "article", payload: payload as ArticleEmbedData });
      } else {
        segments.push({ kind: "douban", payload: payload as PostDouban });
      }
    } else {
      // 解码失败：保留原始 HTML 作为兜底
      segments.push({ kind: "html", html: content.slice(match.index, fullMatchEnd) });
    }
    lastIndex = fullMatchEnd;
  }
  if (lastIndex < content.length) {
    segments.push({ kind: "html", html: content.slice(lastIndex) });
  }
  return segments;
}

/** 判断图片是否为内联表情（不应预览） */
function isInlineEmoji(img: HTMLImageElement): boolean {
  if (img.classList.contains("inline-emoji")) return true;
  const src = img.getAttribute("src") || "";
  if (src.includes("/emoji/")) return true;
  // 表情图片通常很小（高度 ≤ 2em ≈ 32px）
  const h = img.getBoundingClientRect().height;
  if (h > 0 && h <= 36) return true;
  return false;
}

/**
 * 渲染文章正文，将 data-embed 占位 div 替换为交互式 React 组件（音乐/视频）。
 *
 * 采用「内容分割」方案：用正则将原始 content 切分为 HTML 片段与 embed 占位，
 * embed 占位直接渲染为 React 组件（MusicEmbedCard / VideoPlayer），
 * HTML 片段用 dangerouslySetInnerHTML 渲染。
 *
 * 图片预览采用事件委托：在容器上监听 click 事件，点击 img 时收集所有可预览图片并打开 ImageViewer。
 */
export default function ArticleEmbedContent({
  content,
  postId,
  className,
}: ArticleEmbedContentProps) {
  const segments = useMemo(() => splitContent(content), [content]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewerIndex, setViewerIndex] = useState(-1);
  const [originRect, setOriginRect] = useState<DOMRect | null>(null);
  const [imageList, setImageList] = useState<PostImage[]>([]);

  const closeViewer = useCallback(() => {
    setViewerIndex(-1);
    setOriginRect(null);
  }, []);

  // 图片渐显：为 dangerouslySetInnerHTML 渲染的 img 绑定 load 事件
  // 已缓存（complete）的图片立即显示，未加载的从 opacity-0 渐显到 opacity-100
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const imgs = container.querySelectorAll<HTMLImageElement>(
      ".article-html-segment img:not(.inline-emoji):not([src*='/emoji/'])"
    );
    const cleanups: (() => void)[] = [];
    imgs.forEach((img) => {
      if (img.complete && img.naturalWidth > 0) {
        img.style.opacity = "1";
        return;
      }
      img.style.opacity = "0";
      img.style.transition = "opacity 500ms ease";
      const onLoad = () => {
        img.style.opacity = "1";
      };
      img.addEventListener("load", onLoad);
      cleanups.push(() => img.removeEventListener("load", onLoad));
    });
    return () => cleanups.forEach((fn) => fn());
  }, [segments]);

  /**
   * 事件委托：容器上的 click 事件。
   * - 代码块复制按钮：点击 .macos-enhanced-copy 复制对应代码
   * - 图片预览：点击 img 收集所有可预览图片并打开 ImageViewer
   */
  const handleContainerClick = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;

      // 代码块复制按钮
      const copyBtn = target.closest(".macos-enhanced-copy") as HTMLButtonElement | null;
      if (copyBtn) {
        e.preventDefault();
        e.stopPropagation();
        const wrapper = copyBtn.closest(".macos-enhanced-pre");
        if (!wrapper) return;
        const code = wrapper.querySelector("code");
        if (!code) return;
        const codeText = code.textContent || "";
        navigator.clipboard.writeText(codeText).then(() => {
          const label = copyBtn.querySelector("span");
          if (label) {
            const originalText = label.textContent;
            label.textContent = "已复制";
            copyBtn.style.color = "#28c840";
            setTimeout(() => {
              label.textContent = originalText;
              copyBtn.style.color = "";
            }, 2000);
          }
        });
        return;
      }

      // 图片预览
      if (target.tagName !== "IMG") return;

      const img = target as HTMLImageElement;
      const src = img.getAttribute("src") || "";
      if (!src) return;
      if (isInlineEmoji(img)) return;

      const container = containerRef.current;
      if (!container) return;

      // 收集所有可预览的图片（排除表情）
      const allImgs = Array.from(
        container.querySelectorAll<HTMLImageElement>(".article-html-segment img")
      ).filter((el) => {
        const s = el.getAttribute("src") || "";
        if (!s) return false;
        if (isInlineEmoji(el)) return false;
        return true;
      });

      const idx = allImgs.indexOf(img);
      if (idx < 0) return;

      e.preventDefault();
      e.stopPropagation();

      const images: PostImage[] = allImgs.map((el) =>
        getImageUrl(el.getAttribute("src") || "")
      );
      setImageList(images);
      setOriginRect(img.getBoundingClientRect());
      setViewerIndex(idx);
    },
    []
  );

  return (
    <div className={className} ref={containerRef} onClick={handleContainerClick}>
      {segments.map((seg, i) => {
        if (seg.kind === "music") {
          return (
            <MusicEmbedCard key={i} music={seg.payload} postId={postId} />
          );
        }
        if (seg.kind === "video") {
          return (
            <VideoPlayer key={i} video={seg.payload} postId={postId} />
          );
        }
        if (seg.kind === "douban") {
          return (
            <DoubanEmbedCard key={i} item={seg.payload} />
          );
        }
        if (seg.kind === "article") {
          return (
            <ArticleEmbedCard key={i} article={seg.payload} className="my-3 max-w-none" />
          );
        }
        return (
          <div
            key={i}
            className="article-html-segment"
            dangerouslySetInnerHTML={{ __html: renderHtmlSegment(seg.html) }}
          />
        );
      })}
      {viewerIndex >= 0 && imageList.length > 0 && (
        <ImageViewer
          images={imageList}
          initialIndex={viewerIndex}
          originRect={originRect}
          onClose={closeViewer}
        />
      )}
    </div>
  );
}
