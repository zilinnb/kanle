"use client";

import { Film } from "lucide-react";
import type { PostDouban } from "@/lib/mock-data";
import { getImageUrl } from "@/lib/site-settings-store";
import LazyImage from "@/components/LazyImage";

interface DoubanEmbedCardProps {
  item: PostDouban;
  className?: string;
}

export default function DoubanEmbedCard({ item, className }: DoubanEmbedCardProps) {
  const descParts: string[] = [];
  if (item.rating > 0) {
    descParts.push(`★ ${item.rating}`);
  }
  if (item.statusLabel) {
    descParts.push(item.statusLabel);
  }
  const desc = descParts.join(" · ") || item.intro || "";

  return (
    <a
      href={item.link}
      target="_blank"
      rel="noopener noreferrer"
      className={`link-card ${className || ""}`}
    >
      {item.cover ? (
        <span className="link-card-image">
          <LazyImage
            src={getImageUrl(item.cover)}
            alt=""
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        </span>
      ) : (
        <span className="link-card-image link-card-image-placeholder">
          <Film className="h-5 w-5" />
        </span>
      )}
      <span className="link-card-body">
        <span className="link-card-title">{item.title}</span>
        {desc && <span className="link-card-desc">{desc}</span>}
      </span>
    </a>
  );
}
