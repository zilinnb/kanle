"use client";

import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import {
  sanitizeHtml,
  plainTextToHtml,
  looksLikeHtml,
} from "@/lib/sanitize";
import { replaceEmojiShortcodes, normalizeInlineEmoji } from "@/lib/emoji";
import type { PostMusic, PostVideo, PostDouban, PostImage } from "@/lib/mock-data";
import { toAbsoluteUrl } from "@/lib/upload";
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
  return normalizeInlineEmoji(replaceEmojiShortcodes(processed));
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

/**
 * 渲染文章正文，将 data-embed 占位 div 替换为交互式 React 组件（音乐/视频）。
 *
 * 采用「内容分割」方案：用正则将原始 content 切分为 HTML 片段与 embed 占位，
 * embed 占位直接渲染为 React 组件（MusicEmbedCard / VideoPlayer），
 * HTML 片段用 dangerouslySetInnerHTML 渲染。
 *
 * 相比 createPortal 方案，此方案将 embed 组件纳入正常 React 树，
 * 不依赖 useLayoutEffect 时序，无 hydration 冲突风险。
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

  const openViewer = useCallback((i: number, rect: DOMRect) => {
    setOriginRect(rect);
    setViewerIndex(i);
  }, []);

  const closeViewer = useCallback(() => {
    setViewerIndex(-1);
    setOriginRect(null);
  }, []);

  // After render: collect all <img> in HTML segments and attach click-to-preview
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const imgs = container.querySelectorAll<HTMLImageElement>(
      ".article-html-segment img"
    );
    const srcs: PostImage[] = [];
    const handlers: Array<{ el: HTMLImageElement; handler: (e: Event) => void }> = [];

    imgs.forEach((img, i) => {
      const src = toAbsoluteUrl(img.getAttribute("src") || "");
      if (!src) return;
      srcs.push(src);

      img.style.cursor = "zoom-in";
      img.dataset.viewerIndex = String(srcs.length - 1);

      const handler = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        const idx = parseInt(img.dataset.viewerIndex || "0", 10);
        openViewer(idx, img.getBoundingClientRect());
      };
      img.addEventListener("click", handler);
      handlers.push({ el: img, handler });
    });

    setImageList(srcs);

    return () => {
      handlers.forEach(({ el, handler }) => {
        el.removeEventListener("click", handler);
        el.style.cursor = "";
      });
    };
  }, [segments, openViewer]);

  return (
    <div className={className} ref={containerRef}>
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
