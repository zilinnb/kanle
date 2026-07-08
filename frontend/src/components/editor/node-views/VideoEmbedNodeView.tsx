"use client";

import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { Video as VideoIcon } from "lucide-react";
import type { PostVideo } from "@/lib/mock-data";
import { toAbsoluteUrl } from "@/lib/upload";
import { decodePayload } from "../embed-utils";

export default function VideoEmbedNodeView({
  node,
  deleteNode,
  selected,
}: NodeViewProps) {
  const video = decodePayload<PostVideo>(node.attrs.payload);
  if (!video) return null;

  const cover = video.cover ? toAbsoluteUrl(video.cover) : "";
  const title = video.title || "视频";

  const stopInteraction = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <NodeViewWrapper
      as="div"
      className={`embed-node-wrapper ${selected ? "is-selected" : ""}`}
    >
      <div className="embed-block embed-video" data-drag-handle>
        <span className="embed-cover">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt="" />
          ) : (
            <span className="embed-cover-placeholder">
              <VideoIcon className="h-5 w-5" />
            </span>
          )}
        </span>
        <span className="embed-info">
          <span className="embed-title">{title}</span>
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
