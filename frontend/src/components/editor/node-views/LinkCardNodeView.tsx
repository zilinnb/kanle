"use client";

import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { Link2 } from "lucide-react";
import { toAbsoluteUrl } from "@/lib/upload";

export default function LinkCardNodeView({
  node,
  deleteNode,
  selected,
}: NodeViewProps) {
  const { href, title, description, image } = node.attrs as {
    href: string;
    title: string;
    description: string;
    image: string;
  };

  const cover = image ? toAbsoluteUrl(image) : "";
  const displayTitle = title || href || "链接";
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
        href={href}
        target="_blank"
        rel="noopener noreferrer"
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
            <Link2 className="h-5 w-5" />
          </span>
        )}
        <span className="link-card-body">
          <span className="link-card-title">{displayTitle}</span>
          {description && <span className="link-card-desc">{description}</span>}
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
