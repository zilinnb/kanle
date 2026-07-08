"use client";

import { Film } from "lucide-react";
import DoubanConfigSection from "../settings/DoubanConfigSection";

export default function AdminDouban() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-bold text-adm-text">
          <Film className="h-5 w-5 text-adm-text-secondary" />
          豆瓣设置
        </h2>
        <p className="mt-1 text-sm text-adm-text-secondary">
          配置豆瓣用户 ID，在首页左侧边栏展示你的电影、图书、音乐收藏
        </p>
      </div>

      <div className="rounded-2xl border border-adm-border bg-adm-card p-5 shadow-sm">
        <DoubanConfigSection />
      </div>
    </div>
  );
}
