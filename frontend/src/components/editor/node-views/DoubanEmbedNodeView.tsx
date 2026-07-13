"use client";

import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { Film } from "lucide-react";
import type { PostDouban } from "@/lib/mock-data";
import { getImageUrl } from "@/lib/site-settings-store";
import { decodePayload } from "../embed-utils";

export default function DoubanEmbedNodeView({
  node,
  deleteNode,
  selected,
}: NodeViewProps) {
  const item = decodePayload<PostDouban>(node.attrs.payload);
  if (!item) return null;

  const cover = item.cover ? getImageUrl(item.cover) : "";
  const title = item.title || "豆瓣条目";
  const statusLabel = item.statusLabel || "";

  const stopInteraction = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <NodeViewWrapper
      as="div"
      className={`embed-node-wrapper link-card-wrapper ${selected ? "is-selected" : ""}`}
    >
      <a
        className="link-card"
        contentEditable={false}
        data-drag-handle
        onClick={(e) => e.preventDefault()}
      >
        {cover ? (
          <span className="link-card-image">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cover} alt="" />
          </span>
        ) : (
          <span className="link-card-image link-card-image-placeholder">
            <Film className="h-5 w-5" />
          </span>
        )}
        <span className="link-card-body">
          <span className="link-card-title">{title}</span>
          {statusLabel && <span className="link-card-desc">{statusLabel}</span>}
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
      </a>
    </NodeViewWrapper>
  );
}
