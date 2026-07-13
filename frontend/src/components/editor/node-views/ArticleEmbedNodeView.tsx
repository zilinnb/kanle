"use client";

import { useState, useCallback } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { FileText, Pencil } from "lucide-react";
import { getImageUrl, useSiteSettings } from "@/lib/site-settings-store";
import { decodePayload, encodePayload, type ArticleEmbedData } from "../embed-utils";
import ArticlePicker from "../ArticlePicker";

export default function ArticleEmbedNodeView({
  node,
  deleteNode,
  updateAttributes,
  selected,
}: NodeViewProps) {
  const [showPicker, setShowPicker] = useState(false);
  const defaultCover = useSiteSettings((s) => s.defaultCover);
  const article = decodePayload<ArticleEmbedData>(node.attrs.payload);
  if (!article) return null;

  const cover = (article.cover || defaultCover) ? getImageUrl(article.cover || defaultCover) : "";
  const title = article.title || "文章";
  const excerpt = article.excerpt || "";

  const stopInteraction = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleEdit = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setShowPicker(true);
    },
    []
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      deleteNode();
    },
    [deleteNode]
  );

  const handleSelect = useCallback(
    (newArticle: ArticleEmbedData) => {
      updateAttributes({ payload: encodePayload(newArticle) });
      setShowPicker(false);
    },
    [updateAttributes]
  );

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
        {/* 编辑按钮 */}
        <span
          className="embed-edit-btn"
          contentEditable={false}
          title="更换文章"
          onMouseDown={stopInteraction}
          onClick={handleEdit}
        >
          <Pencil className="h-3 w-3" />
        </span>
        {/* 删除按钮 */}
        <span
          className="embed-delete-btn"
          contentEditable={false}
          title="删除"
          onMouseDown={stopInteraction}
          onClick={handleDelete}
        >
          ×
        </span>
      </div>

      {/* 文章选择器（编辑模式） */}
      {showPicker && (
        <ArticlePicker
          open={showPicker}
          onClose={() => setShowPicker(false)}
          onSelect={handleSelect}
        />
      )}
    </NodeViewWrapper>
  );
}
