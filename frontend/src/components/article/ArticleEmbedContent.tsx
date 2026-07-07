"use client";

import { useMemo } from "react";
import {
  sanitizeHtml,
  plainTextToHtml,
  looksLikeHtml,
} from "@/lib/sanitize";
import { replaceEmojiShortcodes } from "@/lib/emoji";
import type { PostMusic, PostVideo } from "@/lib/mock-data";
import MusicEmbedCard from "./MusicEmbedCard";
import VideoPlayer from "@/components/VideoPlayer";

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
type Segment = HtmlSegment | MusicSegment | VideoSegment;

function decodePayload(str: string): PostMusic | PostVideo | null {
  try {
    return JSON.parse(decodeURIComponent(atob(str))) as PostMusic | PostVideo;
  } catch {
    return null;
  }
}

function renderHtmlSegment(html: string): string {
  if (!html) return "";
  const processed = looksLikeHtml(html) ? sanitizeHtml(html) : plainTextToHtml(html);
  return replaceEmojiShortcodes(processed);
}

// 编辑器生成的 embed div 内部使用 <span>（无嵌套 <div>），
// 因此非贪婪匹配到第一个 </div> 即为该 embed div 的闭合标签。
const EMBED_REGEX =
  /<div\s+data-embed="(music|video)"\s+data-payload="([^"]*)"[^>]*>[\s\S]*?<\/div>/gi;

function splitContent(content: string): Segment[] {
  if (!content) return [];
  const segments: Segment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  EMBED_REGEX.lastIndex = 0;
  while ((match = EMBED_REGEX.exec(content)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ kind: "html", html: content.slice(lastIndex, match.index) });
    }
    const embedType = match[1] as "music" | "video";
    const payload = decodePayload(match[2]);
    if (payload) {
      if (embedType === "music") {
        segments.push({ kind: "music", payload: payload as PostMusic });
      } else {
        segments.push({ kind: "video", payload: payload as PostVideo });
      }
    } else {
      // 解码失败：保留原始 HTML 作为兜底
      segments.push({ kind: "html", html: match[0] });
    }
    lastIndex = match.index + match[0].length;
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
