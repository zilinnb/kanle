"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Users, FileText, BookText, MessageCircle, Heart, TrendingUp, TrendingDown,
  Pin, ExternalLink, Plus, X, Settings2, BookUser, Music, Megaphone,
  LayoutDashboard, ChevronRight, Library, Cloud,
} from "lucide-react";
import dynamic from "next/dynamic";
import { apiFetch, getToken } from "@/lib/api-fetch";
import { renderTextWithEmoji } from "@/lib/emoji";

// echarts 包含 canvas/window 操作，必须客户端动态加载避免 SSR 报错
const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

interface TimeSeriesItem {
  date: string;
  label: string;
  posts: number;
  articles: number;
  comments: number;
  likes: number;
}

interface RecentPost {
  id: string;
  content: string;
  createdAt: string;
  pinned: boolean;
  author: string;
}

interface RecentComment {
  id: string;
  author: string;
  content: string;
  createdAt: string;
  postAuthor: string;
  postContent: string;
}

interface Stats {
  users: number;
  posts: number;
  articles: number;
  comments: number;
  likes: number;
  timeSeries: TimeSeriesItem[];
  recentPosts: RecentPost[];
  recentComments: RecentComment[];
}

const ALL_SHORTCUTS = [
  { key: "frontend-publish", label: "前往发布动态", icon: ExternalLink, href: "/", external: true, desc: "在前端发布新动态" },
  { key: "profile", label: "编辑个人资料", icon: Users, href: "/admin/users", desc: "修改头像、昵称、签名" },
  { key: "posts", label: "动态管理", icon: FileText, href: "/admin/posts", desc: "管理已发布的动态" },
  { key: "comments", label: "评论管理", icon: MessageCircle, href: "/admin/comments", desc: "查看和管理评论" },
  { key: "ads", label: "广告管理", icon: Megaphone, href: "/admin/ads", desc: "管理广告动态" },
  { key: "friends", label: "友情链接", icon: BookUser, href: "/admin/friends", desc: "管理友情链接" },
  { key: "music", label: "音乐管理", icon: Music, href: "/admin/plugins", desc: "管理音乐插件和背景音乐" },
  { key: "media", label: "媒体库", icon: Library, href: "/admin/media", desc: "管理图片、视频、音频文件" },
  { key: "storage", label: "云端存储", icon: Cloud, href: "/admin/storage", desc: "管理云存储服务商配置" },
  { key: "settings", label: "网站设置", icon: Settings2, href: "/admin/settings", desc: "配置网站基本信息" },
];

function loadShortcuts(): string[] {
  try {
    const saved = localStorage.getItem("admin_shortcuts");
    if (saved) return JSON.parse(saved);
  } catch {}
  return ["frontend-publish", "profile", "music", "settings"];
}

function saveShortcuts(keys: string[]) {
  localStorage.setItem("admin_shortcuts", JSON.stringify(keys));
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "刚刚";
  if (min < 60) return `${min}分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}小时前`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}天前`;
  return new Date(dateStr).toLocaleDateString("zh-CN");
}

/** 解码 HTML 实体（如 &nbsp; &amp; 等），用于展示后端返回的已去标签文本 */
function decodeHtmlEntities(text: string): string {
  if (!text) return "";
  const txt = document.createElement("textarea");
  txt.innerHTML = text;
  return txt.value;
}

/** 检测当前是否暗色模式（基于 html.dark 类） */
function useIsDark() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const el = document.documentElement;
    const update = () => setDark(el.classList.contains("dark"));
    update();
    const observer = new MutationObserver(update);
    observer.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return dark;
}

/** echarts 柱状图：近7天活动趋势（动态/评论/点赞） */
function BarChart({ data }: { data: TimeSeriesItem[] }) {
  const isDark = useIsDark();
  const textColor = isDark ? "rgba(255,255,255,0.65)" : "rgba(0,0,0,0.65)";
  const axisLineColor = isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)";

  const option = useMemo(() => ({
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      backgroundColor: isDark ? "rgba(30,30,30,0.95)" : "rgba(255,255,255,0.95)",
      borderColor: axisLineColor,
      textStyle: { color: textColor, fontSize: 12 },
    },
    legend: {
      data: ["动态", "文章", "评论", "点赞"],
      top: 0,
      right: 0,
      icon: "circle",
      itemWidth: 8,
      itemHeight: 8,
      textStyle: { color: textColor, fontSize: 11 },
    },
    grid: { left: "2%", right: "2%", bottom: "2%", top: 36, containLabel: true },
    xAxis: {
      type: "category",
      data: data.map((d) => d.label),
      axisLine: { lineStyle: { color: axisLineColor } },
      axisTick: { show: false },
      axisLabel: { color: textColor, fontSize: 10 },
    },
    yAxis: {
      type: "value",
      minInterval: 1,
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: axisLineColor, type: "dashed" } },
      axisLabel: { color: textColor, fontSize: 10 },
    },
    series: [
      { name: "动态", type: "bar", data: data.map((d) => d.posts), itemStyle: { color: "#3b82f6", borderRadius: [3, 3, 0, 0] }, barGap: "10%", barCategoryGap: "30%" },
      { name: "文章", type: "bar", data: data.map((d) => d.articles), itemStyle: { color: "#8b5cf6", borderRadius: [3, 3, 0, 0] } },
      { name: "评论", type: "bar", data: data.map((d) => d.comments), itemStyle: { color: "#f43f5e", borderRadius: [3, 3, 0, 0] } },
      { name: "点赞", type: "bar", data: data.map((d) => d.likes), itemStyle: { color: "#f59e0b", borderRadius: [3, 3, 0, 0] } },
    ],
  }), [data, isDark, textColor, axisLineColor]);

  return (
    <ReactECharts
      option={option}
      style={{ height: 240, width: "100%" }}
      opts={{ renderer: "svg" }}
      notMerge
    />
  );
}

/** echarts 环形图：内容分布（动态/文章/评论/点赞） */
function DonutChart({ items }: { items: { label: string; value: number; color: string }[] }) {
  const isDark = useIsDark();
  const textColor = isDark ? "rgba(255,255,255,0.65)" : "rgba(0,0,0,0.65)";
  const total = items.reduce((s, i) => s + i.value, 0);

  const option = useMemo(() => ({
    tooltip: {
      trigger: "item",
      formatter: "{b}: {c} ({d}%)",
      backgroundColor: isDark ? "rgba(30,30,30,0.95)" : "rgba(255,255,255,0.95)",
      borderColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)",
      textStyle: { color: textColor, fontSize: 12 },
    },
    legend: {
      orient: "vertical",
      right: 0,
      top: "center",
      icon: "circle",
      itemWidth: 8,
      itemHeight: 8,
      textStyle: { color: textColor, fontSize: 11 },
      formatter: (name: string) => {
        const item = items.find((i) => i.label === name);
        return `${name}  ${item ? item.value : 0}`;
      },
    },
    graphic: {
      type: "text",
      left: "28%",
      top: "center",
      style: {
        text: `{a|${total}}\n{b|总数}`,
        rich: {
          a: { fontSize: 22, fontWeight: 700, fill: isDark ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.9)", align: "center" },
          b: { fontSize: 11, fill: textColor, align: "center" },
        },
        textAlign: "center",
      },
    },
    series: [{
      type: "pie",
      radius: ["55%", "75%"],
      center: ["28%", "50%"],
      avoidLabelOverlap: false,
      label: { show: false },
      labelLine: { show: false },
      itemStyle: { borderColor: isDark ? "rgba(30,30,30,1)" : "rgba(255,255,255,1)", borderWidth: 2 },
      emphasis: { label: { show: true, fontSize: 14, fontWeight: "bold" } },
      data: items.map((i) => ({ name: i.label, value: i.value, itemStyle: { color: i.color } })),
    }],
  }), [items, isDark, textColor, total]);

  return (
    <ReactECharts
      option={option}
      style={{ height: 180, width: "100%" }}
      opts={{ renderer: "svg" }}
      notMerge
    />
  );
}

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [shortcuts, setShortcuts] = useState<string[]>([]);
  const [editingShortcuts, setEditingShortcuts] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/");
      return;
    }
    setShortcuts(loadShortcuts());
    apiFetch("/admin/dashboard")
      .then((res) => res.json())
      .then((data) => setStats(data))
      .catch(() => router.replace("/"))
      .finally(() => setLoading(false));
  }, [router]);

  const toggleShortcut = (key: string) => {
    setShortcuts((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      saveShortcuts(next);
      return next;
    });
  };

  // 趋势计算（今天 vs 昨天）
  const trend = useMemo(() => {
    if (!stats?.timeSeries || stats.timeSeries.length < 2) return null;
    const today = stats.timeSeries[stats.timeSeries.length - 1];
    const yesterday = stats.timeSeries[stats.timeSeries.length - 2];
    const calc = (t: number, y: number) => {
      if (y === 0) return t > 0 ? 100 : 0;
      return Math.round(((t - y) / y) * 100);
    };
    return {
      posts: calc(today.posts, yesterday.posts),
      articles: calc(today.articles, yesterday.articles),
      comments: calc(today.comments, yesterday.comments),
      likes: calc(today.likes, yesterday.likes),
    };
  }, [stats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-adm-border border-t-adm-text" />
      </div>
    );
  }

  const cards = [
    {
      label: "动态", value: stats?.posts || 0, icon: FileText,
      trend: trend?.posts ?? null, color: "text-[#3b82f6]",
    },
    {
      label: "文章", value: stats?.articles || 0, icon: BookText,
      trend: trend?.articles ?? null, color: "text-[#8b5cf6]",
    },
    {
      label: "评论", value: stats?.comments || 0, icon: MessageCircle,
      trend: trend?.comments ?? null, color: "text-[#f43f5e]",
    },
    {
      label: "点赞", value: stats?.likes || 0, icon: Heart,
      trend: trend?.likes ?? null, color: "text-[#f59e0b]",
    },
  ];

  const activeShortcuts = ALL_SHORTCUTS.filter((s) => shortcuts.includes(s.key));
  const inactiveShortcuts = ALL_SHORTCUTS.filter((s) => !shortcuts.includes(s.key));

  const donutItems = [
    { label: "动态", value: stats?.posts || 0, color: "#3b82f6" },
    { label: "文章", value: stats?.articles || 0, color: "#8b5cf6" },
    { label: "评论", value: stats?.comments || 0, color: "#f43f5e" },
    { label: "点赞", value: stats?.likes || 0, color: "#f59e0b" },
  ];

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-adm-input">
          <LayoutDashboard className="h-5 w-5 text-adm-text-secondary" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-adm-text">仪表盘</h2>
          <p className="text-sm text-adm-text-secondary">博客数据概览与快捷操作</p>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-2xl border border-adm-border bg-adm-card p-4 transition-shadow hover:shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-adm-input">
                  <Icon className={`h-[18px] w-[18px] ${card.color}`} />
                </div>
                {card.trend !== null && (
                  <span className={`flex items-center gap-0.5 text-xs font-medium ${card.trend > 0 ? "text-adm-primary" : card.trend < 0 ? "text-adm-danger" : "text-adm-text-tertiary"}`}>
                    {card.trend > 0 ? <TrendingUp className="h-3 w-3" /> : card.trend < 0 ? <TrendingDown className="h-3 w-3" /> : null}
                    {card.trend > 0 ? `+${card.trend}%` : card.trend < 0 ? `${card.trend}%` : "0%"}
                  </span>
                )}
              </div>
              <div className="mt-3 text-2xl font-bold text-adm-text">{card.value}</div>
              <div className="text-xs text-adm-text-secondary">{card.label}</div>
            </div>
          );
        })}
      </div>

      {/* 图表区域 */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* 柱状图 */}
        <div className="rounded-2xl border border-adm-border bg-adm-card p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-adm-text">近7天活动趋势</h3>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#3b82f6]" />动态</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#8b5cf6]" />文章</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#f43f5e]" />评论</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#f59e0b]" />点赞</span>
            </div>
          </div>
          {stats?.timeSeries && <BarChart data={stats.timeSeries} />}
        </div>

        {/* 环形图 */}
        <div className="rounded-2xl border border-adm-border bg-adm-card p-5">
          <h3 className="mb-4 text-sm font-semibold text-adm-text">内容分布</h3>
          <DonutChart items={donutItems} />
        </div>
      </div>

      {/* 快捷操作 */}
      <div className="mt-4 rounded-2xl border border-adm-border bg-adm-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-adm-text">快捷操作</h3>
          <button
            onClick={() => setEditingShortcuts(!editingShortcuts)}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-adm-text-secondary transition-colors hover:bg-adm-card-hover"
          >
            {editingShortcuts ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {editingShortcuts ? "完成" : "自定义"}
          </button>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {activeShortcuts.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.key}
                onClick={() => s.external ? window.open(s.href, "_blank") : router.push(s.href)}
                className="group flex items-center gap-3 rounded-xl border border-adm-border bg-adm-input/50 px-3 py-2.5 text-left transition-colors hover:border-adm-text-tertiary hover:bg-adm-card-hover"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-adm-input">
                  <Icon className="h-4 w-4 text-adm-text-secondary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-adm-text">{s.label}</p>
                  <p className="truncate text-xs text-adm-text-tertiary">{s.desc}</p>
                </div>
                {s.external ? (
                  <ExternalLink className="h-3.5 w-3.5 shrink-0 text-adm-text-tertiary" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-adm-text-tertiary transition-transform group-hover:translate-x-0.5" />
                )}
              </button>
            );
          })}
        </div>

        {editingShortcuts && inactiveShortcuts.length > 0 && (
          <div className="mt-3 border-t border-adm-border pt-3">
            <p className="mb-2 text-xs text-adm-text-tertiary">添加快捷操作</p>
            <div className="flex flex-wrap gap-2">
              {inactiveShortcuts.map((s) => {
                const Icon = s.icon;
                return (
                  <button
                    key={s.key}
                    onClick={() => toggleShortcut(s.key)}
                    className="flex items-center gap-2 rounded-lg border border-dashed border-adm-border bg-adm-input/30 px-3 py-1.5 text-xs text-adm-text-secondary transition-colors hover:border-adm-primary hover:text-adm-primary"
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {s.label}
                    <Plus className="h-3 w-3" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {editingShortcuts && activeShortcuts.length > 0 && (
          <div className="mt-3 border-t border-adm-border pt-3">
            <p className="mb-2 text-xs text-adm-text-tertiary">点击移除</p>
            <div className="flex flex-wrap gap-2">
              {activeShortcuts.map((s) => (
                <button
                  key={s.key}
                  onClick={() => toggleShortcut(s.key)}
                  className="flex items-center gap-2 rounded-lg bg-adm-card-hover px-3 py-1.5 text-xs text-adm-text-secondary transition-colors hover:text-adm-danger"
                >
                  {s.label}
                  <X className="h-3 w-3" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 最近动态 + 最近评论 */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* 最近动态 */}
        <div className="rounded-2xl border border-adm-border bg-adm-card p-5">
          <h3 className="mb-3 text-sm font-semibold text-adm-text">最近动态</h3>
          {stats?.recentPosts && stats.recentPosts.length > 0 ? (
            <div className="space-y-2">
              {stats.recentPosts.map((post) => (
                <div key={post.id} className="flex items-start gap-2.5 rounded-lg p-2 transition-colors hover:bg-adm-card-hover">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-adm-text">{post.author}</span>
                      {post.pinned && <Pin className="h-3 w-3 text-adm-primary" />}
                      <span className="text-xs text-adm-text-tertiary">{timeAgo(post.createdAt)}</span>
                    </div>
                    <p className="mt-0.5 line-clamp-1 text-xs text-adm-text-secondary">
                      {decodeHtmlEntities(post.content) || "(无文字内容)"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-6 text-center text-xs text-adm-text-tertiary">暂无动态</p>
          )}
        </div>

        {/* 最近评论 */}
        <div className="rounded-2xl border border-adm-border bg-adm-card p-5">
          <h3 className="mb-3 text-sm font-semibold text-adm-text">最近评论</h3>
          {stats?.recentComments && stats.recentComments.length > 0 ? (
            <div className="space-y-2">
              {stats.recentComments.map((comment) => (
                <div key={comment.id} className="flex items-start gap-2.5 rounded-lg p-2 transition-colors hover:bg-adm-card-hover">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-adm-text">{comment.author}</span>
                      <span className="text-xs text-adm-text-tertiary">{timeAgo(comment.createdAt)}</span>
                    </div>
                    <p
                      className="mt-0.5 line-clamp-1 text-xs text-adm-text-secondary"
                      dangerouslySetInnerHTML={{ __html: renderTextWithEmoji(comment.content) }}
                    />
                    {comment.postContent && (
                      <p className="mt-0.5 line-clamp-1 text-[11px] text-adm-text-tertiary">
                        <span className="text-adm-text-tertiary/70">来自</span> {comment.postAuthor}：{decodeHtmlEntities(comment.postContent)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-6 text-center text-xs text-adm-text-tertiary">暂无评论</p>
          )}
        </div>
      </div>
    </div>
  );
}
