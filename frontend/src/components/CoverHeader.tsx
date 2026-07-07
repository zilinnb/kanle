"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { User } from "@/lib/mock-data";
import { resolveAvatar } from "@/lib/avatar";
import { toAbsoluteUrl } from "@/lib/upload";

interface CoverHeaderProps {
  user: User;
  avatarHref?: string;
  /** 服务端传过来的背景图列表，客户端随机选一张展示 */
  coverUrls?: string[];
}

const MAX_PARALLAX = 80;

/**
 * 模块级变量：记录当前"页面加载"周期内选中的背景图索引。
 * - 客户端导航（首页↔归档页）时保持，跨页面显示同一张图
 * - 刷新页面时 JS 重新加载，变量重置为 -1，重新随机选一张
 */
let cachedCoverIdx = -1;

export default function CoverHeader({ user, avatarHref, coverUrls }: CoverHeaderProps) {
  const [scrollY, setScrollY] = useState(0);
  const [isDesktop, setIsDesktop] = useState(false);

  // 所有封面图转为绝对 URL
  const allCovers = (coverUrls && coverUrls.length > 0 ? coverUrls : [user.cover])
    .map(toAbsoluteUrl)
    .filter(Boolean);

  // 可见图索引：-1 表示不显示任何图（避免初始显示第 0 张再切换到随机张）
  const [visibleIdx, setVisibleIdx] = useState(-1);
  const loadedRef = useRef<Set<number>>(new Set());
  const targetIdxRef = useRef(0);
  // readyRef：防止 onLoadingComplete 在 useEffect 随机选图之前把图设为可见
  const readyRef = useRef(false);

  const handleImageLoad = (idx: number) => {
    loadedRef.current.add(idx);
    if (readyRef.current && idx === targetIdxRef.current) {
      setVisibleIdx(idx);
    }
  };

  useEffect(() => {
    readyRef.current = true;
    if (allCovers.length <= 1) {
      // 单张图：直接显示第 0 张
      targetIdxRef.current = 0;
    } else {
      // 多张图：优先用模块级缓存的索引（客户端导航时保持同一张图）
      let idx = cachedCoverIdx;
      if (idx < 0 || idx >= allCovers.length) {
        // 首次访问或刷新页面（cachedCoverIdx 被重置为 -1）：随机选一张
        idx = Math.floor(Math.random() * allCovers.length);
      }
      cachedCoverIdx = idx;
      targetIdxRef.current = idx;
    }
    // 如果目标图已经加载完（例如浏览器缓存命中），立即显示
    if (loadedRef.current.has(targetIdxRef.current)) {
      setVisibleIdx(targetIdxRef.current);
    }
  }, [allCovers.length]);

  useEffect(() => {
    const checkDesktop = () => setIsDesktop(window.innerWidth >= 768);
    checkDesktop();
    window.addEventListener("resize", checkDesktop);
    return () => window.removeEventListener("resize", checkDesktop);
  }, []);

  useEffect(() => {
    if (!isDesktop) return;
    let rafId: number | null = null;
    const root = document.getElementById("scroll-root");
    const onScroll = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        setScrollY(Math.max(root?.scrollTop || 0, window.scrollY || 0));
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    if (root) root.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", onScroll);
      if (root) root.removeEventListener("scroll", onScroll);
    };
  }, [isDesktop]);

  const avatarSrc = resolveAvatar(user.avatar, user.email || "", 200);
  const parallax = isDesktop ? Math.min(scrollY * 0.3, MAX_PARALLAX) : 0;

  return (
    <header className="w-full" data-cover-header>
      {/* Cover image container is the positioning boundary */}
      <div className="relative h-[335px] w-full sm:h-[300px] md:h-[340px]">
        {/* Image clipping layer: overflow-hidden only clips the cover image,
            not the avatar that crosses the cover/body boundary. */}
        <div className="absolute inset-0 overflow-hidden bg-wechat-bubble md:rounded-t-2xl">
          {/* Parallax wrapper: taller than container so it can offset downward
              without revealing blank space at the top. */}
          <div
            className="absolute left-0 right-0"
            style={
              isDesktop
                ? {
                    top: `-${MAX_PARALLAX}px`,
                    height: `calc(100% + ${MAX_PARALLAX * 2}px)`,
                    transform: `translateY(${parallax}px)`,
                  }
                : { top: 0, height: "100%" }
            }
          >
            {allCovers.map((src, idx) => (
              <Image
                key={src}
                src={src}
                alt="朋友圈封面"
                fill
                priority={idx === 0}
                onLoadingComplete={() => handleImageLoad(idx)}
                className={`object-cover transition-opacity duration-1000 ${
                  idx === visibleIdx ? "opacity-100" : "opacity-0"
                }`}
                sizes="(max-width: 768px) 100vw, 600px"
              />
            ))}
          </div>

          {/* Bottom gradient for nickname readability */}
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
        </div>

        {/* Nickname + avatar row crossing the cover/body boundary like WeChat.
            z-10 keeps the avatar above the bio section that follows. */}
        <div className="absolute bottom-0 left-0 right-0 z-10 mx-auto max-w-[600px] px-4 sm:px-5 md:px-6">
          <div className="flex items-end justify-end gap-3 pb-1">
            {avatarHref ? (
              <Link
                href={avatarHref}
                className="group flex items-end justify-end gap-3"
                aria-label={`进入${user.nickname}的归档`}
              >
                <span className="mb-1 text-lg font-medium text-white drop-shadow md:text-xl">
                  {user.nickname}
                </span>
                <div data-cover-avatar className="relative h-[56px] w-[56px] shrink-0 translate-y-[42%] overflow-hidden rounded-[5px] ring-2 ring-white/0 transition-all group-hover:ring-white/50 sm:h-[60px] sm:w-[60px] md:h-[64px] md:w-[64px]">
                  <Image
                    src={avatarSrc}
                    alt={user.nickname}
                    fill
                    className="object-cover"
                    sizes="88px"
                    unoptimized={avatarSrc.endsWith(".svg")}
                  />
                </div>
              </Link>
            ) : (
              <>
                <span className="mb-1 text-lg font-medium text-white drop-shadow md:text-xl">
                  {user.nickname}
                </span>
                <div data-cover-avatar className="relative h-[56px] w-[56px] shrink-0 translate-y-[42%] overflow-hidden rounded-[5px] sm:h-[60px] sm:w-[60px] md:h-[64px] md:w-[64px]">
                  <Image
                    src={avatarSrc}
                    alt={user.nickname}
                    fill
                    className="object-cover"
                    sizes="88px"
                    unoptimized={avatarSrc.endsWith(".svg")}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Bio - sits just below the avatar that extends into the body */}
      <div className="mx-auto flex max-w-[600px] justify-end px-4 pb-2 pt-6 text-xs text-wechat-time sm:px-5 sm:pt-7 md:px-6 md:pb-3 md:pt-8">
        <span className="max-w-[80%] truncate text-right">{user.bio}</span>
      </div>
    </header>
  );
}
