"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { List } from "lucide-react";

interface Heading {
  id: string;
  text: string;
  level: number;
  element: HTMLElement;
}

export default function ArticleTOC() {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const containerRef = useRef<HTMLDivElement>(null);

  const extractHeadings = useCallback(() => {
    const articleContent = document.querySelector(".article-content");
    if (!articleContent) return;

    const els = Array.from(
      articleContent.querySelectorAll("h2, h3")
    ) as HTMLElement[];

    const items: Heading[] = els.map((el, i) => {
      const text = el.textContent?.trim() || "";
      if (!el.id) {
        el.id = `article-heading-${i}`;
      }
      return { id: el.id, text, level: el.tagName === "H2" ? 2 : 3, element: el };
    });

    setHeadings(items.filter((h) => h.text.length > 0));
  }, []);

  useEffect(() => {
    const timer = setTimeout(extractHeadings, 300);
    return () => clearTimeout(timer);
  }, [extractHeadings]);

  // TopBar: top-6(24px) + h-12(48px) = 72px；scroll-root 从 top-6(24px) 开始
  // 需要偏移 72-24=48px 才不被遮挡，再加 ~12px 视觉缓冲
  const SCROLL_OFFSET = 84;
  // scroll spy 提前激活阈值：标题进入视口顶部此距离内时视为当前章节
  const SPY_THRESHOLD = 100;

  /**
   * 重新从 DOM 查找标题元素。
   * ArticleEmbedContent 用 dangerouslySetInnerHTML 渲染正文，React 状态变化
   * （点赞/评论/视图更新）可能导致 DOM 重建，存储的 element 引用失效。
   * 此函数按 id → 文本内容+层级 的顺序回退查找。
   */
  const resolveHeadingElement = useCallback(
    (heading: Heading): HTMLElement | null => {
      // 1. 存储的引用仍有效
      if (heading.element && heading.element.isConnected) {
        return heading.element;
      }
      // 2. 按 id 查找
      const byId = document.getElementById(heading.id);
      if (byId) return byId;
      // 3. 按 文本内容 + 层级 查找
      const tag = heading.level === 2 ? "h2" : "h3";
      const candidates = document.querySelectorAll(`.article-content ${tag}`);
      for (const el of candidates) {
        if (el.textContent?.trim() === heading.text) {
          return el as HTMLElement;
        }
      }
      return null;
    },
    []
  );

  useEffect(() => {
    if (headings.length === 0) return;

    const scrollRoot = document.getElementById("scroll-root");
    if (!scrollRoot) return;

    const onScroll = () => {
      const scrollRect = scrollRoot.getBoundingClientRect();
      let current = "";
      for (const h of headings) {
        const el = resolveHeadingElement(h);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        const relativeTop = rect.top - scrollRect.top;
        if (relativeTop <= SPY_THRESHOLD) {
          current = h.id;
        }
      }
      setActiveId(current);
    };

    scrollRoot.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => scrollRoot.removeEventListener("scroll", onScroll);
  }, [headings, resolveHeadingElement]);

  const handleClick = (e: React.MouseEvent, heading: Heading) => {
    e.preventDefault();
    const scrollRoot = document.getElementById("scroll-root");
    if (!scrollRoot) return;

    const targetEl = resolveHeadingElement(heading);
    if (!targetEl) return;

    const scrollRect = scrollRoot.getBoundingClientRect();
    const headingRect = targetEl.getBoundingClientRect();
    const top = scrollRoot.scrollTop + (headingRect.top - scrollRect.top) - SCROLL_OFFSET;
    scrollRoot.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    setActiveId(heading.id);
  };

  if (headings.length === 0) {
    return (
      <aside className="hidden lg:block lg:fixed lg:top-6 lg:right-[calc(50%+324px)] lg:w-[220px] xl:w-[260px]">
        <div className="rounded-2xl bg-wechat-white p-4 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_40px_-12px_rgba(0,0,0,0.4)]">
          <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-wechat-text">
            <List className="h-4 w-4 text-wechat-nickname" />
            章节目录
          </h3>
          <p className="py-4 text-center text-xs text-wechat-time">暂无标题</p>
        </div>
      </aside>
    );
  }

  return (
    <aside className="hidden lg:block lg:fixed lg:top-6 lg:right-[calc(50%+324px)] lg:w-[220px] xl:w-[260px]">
      <div
        ref={containerRef}
        className="no-scrollbar lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto lg:overscroll-contain"
      >
        <div className="rounded-2xl bg-wechat-white p-4 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_40px_-12px_rgba(0,0,0,0.4)]">
          <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-wechat-text">
            <List className="h-4 w-4 text-wechat-nickname" />
            章节目录
          </h3>
          <nav className="space-y-0.5">
            {headings.map((h) => (
              <a
                key={h.id}
                href={`#${h.id}`}
                onClick={(e) => handleClick(e, h)}
                className={`block rounded-md px-2 py-1.5 text-[13px] leading-snug transition-colors ${
                  h.level === 3 ? "ml-3" : ""
                } ${
                  activeId === h.id
                    ? "bg-wechat-nickname/10 font-medium text-wechat-nickname"
                    : "text-wechat-time hover:bg-wechat-hover hover:text-wechat-text dark:hover:bg-white/5"
                }`}
                style={{
                  paddingLeft: h.level === 3 ? "1.5rem" : "0.5rem",
                }}
              >
                <span className="line-clamp-2">{h.text}</span>
              </a>
            ))}
          </nav>
        </div>
      </div>
    </aside>
  );
}
