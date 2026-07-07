"use client";

import { useRef, useEffect } from "react";
import { EMOJI_LIST } from "@/lib/emoji";
import { useExitAnimation } from "@/lib/use-exit-animation";

interface EmojiPickerProps {
  onSelect: (name: string) => void;
  onClose: () => void;
}

export default function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { closing, handleClose } = useExitAnimation(onClose, 160);

  useEffect(() => {
    const handler = (e: MouseEvent | TouchEvent) => {
      if (closing) return;
      if (ref.current && !ref.current.contains(e.target as Node)) {
        handleClose();
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handler);
      document.addEventListener("touchstart", handler, { passive: true });
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [handleClose, closing]);

  return (
    <div
      ref={ref}
      className={`fixed left-1/2 top-1/2 z-[200] w-[calc(100vw-2rem)] max-w-[320px] max-h-[40vh] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-wechat-border bg-wechat-white p-2 shadow-lg dark:border-white/10 dark:bg-[#232328] sm:absolute sm:left-0 sm:top-9 sm:max-w-[280px] sm:translate-x-0 sm:translate-y-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${
        closing ? "animate-emoji-fade-out" : "animate-emoji-fade-in"
      }`}
    >
      <div className="grid grid-cols-7 gap-1">
        {EMOJI_LIST.map((emoji) => (
          <button
            key={emoji.file}
            type="button"
            onClick={() => onSelect(emoji.name)}
            className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-wechat-hover dark:hover:bg-white/10"
            title={emoji.name}
          >
            <img
              src={emoji.url}
              alt={emoji.name}
              className="inline-emoji h-6 w-6"
              loading="lazy"
            />
          </button>
        ))}
      </div>
    </div>
  );
}
