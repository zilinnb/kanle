"use client";

import { useState, useCallback, useRef } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import {
  ImagePlus,
  Trash2,
  X,
  Loader2,
  Replace,
  LayoutGrid,
  Square,
  Grid2x2,
  Grid3x3,
  Rows3,
  Plus,
} from "lucide-react";
import { uploadImage } from "@/lib/upload";
import { useEditorContext } from "../editor-context";
import {
  type ImageGroupItem,
  type ImageGroupLayout,
  layoutToColumns,
  layoutMaxImages,
} from "../nodes/image-group";

const LAYOUT_OPTIONS: {
  layout: ImageGroupLayout;
  label: string;
  icon: typeof Square;
}[] = [
  { layout: "single", label: "单图", icon: Square },
  { layout: "double", label: "两图", icon: Grid2x2 },
  { layout: "triple", label: "三图", icon: Grid3x3 },
  { layout: "grid6", label: "六宫格", icon: Rows3 },
  { layout: "grid9", label: "九宫格", icon: LayoutGrid },
];

export default function ImageGroupNodeView({
  node,
  deleteNode,
  updateAttributes,
  selected,
}: NodeViewProps) {
  const { token } = useEditorContext();
  const [uploading, setUploading] = useState(false);
  const [hovered, setHovered] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const replaceIndexRef = useRef<number | null>(null);

  const images: ImageGroupItem[] = node.attrs.images || [];
  const layout: ImageGroupLayout = node.attrs.layout || "triple";
  const columns = layoutToColumns(layout);
  const maxImages = layoutMaxImages(layout);

  const uploadFiles = useCallback(
    async (files: FileList | File[], replaceIndex?: number) => {
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
          if (replaceIndex !== undefined && replaceIndex >= 0) {
            const next = [...images];
            next[replaceIndex] = newImages[0];
            updateAttributes({ images: next });
          } else {
            const remaining = maxImages - images.length;
            const toAdd = remaining > 0 ? newImages.slice(0, remaining) : newImages;
            updateAttributes({ images: [...images, ...toAdd] });
          }
        }
      } finally {
        setUploading(false);
      }
    },
    [token, images, updateAttributes, maxImages]
  );

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        uploadFiles(files, replaceIndexRef.current ?? undefined);
      }
      replaceIndexRef.current = null;
      e.target.value = "";
    },
    [uploadFiles]
  );

  const handleDeleteImage = useCallback(
    (index: number) => {
      const next = images.filter((_, i) => i !== index);
      updateAttributes({ images: next });
    },
    [images, updateAttributes]
  );

  const handleReplaceImage = useCallback(
    (index: number) => {
      replaceIndexRef.current = index;
      fileInputRef.current?.click();
    },
    []
  );

  const handleLayoutChange = useCallback(
    (newLayout: ImageGroupLayout) => {
      const newMax = layoutMaxImages(newLayout);
      const trimmed = images.length > newMax ? images.slice(0, newMax) : images;
      updateAttributes({ layout: newLayout, images: trimmed });
    },
    [images, updateAttributes]
  );

  const handleAddImage = useCallback(() => {
    replaceIndexRef.current = null;
    fileInputRef.current?.click();
  }, []);

  const handleSlotClick = useCallback(
    (slotIndex: number) => {
      replaceIndexRef.current = null;
      fileInputRef.current?.click();
    },
    []
  );

  const stopInteraction = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const showToolbar = selected || hovered;
  const emptySlots = layout === "grid6" || layout === "grid9" ? maxImages - images.length : 0;

  return (
    <NodeViewWrapper
      as="div"
      className={`image-group-wrapper ${selected ? "is-selected" : ""}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Floating toolbar — overlay on top of images */}
      {showToolbar && (
        <div className="image-group-toolbar" contentEditable={false}>
          <div className="flex items-center gap-0.5">
            <span className="mr-1 text-xs text-gray-500 dark:text-gray-400">布局</span>
            {LAYOUT_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.layout}
                  type="button"
                  title={opt.label}
                  onMouseDown={stopInteraction}
                  onClick={() => handleLayoutChange(opt.layout)}
                  className={`flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                    layout === opt.layout
                      ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-white/10 dark:text-gray-300 dark:hover:bg-white/20"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {opt.label}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              title="添加图片"
              onMouseDown={stopInteraction}
              onClick={handleAddImage}
              disabled={uploading || images.length >= maxImages}
              className="flex items-center gap-1 rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-200 disabled:opacity-50 dark:bg-white/10 dark:text-gray-300 dark:hover:bg-white/20"
            >
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ImagePlus className="h-3.5 w-3.5" />
              )}
              添加
            </button>
            <button
              type="button"
              title="删除整块"
              onMouseDown={stopInteraction}
              onClick={() => deleteNode()}
              className="flex items-center justify-center rounded bg-red-50 p-1.5 text-red-500 transition-colors hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {images.length === 0 ? (
        <div
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-200 py-12 text-gray-400 transition-colors hover:border-gray-400 hover:text-gray-600 dark:border-white/10 dark:hover:border-white/30 dark:hover:text-gray-300"
          onClick={handleAddImage}
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
          className={`image-group-grid image-group-layout-${layout}`}
          style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
          contentEditable={false}
        >
          {images.map((img, i) => (
            <div key={i} className="image-group-item group relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.src} alt={img.alt} className="image-grid-item" />
              {showToolbar && (
                <div className="absolute right-1 top-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    title="替换图片"
                    onMouseDown={stopInteraction}
                    onClick={() => handleReplaceImage(i)}
                    className="flex h-5 w-5 items-center justify-center rounded bg-black/60 text-white transition-colors hover:bg-black/80"
                  >
                    <Replace className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    title="删除"
                    onMouseDown={stopInteraction}
                    onClick={() => handleDeleteImage(i)}
                    className="flex h-5 w-5 items-center justify-center rounded bg-black/60 text-white transition-colors hover:bg-red-500"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          ))}
          {/* Empty placeholder slots for grid6/grid9 */}
          {emptySlots > 0 &&
            [...Array(emptySlots)].map((_, i) => (
              <div
                key={`slot-${i}`}
                className="image-group-slot flex cursor-pointer items-center justify-center border-2 border-dashed border-gray-200 text-gray-300 transition-colors hover:border-gray-400 hover:text-gray-500 dark:border-white/10 dark:hover:border-white/30 dark:hover:text-gray-400"
                onMouseDown={stopInteraction}
                onClick={() => handleSlotClick(i)}
              >
                <Plus className="h-4 w-4" />
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
