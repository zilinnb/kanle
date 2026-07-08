"use client";

import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { Film } from "lucide-react";
import type { PostDouban } from "@/lib/mock-data";
import { toAbsoluteUrl } from "@/lib/upload";
import { decodePayload } from "../embed-utils";

export default function DoubanEmbedNodeView({
  node,
  deleteNode,
  selected,
}: NodeViewProps) {
  const item = decodePayload<PostDouban>(node.attrs.payload);
  if (!item) return null;

  const cover = item.cover ? toAbsoluteUrl(item.cover) : "";
  const title = item.title || "豆瓣条目";
  const statusLabel = item.statusLabel || "";

  const stopInteraction = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <NodeViewWrapper
      as="div"
      className={`embed-node-wrapper ${selected ? "is-selected" : ""}`}
    >
      <div className="embed-block embed-douban" data-drag-handle>
        <span className="embed-cover">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt="" />
          ) : (
            <span className="embed-cover-placeholder">
              <Film className="h-5 w-5" />
            </span>
          )}
        </span>
        <span className="embed-info">
          <span className="embed-title">{title}</span>
          {statusLabel && <span className="embed-subtitle">{statusLabel}</span>}
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
