"use client";

import { useState, useCallback, useRef } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { ImagePlus, Trash2, X, Loader2 } from "lucide-react";
import { uploadImage } from "@/lib/upload";
import { useEditorContext } from "../editor-context";
import type { ImageGroupItem } from "../nodes/image-group";

const LAYOUT_OPTIONS = [
  { columns: 1, label: "单图" },
  { columns: 2, label: "两图" },
  { columns: 3, label: "三图" },
];

export default function ImageGroupNodeView({
  node,
  deleteNode,
  updateAttributes,
  selected,
}: NodeViewProps) {
  const { token } = useEditorContext();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const images: ImageGroupItem[] = node.attrs.images || [];
  const columns: number = node.attrs.columns || 3;

  const handleAddImages = useCallback(
    async (files: FileList) => {
      if (!token) return;
      setUploading(true);
      try {
        const newImages: ImageGroupItem[] = [];
        for (const file of Array.from(files)) {
          if (!file.type.startsWith("image/")) continue;
          try {
            const url = await uploadImage(file, token);
            newImages.push({ src: url, alt: "" });
          } catch (err) {
            console.error("图片上传失败:", err);
          }
        }
        if (newImages.length > 0) {
          updateAttributes({ images: [...images, ...newImages] });
        }
      } finally {
        setUploading(false);
      }
    },
    [token, images, updateAttributes]
  );

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleAddImages(files);
      }
      e.target.value = "";
    },
    [handleAddImages]
  );

  const handleDeleteImage = useCallback(
    (index: number) => {
      const next = images.filter((_, i) => i !== index);
      updateAttributes({ images: next });
    },
    [images, updateAttributes]
  );

  const handleColumnsChange = useCallback(
    (cols: number) => {
      updateAttributes({ columns: cols });
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
      className={`image-group-wrapper ${selected ? "is-selected" : ""}`}
    >
      <div className="image-group-toolbar" contentEditable={false}>
        <div className="flex items-center gap-1">
          <span className="mr-1 text-xs text-gray-500 dark:text-gray-400">布局</span>
          {LAYOUT_OPTIONS.map((opt) => (
            <button
              key={opt.columns}
              type="button"
              title={opt.label}
              onMouseDown={stopInteraction}
              onClick={() => handleColumnsChange(opt.columns)}
              className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                columns === opt.columns
                  ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-white/10 dark:text-gray-300 dark:hover:bg-white/20"
              }`}
            >
              {opt.label}
            </button>
          ))}
          {images.length >= 6 && (
            <span className="ml-1 text-xs text-gray-400">{images.length}张</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            title="添加图片"
            onMouseDown={stopInteraction}
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1 rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-200 disabled:opacity-50 dark:bg-white/10 dark:text-gray-300 dark:hover:bg-white/20"
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ImagePlus className="h-3.5 w-3.5" />
            )}
            添加图片
          </button>
          <button
            type="button"
            title="删除网格"
            onMouseDown={stopInteraction}
            onClick={() => deleteNode()}
            className="flex items-center justify-center rounded bg-red-50 p-1.5 text-red-500 transition-colors hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {images.length === 0 ? (
        <div
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-200 py-12 text-gray-400 transition-colors hover:border-gray-400 hover:text-gray-600 dark:border-white/10 dark:hover:border-white/30 dark:hover:text-gray-300"
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <ImagePlus className="h-6 w-6" />
          )}
          <span className="text-sm">点击添加图片</span>
        </div>
      ) : (
        <div
          className="image-group-grid"
          style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
          contentEditable={false}
        >
          {images.map((img, i) => (
            <div key={i} className="image-group-item group relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.src} alt={img.alt} className="image-grid-item" />
              <button
                type="button"
                title="删除"
                onMouseDown={stopInteraction}
                onClick={() => handleDeleteImage(i)}
                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        multiple
        onChange={onFileChange}
        className="hidden"
      />
    </NodeViewWrapper>
  );
}
