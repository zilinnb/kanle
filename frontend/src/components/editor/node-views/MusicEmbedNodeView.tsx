"use client";

import { useState, useCallback } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { Music as MusicIcon } from "lucide-react";
import type { PostMusic } from "@/lib/mock-data";
import { getImageUrl } from "@/lib/site-settings-store";
import { decodePayload, encodePayload } from "../embed-utils";
import { useEditorContext } from "../editor-context";
import MusicPanel from "@/components/admin/MusicPanel";

export default function MusicEmbedNodeView({
  node,
  deleteNode,
  updateAttributes,
  selected,
}: NodeViewProps) {
  const { token } = useEditorContext();
  const [editing, setEditing] = useState(false);

  const music = decodePayload<PostMusic>(node.attrs.payload);
  if (!music) return null;

  const cover = music.cover ? getImageUrl(music.cover) : "";
  const title = music.name || "未知歌曲";
  const artist = music.artist || "未知艺术家";

  const handleEditConfirm = useCallback(
    (newMusic: PostMusic) => {
      updateAttributes({ payload: encodePayload(newMusic) });
      setEditing(false);
    },
    [updateAttributes]
  );

  const stopInteraction = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <NodeViewWrapper
      as="div"
      className={`embed-node-wrapper ${selected ? "is-selected" : ""}`}
    >
      <div className="embed-block embed-music" data-drag-handle>
        <span className="embed-cover">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt="" />
          ) : (
            <span className="embed-cover-placeholder">
              <MusicIcon className="h-5 w-5" />
            </span>
          )}
        </span>
        <span className="embed-info">
          <span className="embed-title">{title}</span>
          <span className="embed-subtitle">{artist}</span>
        </span>
        {/* 删除按钮 */}
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
        {/* 编辑按钮 */}
        <span
          className="embed-edit-btn"
          contentEditable={false}
          title="编辑"
          onMouseDown={stopInteraction}
          onClick={(e) => {
            stopInteraction(e);
            setEditing(true);
          }}
        >
          ✎
        </span>
      </div>
      {editing && (
        <MusicPanel
          open={true}
          initial={music}
          onClose={() => setEditing(false)}
          onConfirm={handleEditConfirm}
          token={token}
        />
      )}
    </NodeViewWrapper>
  );
}
