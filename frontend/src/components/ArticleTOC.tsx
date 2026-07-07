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

  useEffect(() => {
    if (headings.length === 0) return;

    const scrollRoot = document.getElementById("scroll-root");
    if (!scrollRoot) return;

    const onScroll = () => {
      const scrollTop = scrollRoot.scrollTop;
      let current = "";
      for (const h of headings) {
        const top = h.element.offsetTop;
        if (top <= scrollTop + 100) {
          current = h.id;
        }
      }
      setActiveId(current);
    };

    scrollRoot.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => scrollRoot.removeEventListener("scroll", onScroll);
  }, [headings]);

  const handleClick = (e: React.MouseEvent, heading: Heading) => {
    e.preventDefault();
    const scrollRoot = document.getElementById("scroll-root");
    if (!scrollRoot || !heading.element) return;
    const top = heading.element.offsetTop - 20;
    scrollRoot.scrollTo({ top, behavior: "smooth" });
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
