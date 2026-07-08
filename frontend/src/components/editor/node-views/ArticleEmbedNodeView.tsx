"use client";

import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { FileText } from "lucide-react";
import { toAbsoluteUrl } from "@/lib/upload";
import { decodePayload, type ArticleEmbedData } from "../embed-utils";

export default function ArticleEmbedNodeView({
  node,
  deleteNode,
  selected,
}: NodeViewProps) {
  const article = decodePayload<ArticleEmbedData>(node.attrs.payload);
  if (!article) return null;

  const cover = article.cover ? toAbsoluteUrl(article.cover) : "";
  const title = article.title || "文章";
  const excerpt = article.excerpt || "";

  const stopInteraction = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <NodeViewWrapper
      as="div"
      className={`embed-node-wrapper ${selected ? "is-selected" : ""}`}
    >
      <div className="embed-block embed-article" data-drag-handle>
        <span className="embed-cover">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt="" />
          ) : (
            <span className="embed-cover-placeholder">
              <FileText className="h-5 w-5" />
            </span>
          )}
        </span>
        <span className="embed-info">
          <span className="embed-title">{title}</span>
          {excerpt && <span className="embed-subtitle">{excerpt}</span>}
        </span>
        <span
          className="embed-delete-btn"
          contentEditable={false}
          title="删除"
          onMouseDown={stopInteraction}
          onClick={(e) => {
            stopInteraction(e);
            deleteNode();
          }}
        >
          ×
        </span>
      </div>
    </NodeViewWrapper>
  );
}
