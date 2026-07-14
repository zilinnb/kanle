"use client";

import { useEffect, useRef, useState } from "react";

type RefLike<T> = { current: T | null };

/**
 * 视频进入视口时自动播放（静音），离开视口时暂停。
 *
 * 浏览器策略要求自动播放必须 muted，所以此 hook 会强制静音。
 * 用户在播放器内手动取消静音后，不强制再次静音。
 *
 * @returns visible - 当前是否在视口中（可见 ≥60%）
 */
export function useAutoplayOnVisible<T extends HTMLElement>(
  targetRef: RefLike<T>,
  options?: { threshold?: number; rootMargin?: string }
): { visible: boolean } {
  const { threshold = 0.6, rootMargin = "0px" } = options || {};
  const [visible, setVisible] = useState(false);
  const userUnmutedRef = useRef(false);

  useEffect(() => {
    const el = targetRef.current;
    if (!el) return;

    // 监听内部 video / iframe 元素是否进入视口
    const findMediaEl = (): HTMLVideoElement | HTMLIFrameElement | null => {
      const video = el.querySelector("video");
      if (video) return video;
      const iframe = el.querySelector("iframe");
      return iframe;
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const isIntersecting = entry.isIntersecting;
          setVisible(isIntersecting);
          const media = findMediaEl();
          if (!media) continue;

          if (media instanceof HTMLVideoElement) {
            // 用户手动取消静音后，不再强制覆盖
            if (!userUnmutedRef.current) {
              media.muted = true;
            }
            if (isIntersecting) {
              media.play().catch(() => {
                /* 自动播放被阻止：忽略，用户可手动点击播放 */
              });
            } else {
              media.pause();
            }
          }
          // iframe（如 B 站）：由组件根据 visible 重设 src
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(el);

    // 监听用户手动取消静音
    const media = findMediaEl();
    if (media instanceof HTMLVideoElement) {
      const onVolumeChange = () => {
        if (!media.muted) userUnmutedRef.current = true;
      };
      media.addEventListener("volumechange", onVolumeChange);
      return () => {
        observer.disconnect();
        media.removeEventListener("volumechange", onVolumeChange);
      };
    }

    return () => observer.disconnect();
  }, [targetRef, threshold, rootMargin]);

  return { visible };
}
