"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useExitAnimation } from "@/lib/use-exit-animation";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmText = "确定",
  cancelText = "取消",
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [visible, setVisible] = useState(false);
  const actionRef = useRef<"confirm" | "cancel">("cancel");

  const { closing, handleClose } = useExitAnimation(() => {
    setVisible(false);
    if (actionRef.current === "confirm") onConfirm();
    else onCancel();
  }, 200);

  useEffect(() => {
    if (open) {
      setVisible(true);
    } else if (visible && !closing) {
      setVisible(false);
    }
  }, [open, visible, closing]);

  if (typeof document === "undefined") return null;
  if (!visible) return null;

  const triggerClose = (action: "confirm" | "cancel") => {
    actionRef.current = action;
    handleClose();
  };

  return createPortal(
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 ${
        closing ? "animate-overlay-out" : "animate-overlay-in"
      }`}
      onClick={() => triggerClose("cancel")}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-sm rounded-2xl bg-adm-card p-5 shadow-xl ${
          closing ? "animate-pop-out" : "animate-pop-in"
        }`}
      >
        <h3 className="text-base font-semibold text-adm-text">{title}</h3>
        <p className="mt-2 text-sm text-adm-text-secondary">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => triggerClose("cancel")}
            className="rounded-xl border border-adm-border px-4 py-2 text-sm text-adm-text-secondary transition-colors hover:bg-adm-card-hover"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={() => triggerClose("confirm")}
            className={`rounded-xl px-4 py-2 text-sm font-medium text-white transition-colors ${
              danger
                ? "bg-red-500 hover:bg-red-600"
                : "bg-adm-primary hover:opacity-90"
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
