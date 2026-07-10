import { Heart } from "lucide-react";
import { useState } from "react";
import { Comment, formatCommentTime } from "@/lib/mock-data";
import { renderTextWithEmoji } from "@/lib/emoji";
import { cravatarUrl, actorAvatarUrl } from "@/lib/avatar";

type LikeInfo = { name: string; email?: string };

interface InteractionBubbleProps {
  likes: LikeInfo[];
  comments: Comment[];
  onReply?: (commentId: string) => void;
  /** 博主邮箱，用于识别博主评论并显示绿色点标识 */
  ownerEmail?: string;
  /** 详情页模式：隐藏点赞文字，只渲染评论列表 */
  hideLikes?: boolean;
  /** 详情页模式：点赞和评论显示头像（微信朋友圈详情风格） */
  showAvatars?: boolean;
}

const VISITOR_NAMES = new Set(["访客", "游客"]);

const MAX_DISPLAY_NAMES = 5;
/** 评论达到此数量时启用折叠/展开（5 条即触发，折叠时显示 4 条，展开后多出至少 1 条） */
const COMMENT_COLLAPSE_THRESHOLD = 5;

/**
 * 兼容旧格式（string[]）和新格式（{name, email}[]）的点赞数据
 */
function normalizeLike(like: LikeInfo | string): LikeInfo {
  return typeof like === "string" ? { name: like } : like;
}

/**
 * 生成点赞去重 key：
 * - 有 email → 按 email 去重（同一人跨设备/跨名只算一次）
 * - 无 email → 按 name 去重（匿名访客同名视为同一人）
 *
 * 同名不同邮箱视为不同人，各自显示头像和计数。
 */
function likeDedupeKey(like: LikeInfo): string {
  return like.email && like.email !== "" ? `email:${like.email}` : `name:${like.name}`;
}

function likeAvatarUrl(like: LikeInfo, size = 40, nameToEmail?: Map<string, string>): string {
  if (like.email) return cravatarUrl(like.email, size);
  // 点赞记录无 email 时，尝试从评论列表同名者补充 email
  const mappedEmail = nameToEmail?.get(like.name);
  if (mappedEmail) return cravatarUrl(mappedEmail, size);
  return actorAvatarUrl("", like.name, size);
}

function commentAvatarUrl(comment: Comment, size = 56): string {
  if (comment.email) return cravatarUrl(comment.email, size);
  return actorAvatarUrl("", comment.author, size);
}

/**
 * 将点赞名列表转换为显示文本（微信朋友圈风格）。
 *
 * 去重规则：命名用户按 (email || name) 去重——同名不同邮箱视为不同人，
 * 各自计入总数。匿名访客（"访客"/"游客"）不去重，每条独立计数。
 *
 * 显示规则：
 * - 仅访客时：1个访客显示"访客觉得很赞"，≥2个访客显示"N人觉得很赞"
 * - 仅昵称时：≤5个显示全部昵称，>5个显示前5个+"等N人觉得很赞"
 * - 昵称+访客时：显示昵称+"等N人觉得很赞"（访客只计入总数不显示）
 * - 末尾统一追加"觉得很赞"
 */
function formatLikes(likes: LikeInfo[]): string {
  const normalized = likes.map(normalizeLike);
  // 命名用户按 (email || name) 去重，保留首次出现的记录
  const namedUsers = Array.from(
    new Map(
      normalized
        .filter((l) => !VISITOR_NAMES.has(l.name))
        .map((l) => [likeDedupeKey(l), l] as const)
    ).values()
  );
  const displayNames = namedUsers.map((l) => l.name);
  const visitorCount = normalized.filter((l) => VISITOR_NAMES.has(l.name)).length;
  const total = namedUsers.length + visitorCount;

  if (total === 0) return "";

  // 仅访客，无昵称
  if (namedUsers.length === 0) {
    if (visitorCount === 1) return "访客觉得很赞";
    return `${visitorCount}人觉得很赞`;
  }

  // 昵称超过上限：只显示前5个 + 等N人
  if (displayNames.length > MAX_DISPLAY_NAMES) {
    const shown = displayNames.slice(0, MAX_DISPLAY_NAMES);
    return `${shown.join("，")}等 ${total} 人觉得很赞`;
  }

  // 有访客：显示昵称 + 等N人（访客计入总数但不显示）
  if (visitorCount > 0) {
    return `${displayNames.join("，")}等 ${total} 人觉得很赞`;
  }

  // 纯昵称，无访客：全部显示
  return `${displayNames.join("，")}觉得很赞`;
}

export default function InteractionBubble({
  likes,
  comments,
  onReply,
  hideLikes = false,
  showAvatars = false,
}: InteractionBubbleProps) {
  const [expanded, setExpanded] = useState(false);

  if (likes.length === 0 && comments.length === 0) return null;

  // 从评论列表构建 name → email 映射，用于补充无 email 点赞的头像
  const nameToEmail = new Map<string, string>();
  for (const c of comments) {
    if (c.email && c.author && !nameToEmail.has(c.author)) {
      nameToEmail.set(c.author, c.email);
    }
  }

  const normalizedLikes = likes.map(normalizeLike);
  // 详情页模式下，对命名用户按 (email || name) 去重——同名不同邮箱视为不同人，
  // 各自显示头像。匿名访客（"访客"/"游客"）不去重，每条独立显示。
  // 这样详情页头像总数 = formatLikes 计算的 total（命名用户去重数 + 全部访客数），保持一致。
  const displayLikes = showAvatars
    ? (() => {
        const seen = new Set<string>();
        const result: LikeInfo[] = [];
        for (const l of normalizedLikes) {
          if (VISITOR_NAMES.has(l.name)) {
            result.push(l);
          } else {
            const key = likeDedupeKey(l);
            if (!seen.has(key)) {
              seen.add(key);
              result.push(l);
            }
          }
        }
        return result;
      })()
    : normalizedLikes;
  const likesText = formatLikes(normalizedLikes);

  const shouldCollapse = comments.length >= COMMENT_COLLAPSE_THRESHOLD;
  const displayedComments = shouldCollapse && !expanded
    ? comments.slice(0, COMMENT_COLLAPSE_THRESHOLD - 1)
    : comments;

  return (
    <div className="relative mt-[6px] rounded-[4px] bg-wechat-bubble px-3 py-2">
      {likes.length > 0 && !hideLikes && (
        showAvatars ? (
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1.5">
            <Heart className="h-4 w-4 shrink-0 text-wechat-nickname" />
            {displayLikes.map((like, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={`${like.name}-${i}`}
                src={likeAvatarUrl(like, 48, nameToEmail)}
                alt={like.name}
                className="h-[24px] w-[24px] shrink-0 rounded-[4px] object-cover bg-black/5 dark:bg-white/10"
              />
            ))}
          </div>
        ) : (
          <div className="flex items-start gap-1.5 text-[14px] font-normal leading-[22px] text-wechat-nickname md:text-[15px]">
            <Heart className="mt-[2.5px] h-4 w-4 shrink-0 text-wechat-nickname md:mt-[2px] md:h-[18px] md:w-[18px]" />
            <span className="break-all">{likesText}</span>
          </div>
        )
      )}

      {likes.length > 0 && !hideLikes && comments.length > 0 && (
        <div className="my-1.5 h-px bg-wechat-divider" />
      )}

      {comments.length > 0 && (
        showAvatars ? (
          <ul className="space-y-2">
            {displayedComments.map((comment) => {
              return (
                <li key={comment.id} id={`comment-${comment.id}`} className="break-all scroll-mt-20 flex items-start gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={commentAvatarUrl(comment, 64)}
                    alt={comment.author}
                    className="h-8 w-8 shrink-0 rounded-[4px] object-cover bg-black/5 dark:bg-white/10 mt-0.5"
                  />
                  <div className="min-w-0 flex-1 flex items-start justify-between gap-2">
                    <div
                      onClick={() => onReply?.(comment.id)}
                      className="min-w-0 flex-1 cursor-pointer text-left text-[15px] leading-[22px] transition-opacity hover:opacity-70"
                    >
                      {comment.website ? (
                        <a
                          href={comment.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-wechat-nickname transition-opacity hover:opacity-60 active:opacity-40"
                        >
                          {comment.author}
                        </a>
                      ) : (
                        <span className="text-wechat-nickname">{comment.author}</span>
                      )}
                      {comment.replyTo && (
                        <>
                          <span className="px-1 text-gray-400">回复</span>
                          <span className="text-wechat-nickname">{comment.replyTo}</span>
                        </>
                      )}
                      <span
                        className="text-wechat-text"
                        dangerouslySetInnerHTML={{ __html: renderTextWithEmoji("：" + comment.content) }}
                      />
                    </div>
                    <span className="shrink-0 text-[12px] leading-[18px] text-wechat-time mt-0.5 whitespace-nowrap">
                      {formatCommentTime(comment.createdAt)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <ul className="space-y-[3px] text-[15px] font-normal leading-[24px] md:text-[16px]">
            {displayedComments.map((comment) => {
              return (
                <li key={comment.id} id={`comment-${comment.id}`} className="break-all scroll-mt-20 rounded px-1 -mx-1">
                  <div
                    onClick={() => onReply?.(comment.id)}
                    className="min-w-0 cursor-pointer text-left transition-colors hover:text-wechat-link"
                  >
                    {comment.website ? (
                      <a
                        href={comment.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-wechat-nickname transition-opacity hover:opacity-60 active:opacity-40"
                      >
                        {comment.author}
                      </a>
                    ) : (
                      <span className="text-wechat-nickname">{comment.author}</span>
                    )}
                    {comment.replyTo && (
                      <>
                        <span className="px-1 text-gray-400">回复</span>
                        <span className="text-wechat-nickname">{comment.replyTo}</span>
                      </>
                    )}
                    <span
                      className="text-wechat-text"
                      dangerouslySetInnerHTML={{ __html: renderTextWithEmoji("：" + comment.content) }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )
      )}

      {shouldCollapse && (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="mt-1.5 text-[14px] text-[#b2b2b2] transition-opacity hover:opacity-70 active:opacity-50 dark:text-[#888] md:text-[15px]"
        >
          {expanded ? "收起" : "展开"}
        </button>
      )}
    </div>
  );
}
