"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Play, Pause, Music2, Link as LinkIcon, FileText } from "lucide-react";
import type { Post, PostMusic, PostImage } from "@/lib/mock-data";
import { getImageSrc } from "@/lib/post-image";
import { toAbsoluteUrl, toHttps } from "@/lib/upload";
import { renderContent } from "@/lib/sanitize";
import { useMusicPlayer } from "@/lib/music-player-store";

type TileKind = "image" | "video" | "music" | "link" | "text" | "article";

interface ProfilePostCardProps {
  post: Post;
}

function resolveCover(url: string | undefined | null): string {
  if (!url) return "";
  return toHttps(toAbsoluteUrl(url));
}

function buildCover(post: Post): { kind: TileKind; cover: string; text: string } {
  const contentText = (post.content || "").replace(/<[^>]*>/g, "").trim();

  // 文章类型优先：用 cover 字段作为缩略图，标题/摘要单独处理
  if (post.type === "article") {
    return { kind: "article", cover: resolveCover(post.cover), text: post.title || contentText };
  }

  if (post.images && post.images.length > 0) {
    return { kind: "image", cover: resolveCover(getImageSrc(post.images[0])), text: contentText };
  }
  if (post.video) {
    return { kind: "video", cover: resolveCover(post.video.cover), text: contentText };
  }
  if (post.music) {
    return { kind: "music", cover: resolveCover(post.music.cover), text: post.music.name || contentText };
  }
  if (post.linkCard) {
    return { kind: "link", cover: resolveCover(post.linkCard.image), text: post.linkCard.title || contentText };
  }
  return { kind: "text", cover: "", text: contentText || "动态" };
}

function formatMusicInfo(music: PostMusic): { title: string; subtitle?: string } {
  function clean(s: string): string {
    return s
      .replace(/ - .*?音乐解析$/gi, "")
      .replace(/音乐解析$/gi, "")
      .replace(/@\S+/g, "")
      .replace(/汽水音乐/g, "")
      .replace(/网易云音乐/g, "")
      .replace(/QQ音乐/g, "")
      .replace(/酷狗音乐/g, "")
      .replace(/酷我音乐/g, "")
      .trim();
  }

  let name = clean(music.name || "");
  let artist = clean(music.artist || "");

  if (!artist && name.includes(" - ")) {
    const parts = name.split(" - ");
    name = clean(parts[0]);
    artist = clean(parts.slice(1).join(" - "));
  }

  if (!name && music.name) {
    name = clean(music.name);
  }

  return {
    title: name || "未知歌曲",
    subtitle: artist || undefined,
  };
}

function FadeThumb({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <Image
      src={src}
      alt={alt}
      fill
      onLoad={() => setLoaded(true)}
      className={`object-cover transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"}`}
      sizes="64px"
      unoptimized
    />
  );
}

/**
 * 归档页图片缩略图 — 微信式正方形拼图 mosaic
 * 1=满，2=2列，3=3列，4=2x2，5=3x2(1空)，6=英雄布局(大2x2+5小)，7/8=3x3(留空)，9=3x3满
 */
function ArchiveImageMosaic({ images }: { images: PostImage[] }) {
  const count = Math.min(images.length, 9);
  const visible = images.slice(0, 9);

  let gridClass: string;
  let hero = false;
  if (count === 1) gridClass = "grid-cols-1 grid-rows-1";
  else if (count === 2) gridClass = "grid-cols-2 grid-rows-1";
  else if (count === 3) gridClass = "grid-cols-3 grid-rows-1";
  else if (count === 4) gridClass = "grid-cols-2 grid-rows-2";
  else if (count === 5) gridClass = "grid-cols-3 grid-rows-2";
  else if (count === 6) { gridClass = "grid-cols-3 grid-rows-3"; hero = true; }
  else gridClass = "grid-cols-3 grid-rows-3";

  const heroPositions = [
    { gridColumn: "1 / 3", gridRow: "1 / 3" },
    { gridColumn: "3", gridRow: "1" },
    { gridColumn: "3", gridRow: "2" },
    { gridColumn: "1", gridRow: "3" },
    { gridColumn: "2", gridRow: "3" },
    { gridColumn: "3", gridRow: "3" },
  ];

  return (
    <div className={`grid ${gridClass} h-full w-full gap-[1px]`}>
      {visible.map((img, i) => (
        <div
          key={i}
          className="relative overflow-hidden bg-black/5 dark:bg-white/5"
          style={hero ? heroPositions[i] : undefined}
        >
          <Image
            src={resolveCover(getImageSrc(img))}
            alt=""
            fill
            sizes="64px"
            className="object-cover"
            unoptimized
          />
        </div>
      ))}
    </div>
  );
}

function DefaultCover({ kind }: { kind: Exclude<TileKind, "image" | "video" | "text"> }) {
  const configs = {
    music: {
      className: "from-rose-50 to-purple-100 dark:from-rose-900/20 dark:to-purple-900/20",
      icon: <Music2 className="h-4 w-4 text-rose-400/80" />,
    },
    link: {
      className: "from-sky-50 to-blue-100 dark:from-sky-900/20 dark:to-blue-900/20",
      icon: <LinkIcon className="h-4 w-4 text-sky-400/80" />,
    },
    article: {
      className: "from-amber-50 to-orange-100 dark:from-amber-900/20 dark:to-orange-900/20",
      icon: <FileText className="h-4 w-4 text-amber-500/80" />,
    },
  };
  const config = configs[kind];
  return (
    <div
      className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${config.className}`}
    >
      {config.icon}
    </div>
  );
}

export default function ProfilePostCard({ post }: ProfilePostCardProps) {
  const router = useRouter();
  const { kind, cover, text } = buildCover(post);

  // 文章类型跳转到文章详情页，动态跳转到动态详情页
  const goDetail = () =>
    router.push(
      post.type === "article"
        ? `/articles/${post.shortId || post.id}`
        : `/moments/${post.shortId || post.id}`
    );

  // 文章类型：链接卡片样式（左封面 + 右标题/摘要），与首页 PostCard 一致
  if (kind === "article") {
    return <ProfileArticleCard post={post} cover={cover} goDetail={goDetail} />;
  }

  // 纯文本动态：无缩略图，文字直接显示在灰色背景块上
  if (kind === "text") {
    return (
      <article
        onClick={goDetail}
        className="cursor-pointer px-4 py-1.5 sm:px-5 md:px-6"
      >
        <div className="max-w-[320px] rounded-md bg-wechat-bubble px-2.5 py-1.5 transition-opacity active:opacity-80 dark:bg-wechat-bubble">
          <div
            className="rich-content text-[14px] leading-[20px] text-wechat-text"
            dangerouslySetInnerHTML={{ __html: renderContent(post.content || text) }}
          />
        </div>
      </article>
    );
  }

  // 音乐卡片
  if (kind === "music" && post.music) {
    return <ProfileMusicCard post={post} cover={cover} goDetail={goDetail} />;
  }

  // 链接卡片
  if (kind === "link" && post.linkCard) {
    return <ProfileLinkCard post={post} cover={cover} goDetail={goDetail} />;
  }

  // 图片 / 视频 — 左缩略图 + 右文本布局，整卡可点击跳转详情
  return (
    <article
      className="flex cursor-pointer items-start gap-3 px-4 py-1.5 transition-opacity active:opacity-80 sm:px-5 md:px-6"
      onClick={goDetail}
    >
      {/* Left: thumbnail */}
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded bg-black/5 dark:bg-white/5">
        {kind === "image" && post.images && post.images.length > 0 ? (
          <ArchiveImageMosaic images={post.images} />
        ) : cover ? (
          <FadeThumb src={cover} alt="" />
        ) : kind === "video" ? (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-gray-700 to-gray-900">
            <Play className="h-5 w-5 text-white/70" fill="currentColor" />
          </div>
        ) : (
          <DefaultCover kind="link" />
        )}

        {/* Type badge for link */}
        {cover && kind === "link" && (
          <div className="absolute left-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-black/50 text-white">
            <LinkIcon className="h-2 w-2" />
          </div>
        )}

        {/* Video play overlay */}
        {kind === "video" && cover && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-black/45 text-white">
              <Play className="h-3 w-3 fill-current" />
            </div>
          </div>
        )}
      </div>

      {/* Right: text content */}
      <div className="min-w-0 flex-1 pt-1">
        {post.content ? (
          <div
            className="rich-content line-clamp-2 text-[14px] leading-[20px] text-wechat-text"
            dangerouslySetInnerHTML={{ __html: renderContent(post.content) }}
          />
        ) : (
          <p className="line-clamp-2 text-[14px] leading-[20px] text-wechat-time">
            {kind === "link" && post.linkCard?.title ? post.linkCard.title : ""}
          </p>
        )}
      </div>
    </article>
  );
}

/**
 * 音乐卡片 — 点击整卡跳转详情页（不在归档页播放音乐）
 */
function ProfileMusicCard({ post, cover, goDetail }: { post: Post; cover: string; goDetail: () => void }) {
  const music = post.music;
  const activePostId = useMusicPlayer((s) => s.activePostId);
  const isPlaying = useMusicPlayer((s) => s.isPlaying);

  const isThisActive = activePostId === post.id;
  const isThisPlaying = isThisActive && isPlaying;

  const hasContent = !!(post.content && post.content.trim());
  const musicInfo = music ? formatMusicInfo(music) : { title: "" };
  const displayText = musicInfo.subtitle
    ? `${musicInfo.title} - ${musicInfo.subtitle}`
    : musicInfo.title;

  return (
    <article
      onClick={goDetail}
      className="cursor-pointer px-4 py-1.5 sm:px-5 md:px-6"
    >
      <div className="max-w-[280px] rounded-md bg-wechat-bubble px-2.5 py-2 transition-opacity active:opacity-80 dark:bg-wechat-bubble">
        {/* 文本内容（如有）显示在灰色卡片内部上方 */}
        {hasContent && (
          <div
            className="rich-content mb-2 text-[14px] leading-[20px] text-wechat-text"
            dangerouslySetInnerHTML={{ __html: renderContent(post.content) }}
          />
        )}

        {/* 音乐行：左侧封面 + 播放状态图标，右侧歌名 */}
        <div className="flex w-full items-center gap-2.5 text-left">
          {/* 封面 48x48 + 播放状态指示 */}
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded bg-black/5 dark:bg-white/5">
            {cover ? (
              <Image
                src={cover}
                alt=""
                width={48}
                height={48}
                className="h-full w-full object-cover"
                unoptimized
              />
            ) : (
              <DefaultCover kind="music" />
            )}
            {/* 播放状态指示（非交互，仅显示） */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/25">
              {isThisPlaying ? (
                <Pause className="h-4 w-4 fill-current text-white" />
              ) : (
                <Play className="h-4 w-4 fill-current translate-x-[1px] text-white" />
              )}
            </div>
          </div>

          {/* 歌名 - 歌手 */}
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-[13px] leading-[18px] text-wechat-text">
              {displayText}
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}

/**
 * 链接卡片 — 点击整卡跳转详情页（不在归档页打开链接）
 */
function ProfileLinkCard({ post, cover, goDetail }: { post: Post; cover: string; goDetail: () => void }) {
  const hasContent = !!(post.content && post.content.trim());

  // 无文本内容时：不使用灰色背景容器，直接显示链接行
  if (!hasContent) {
    return (
      <article
        onClick={goDetail}
        className="cursor-pointer px-4 py-1.5 sm:px-5 md:px-6"
      >
        <div className="flex max-w-[280px] w-full items-center gap-2.5 transition-opacity active:opacity-80">
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded bg-black/5 dark:bg-white/5">
            {cover ? (
              <Image
                src={cover}
                alt=""
                width={48}
                height={48}
                className="h-full w-full object-cover"
                unoptimized
              />
            ) : (
              <DefaultCover kind="link" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-[13px] leading-[18px] text-wechat-link">
              {post.linkCard!.title || post.linkCard!.url}
            </p>
          </div>
        </div>
      </article>
    );
  }

  // 有文本内容时：灰色背景容器，文本在上方，链接行在下方
  return (
    <article
      onClick={goDetail}
      className="cursor-pointer px-4 py-1.5 sm:px-5 md:px-6"
    >
      <div className="max-w-[280px] rounded-md bg-wechat-bubble px-2.5 py-2 transition-opacity active:opacity-80 dark:bg-wechat-bubble">
        <div
          className="rich-content mb-2 text-[14px] leading-[20px] text-wechat-text"
          dangerouslySetInnerHTML={{ __html: renderContent(post.content) }}
        />
        <div className="flex w-full items-center gap-2.5 transition-opacity active:opacity-80">
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded bg-black/5 dark:bg-white/5">
            {cover ? (
              <Image
                src={cover}
                alt=""
                width={48}
                height={48}
                className="h-full w-full object-cover"
                unoptimized
              />
            ) : (
              <DefaultCover kind="link" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-[13px] leading-[18px] text-wechat-link">
              {post.linkCard!.title || post.linkCard!.url}
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}

/**
 * 文章卡片 — 左封面 + 右标题/摘要，与首页 PostCard 文章卡片样式一致
 * 点击整卡跳转文章详情页
 */
function ProfileArticleCard({ post, cover, goDetail }: { post: Post; cover: string; goDetail: () => void }) {
  // excerpt 为空时从 content 提取纯文本作为摘要 fallback
  const excerpt =
    post.excerpt ||
    (post.content || "")
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .trim();
  return (
    <article
      onClick={goDetail}
      className="cursor-pointer px-4 py-1.5 sm:px-5 md:px-6"
    >
      <div
        className="flex w-full max-w-[280px] items-stretch overflow-hidden rounded-[8px] bg-[#f2f2f2] transition-opacity active:opacity-80 dark:bg-[#2a2a30] md:max-w-[320px]"
      >
        {/* 左侧方形封面 */}
        <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden bg-black/5 dark:bg-white/5 md:h-[80px] md:w-[80px]">
          {cover ? (
            <Image
              src={cover}
              alt={post.title || "文章封面"}
              fill
              className="h-full w-full object-cover"
              sizes="80px"
              unoptimized
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <FileText className="h-6 w-6 text-black/30 dark:text-white/30 md:h-7 md:w-7" />
            </div>
          )}
        </div>
        {/* 右侧标题 + 摘要 */}
        <div className="flex min-w-0 flex-1 flex-col justify-center bg-white/35 px-3 dark:bg-white/[0.04]">
          <p className="line-clamp-1 text-[14px] font-medium leading-[20px] text-black/[0.87] dark:text-white/90 md:text-[15px] md:leading-[21px]">
            {post.title || "无标题文章"}
          </p>
          {excerpt && (
            <p className="mt-0.5 line-clamp-2 text-[12px] leading-[15px] text-black/50 dark:text-white/50 md:text-[13px] md:leading-[16px]">
              {excerpt}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
