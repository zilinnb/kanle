"use client";

import Image from "next/image";
import { Heart } from "lucide-react";
import { actorAvatarUrl } from "@/lib/avatar";

interface PostDetailLikesProps {
  likes: string[];
}

const VISITOR_NAMES = new Set(["访客", "游客"]);

export default function PostDetailLikes({ likes }: PostDetailLikesProps) {
  if (likes.length === 0) return null;

  return (
    <div className="flex items-start gap-2 rounded-[4px] bg-wechat-bubble px-3 py-2">
      <Heart className="mt-[5px] h-3.5 w-3.5 shrink-0 fill-red-500 text-red-500" />
      <div className="flex flex-1 flex-wrap gap-1">
        {likes.map((name, idx) => (
          <div
            key={`${name}-${idx}`}
            className="relative h-7 w-7 shrink-0 overflow-hidden rounded-[3px] bg-black/5 dark:bg-white/5"
            title={name}
          >
            <Image
              src={actorAvatarUrl("", name, 64)}
              alt={name}
              fill
              className="object-cover"
              sizes="28px"
              unoptimized
            />
          </div>
        ))}
      </div>
    </div>
  );
}
