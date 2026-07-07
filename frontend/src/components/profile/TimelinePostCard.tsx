"use client";

import ProfilePostCard from "@/components/profile/ProfilePostCard";
import type { Post } from "@/lib/mock-data";

interface TimelinePostCardProps {
  post: Post;
}

/**
 * 归档页面时间线动态卡片：使用精简版 ProfilePostCard，
 * 不显示昵称、点赞、评论、操作菜单——模仿微信朋友圈个人归档页。
 */
export default function TimelinePostCard({ post }: TimelinePostCardProps) {
  return <ProfilePostCard post={post} />;
}
