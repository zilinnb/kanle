"use client";

import { useState, useCallback, useEffect, useRef } from "react";

/**
 * 通用退出动画 hook
 *
 * 封装 "closing state + setTimeout 卸载" 模式，让弹窗/抽屉/浮层
 * 先播放退出动画再从 DOM 卸载，而非 {show && <Modal/>} 直接消失。
 *
 * 参考 VideoPlayerModal.tsx 的实现：
 *   const [closing, setClosing] = useState(false);
 *   const handleClose = () => { setClosing(true); setTimeout(onClose, 180); };
 *
 * 用法：
 *   const { closing, handleClose } = useExitAnimation(onClose, 200);
 *   <div className={closing ? "animate-overlay-out" : "animate-overlay-in"} />
 *   <button onClick={handleClose}>关闭</button>
 *
 * 防抖：closing 期间重复调用 handleClose 不会重复触发 onClose。
 * 清理：组件卸载时清除定时器，避免 onClose 在卸载后触发。
 */
export function useExitAnimation(onClose: () => void, duration = 180) {
  const [closing, setClosing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 用 ref 保存最新的 onClose，避免 handleClose 因 onClose 变化而频繁重建
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const handleClose = useCallback(() => {
    if (closing) return; // 防抖：已在关闭中，忽略重复调用
    setClosing(true);
    timerRef.current = setTimeout(() => {
      onCloseRef.current();
      // 重置 closing，下次打开时可正常播放进入动画
      setClosing(false);
    }, duration);
  }, [closing, duration]);

  // 卸载时清理定时器，防止 onClose 在组件卸载后触发
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  return { closing, handleClose };
}
