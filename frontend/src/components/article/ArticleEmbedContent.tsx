"use client";

import { useMemo } from "react";
import {
  sanitizeHtml,
  plainTextToHtml,
  looksLikeHtml,
} from "@/lib/sanitize";
import { replaceEmojiShortcodes } from "@/lib/emoji";
import type { PostMusic, PostVideo, PostDouban } from "@/lib/mock-data";
import MusicEmbedCard from "./MusicEmbedCard";
import VideoPlayer from "@/components/VideoPlayer";
import DoubanEmbedCard from "./DoubanEmbedCard";
import ArticleEmbedCard from "./ArticleEmbedCard";
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
  return replaceEmojiShortcodes(processed);
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

  return (
    <div className={className}>
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
            <DoubanEmbedCard key={i} item={seg.payload} className="my-3 max-w-none" />
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
            dangerouslySetInnerHTML={{ __html: renderHtmlSegment(seg.html) }}
          />
        );
      })}
    </div>
  );
}
