"use client";

import { useRef, useState, useLayoutEffect, ReactNode } from "react";
import { createPortal } from "react-dom";
import { renderContent } from "@/lib/sanitize";
import type { PostMusic, PostVideo } from "@/lib/mock-data";
import MusicEmbedCard from "./MusicEmbedCard";
import VideoPlayer from "@/components/VideoPlayer";

interface ArticleEmbedContentProps {
  content: string;
  postId: string;
  className?: string;
}

interface EmbedItem {
  node: HTMLElement;
  type: string;
  payload: PostMusic | PostVideo;
}

function decodePayload(str: string): PostMusic | PostVideo | null {
  try {
    return JSON.parse(decodeURIComponent(atob(str))) as PostMusic | PostVideo;
  } catch {
    return null;
  }
}

/**
 * 渲染文章正文，并将 data-embed 占位 div 替换为交互式 React 组件（音乐/视频）。
 * key={content} 确保内容变化时完全重挂载，避免 portal 指向已销毁的 DOM 节点。
 */
export default function ArticleEmbedContent({ content, postId, className }: ArticleEmbedContentProps) {
  return <EmbedInner key={content} content={content} postId={postId} className={className} />;
}

function EmbedInner({ content, postId, className }: ArticleEmbedContentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [embeds, setEmbeds] = useState<EmbedItem[]>([]);

  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const els = Array.from(containerRef.current.querySelectorAll("[data-embed]")) as HTMLElement[];
    if (els.length === 0) {
      if (embeds.length > 0) setEmbeds([]);
      return;
    }
    const items: EmbedItem[] = [];
    for (const el of els) {
      const type = el.getAttribute("data-embed") || "";
      const payload = decodePayload(el.getAttribute("data-payload") || "");
      if (payload) {
        // 仅在有有效 payload 时清空静态预览，避免解码失败导致空白
        el.innerHTML = "";
        // 移除静态预览专属类，让父级回到 .embed-block 中性样式
        // （display:block; background:transparent; overflow:visible）
        // 避免 display:flex / overflow:hidden / background 等与 React 组件冲突
        if (type === "music") {
          el.classList.remove("embed-music");
        }
        items.push({ node: el, type, payload });
      }
    }
    setEmbeds(items);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renderEmbed = (embed: EmbedItem): ReactNode => {
    if (embed.type === "music") {
      return createPortal(
        <MusicEmbedCard music={embed.payload as PostMusic} postId={postId} />,
        embed.node
      );
    }
    if (embed.type === "video") {
      return createPortal(
        <VideoPlayer video={embed.payload as PostVideo} postId={postId} />,
        embed.node
      );
    }
    return null;
  };

  return (
    <div ref={containerRef} className={className}>
      <div dangerouslySetInnerHTML={{ __html: renderContent(content) }} />
      {embeds.map((embed) => renderEmbed(embed))}
    </div>
  );
}
