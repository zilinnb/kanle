"use client";

import { ReactNode } from "react";
import { createPortal } from "react-dom";
import { useExitAnimation } from "@/lib/use-exit-animation";

interface AdminModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** 底部操作区（取消/确认按钮等） */
  footer?: ReactNode;
  /** 内容宽度：默认 md */
  width?: "sm" | "md" | "lg";
}

const WIDTH_MAP: Record<NonNullable<AdminModalProps["width"]>, string> = {
  sm: "sm:max-w-md",
  md: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
};

/**
 * 后端管理通用弹窗：createPortal + 进入/退出动画。
 * 参考 AdminAds.tsx 的弹窗实现：animate-overlay-in/out + animate-modal-in/out。
 * 移动端从底部滑入（rounded-t-xl），桌面端居中（rounded-xl）。
 */
export default function AdminModal({
  open,
  onClose,
  title,
  children,
  footer,
  width = "md",
}: AdminModalProps) {
  const { closing, handleClose } = useExitAnimation(onClose, 220);

  if (!open && !closing) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[200] flex items-end justify-center bg-black/40 sm:items-center sm:p-4 ${
        closing ? "animate-overlay-out" : "animate-overlay-in"
      }`}
      onClick={handleClose}
    >
      <div
        className={`flex max-h-[90vh] w-full flex-col rounded-t-xl bg-adm-card sm:max-h-[85vh] ${WIDTH_MAP[width]} sm:rounded-xl ${
          closing ? "animate-modal-out" : "animate-modal-in"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-adm-border px-4 py-3">
          <h3 className="text-sm font-medium text-adm-text">{title}</h3>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-1 text-adm-text-tertiary transition-colors hover:bg-adm-card-hover hover:text-adm-text"
            aria-label="关闭"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="flex justify-end gap-2 border-t border-adm-border px-4 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
