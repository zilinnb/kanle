import { Comment } from "./mock-data";

/**
 * 在评论列表中查找指定评论的父评论（被回复的目标）。
 *
 * 优先级：
 * 1. replyToId 精确匹配（新数据）— 100% 可靠
 * 2. replyTo (author name) + 时间戳约束 — 旧数据 fallback，选择同名字中 createdAt 最近且不晚于子评论的一条
 *
 * 这解决了用 author name 查找父评论时，同名评论导致"回复 A 却匹配到 B"的错乱问题。
 */
export function findParentComment(reply: Comment, allComments: Comment[]): Comment | undefined {
  if (reply.replyToId) {
    const byId = allComments.find((c) => c.id === reply.replyToId);
    if (byId) return byId;
  }
  if (!reply.replyTo) return undefined;

  const replyTime = new Date(reply.createdAt).getTime();
  let best: Comment | undefined;
  let bestTime = -Infinity;
  for (const c of allComments) {
    if (c.id === reply.id) continue;
    if (c.author !== reply.replyTo) continue;
    const t = new Date(c.createdAt).getTime();
    if (t > replyTime) continue; // 父评论必须在子评论之前
    if (t > bestTime) {
      bestTime = t;
      best = c;
    }
  }
  return best;
}

/**
 * 沿回复链向上查找根评论 ID（顶级评论）。
 * 用 findParentComment 逐级向上，避免用 author name 直接 find 导致的同名歧义。
 */
export function findRootCommentId(reply: Comment, allComments: Comment[]): string | null {
  let current: Comment | undefined = reply;
  const visited = new Set<string>();
  while (current && (current.replyToId || current.replyTo)) {
    if (visited.has(current.id)) break; // 防御循环
    visited.add(current.id);
    const parent = findParentComment(current, allComments);
    if (!parent) break;
    current = parent;
  }
  // current 指向链顶；若它没有 replyTo 则是顶级评论
  if (current && !current.replyTo && !current.replyToId) return current.id;
  return current ? current.id : null;
}
