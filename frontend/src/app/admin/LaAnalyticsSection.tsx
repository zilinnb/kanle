"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  BarChart3,
  Users,
  Eye,
  Globe,
  UserPlus,
  Activity,
  RefreshCw,
  ExternalLink,
  AlertCircle,
} from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";

// echarts 仅客户端加载
const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

/** 检测当前是否暗色模式 */
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

/* ============ 51.la 返回数据容错解析 ============ */

interface TrendItem {
  time?: string;
  date?: string;
  pv?: number;
  uv?: number;
  ip?: number;
  sv?: number;
  newUserCount?: number;
  newVisitor?: number;
  bounceRate?: number;
  avgDuration?: number;
}

interface ListItem {
  name?: string;
  title?: string;
  url?: string;
  link?: string;
  count?: number;
  value?: number;
  pv?: number;
}

interface OverviewData {
  trend: unknown;
  activeUser: unknown;
  src: unknown;
  interview: unknown;
  entry: unknown;
  range?: { startDay: string; endDay: string };
  fetchedAt?: string;
}

/** 从 51.la 返回对象中提取列表数据（容错多种结构） */
function extractList(raw: unknown): ListItem[] {
  if (!raw || typeof raw !== "object") return [];
  const obj = raw as Record<string, unknown>;
  // online/data 返回 { topList: [...] }；trend 返回 { data: [...] }；其他可能 { list: [...] }
  let list: unknown = obj.topList ?? obj.list ?? obj.data ?? obj.items ?? obj.rows;
  if (list && typeof list === "object" && !Array.isArray(list)) {
    list = (list as Record<string, unknown>).topList ?? (list as Record<string, unknown>).list ?? (list as Record<string, unknown>).data ?? (list as Record<string, unknown>).items;
  }
  if (Array.isArray(list)) return list as ListItem[];
  if (Array.isArray(raw)) return raw as ListItem[];
  return [];
}

/** 从趋势数据中提取数组 */
function extractTrend(raw: unknown): TrendItem[] {
  if (!raw || typeof raw !== "object") return [];
  const obj = raw as Record<string, unknown>;
  let list: unknown = obj.list ?? obj.data ?? obj.items ?? obj.rows;
  if (list && typeof list === "object" && !Array.isArray(list)) {
    list = (list as Record<string, unknown>).list ?? (list as Record<string, unknown>).data;
  }
  if (Array.isArray(list)) return list as TrendItem[];
  if (Array.isArray(raw)) return raw as TrendItem[];
  return [];
}

/** 获取列表项的名称 */
function itemName(it: ListItem): string {
  return (it.name || it.title || it.url || it.link || "未知").toString();
}

/** 获取列表项的数值 */
function itemValue(it: ListItem): number {
  return Number(it.count ?? it.value ?? it.pv ?? 0) || 0;
}

/* ============ 图表组件 ============ */

/** 趋势折线图：PV / UV / IP / 新访客 / 会话数 */
function TrendLineChart({ data }: { data: TrendItem[] }) {
  const isDark = useIsDark();
  const textColor = isDark ? "rgba(255,255,255,0.65)" : "rgba(0,0,0,0.65)";
  const axisLineColor = isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)";

  const labels = data.map((d) => {
    const t = d.time || d.date || "";
    // 简化为 MM-DD 格式
    const m = t.match(/(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[2]}-${m[3]}` : t;
  });

  const series = [
    { name: "浏览量(PV)", key: "pv", color: "#3b82f6" },
    { name: "访客数(UV)", key: "uv", color: "#8b5cf6" },
    { name: "IP数", key: "ip", color: "#10b981" },
    { name: "新访客数", key: "newUserCount", altKey: "newVisitor", color: "#f59e0b" },
    { name: "会话数", key: "sv", color: "#f43f5e" },
  ];

  const option = useMemo(() => ({
    tooltip: {
      trigger: "axis",
      backgroundColor: isDark ? "rgba(30,30,30,0.95)" : "rgba(255,255,255,0.95)",
      borderColor: axisLineColor,
      textStyle: { color: textColor, fontSize: 12 },
    },
    legend: {
      data: series.map((s) => s.name),
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
      boundaryGap: false,
      data: labels,
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
    series: series.map((s) => {
      const key = s.key as keyof TrendItem;
      const altKey = s.altKey as keyof TrendItem;
      return {
        name: s.name,
        type: "line",
        smooth: true,
        symbol: "circle",
        symbolSize: 6,
        data: data.map((d) => Number(d[key] ?? d[altKey] ?? 0) || 0),
        itemStyle: { color: s.color },
        lineStyle: { color: s.color, width: 2 },
        areaStyle: { color: s.color, opacity: 0.08 },
      };
    }),
  }), [data, isDark, textColor, axisLineColor]);

  return (
    <ReactECharts
      option={option}
      style={{ height: 280, width: "100%" }}
      opts={{ renderer: "svg" }}
      notMerge
    />
  );
}

/** 横向柱状图：来路网站 / 受访页 / 入口页 Top N */
function HorizontalBarChart({ items, color = "#3b82f6" }: { items: ListItem[]; color?: string }) {
  const isDark = useIsDark();
  const textColor = isDark ? "rgba(255,255,255,0.65)" : "rgba(0,0,0,0.65)";
  const axisLineColor = isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)";

  const top = items.slice(0, 8).reverse(); // Top 8，反转使最大的在顶部

  const option = useMemo(() => ({
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      backgroundColor: isDark ? "rgba(30,30,30,0.95)" : "rgba(255,255,255,0.95)",
      borderColor: axisLineColor,
      textStyle: { color: textColor, fontSize: 12 },
    },
    grid: { left: "2%", right: "8%", bottom: "2%", top: "2%", containLabel: true },
    xAxis: {
      type: "value",
      minInterval: 1,
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: axisLineColor, type: "dashed" } },
      axisLabel: { color: textColor, fontSize: 10 },
    },
    yAxis: {
      type: "category",
      data: top.map((it) => {
        const name = itemName(it);
        return name.length > 20 ? name.slice(0, 20) + "…" : name;
      }),
      axisLine: { lineStyle: { color: axisLineColor } },
      axisTick: { show: false },
      axisLabel: { color: textColor, fontSize: 10, width: 160, overflow: "truncate" },
    },
    series: [{
      type: "bar",
      data: top.map((it) => itemValue(it)),
      itemStyle: { color, borderRadius: [0, 3, 3, 0] },
      barMaxWidth: 18,
      label: { show: true, position: "right", color: textColor, fontSize: 10 },
    }],
  }), [top, isDark, textColor, axisLineColor, color]);

  if (top.length === 0) {
    return <p className="py-8 text-center text-xs text-adm-text-tertiary">暂无数据</p>;
  }

  return (
    <ReactECharts
      option={option}
      style={{ height: Math.max(160, top.length * 32), width: "100%" }}
      opts={{ renderer: "svg" }}
      notMerge
    />
  );
}

/* ============ 主组件 ============ */

export default function LaAnalyticsSection() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchData = async (force = false) => {
    setLoading(true);
    setError("");
    try {
      const url = force ? "/analytics/overview?force=1" : "/analytics/overview";
      const res = await apiFetch(url);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "获取失败" }));
        throw new Error(err.message || "获取失败");
      }
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 先检查是否已配置 51.la
    apiFetch("/analytics/status")
      .then((res) => res.ok ? res.json() : null)
      .then((status) => {
        if (status?.configured) {
          setConfigured(true);
          fetchData();
        } else {
          setConfigured(false);
        }
      })
      .catch(() => setConfigured(false));
  }, []);

  // 未配置或仍在检查中：不渲染任何内容
  if (configured === null || configured === false) return null;

  const trendList = data ? extractTrend(data.trend) : [];
  const srcList = data ? extractList(data.src) : [];
  const interviewList = data ? extractList(data.interview) : [];
  const entryList = data ? extractList(data.entry) : [];

  // 汇总今日（最后一条）数据
  const today = trendList.length > 0 ? trendList[trendList.length - 1] : null;
  const summaryCards = [
    { label: "浏览量(PV)", value: today?.pv ?? 0, icon: Eye, color: "text-[#3b82f6]" },
    { label: "访客数(UV)", value: today?.uv ?? 0, icon: Users, color: "text-[#8b5cf6]" },
    { label: "IP数", value: today?.ip ?? 0, icon: Globe, color: "text-[#10b981]" },
    { label: "新访客数", value: today?.newUserCount ?? today?.newVisitor ?? 0, icon: UserPlus, color: "text-[#f59e0b]" },
    { label: "会话数", value: today?.sv ?? 0, icon: Activity, color: "text-[#f43f5e]" },
  ];

  return (
    <div className="mt-4 rounded-2xl border border-adm-border bg-adm-card p-5">
      {/* 标题栏 */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-adm-primary" />
          <h3 className="text-sm font-semibold text-adm-text">51.la 网站统计</h3>
          {data?.range && (
            <span className="text-xs text-adm-text-tertiary">
              {data.range.startDay} ~ {data.range.endDay}
            </span>
          )}
          {data?.fetchedAt && (
            <span className="text-[10px] text-adm-text-tertiary/70" title={data.fetchedAt}>
              更新于 {new Date(data.fetchedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <a
            href="https://v6.51.la"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-xs text-adm-text-tertiary transition-colors hover:text-adm-text-secondary"
          >
            51.la <ExternalLink className="h-3 w-3" />
          </a>
          <button
            onClick={() => fetchData(true)}
            disabled={loading}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-adm-text-secondary transition-colors hover:bg-adm-card-hover disabled:opacity-50"
            title="强制刷新（跳过缓存）"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            刷新
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-adm-danger/30 bg-adm-danger-bg px-3 py-2 text-xs text-adm-danger">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{error}</span>
        </div>
      )}

      {loading && !data ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-adm-border border-t-adm-primary" />
        </div>
      ) : (
        <>
          {/* 今日汇总卡片 */}
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {summaryCards.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.label} className="rounded-xl border border-adm-border bg-adm-input/50 p-3">
                  <div className="flex items-center gap-1.5">
                    <Icon className={`h-3.5 w-3.5 ${card.color}`} />
                    <span className="text-xs text-adm-text-secondary">{card.label}</span>
                  </div>
                  <div className="mt-1.5 text-xl font-bold text-adm-text">{card.value}</div>
                </div>
              );
            })}
          </div>

          {/* 趋势折线图 */}
          {trendList.length > 0 && (
            <div className="mb-4">
              <h4 className="mb-2 text-xs font-medium text-adm-text-secondary">趋势分析（近7天）</h4>
              <TrendLineChart data={trendList} />
            </div>
          )}

          {/* 来路 / 受访页 / 入口页 */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div>
              <h4 className="mb-2 text-xs font-medium text-adm-text-secondary">来路网站 Top 8</h4>
              <HorizontalBarChart items={srcList} color="#3b82f6" />
            </div>
            <div>
              <h4 className="mb-2 text-xs font-medium text-adm-text-secondary">受访页 Top 8</h4>
              <HorizontalBarChart items={interviewList} color="#8b5cf6" />
            </div>
            <div>
              <h4 className="mb-2 text-xs font-medium text-adm-text-secondary">入口页 Top 8</h4>
              <HorizontalBarChart items={entryList} color="#10b981" />
            </div>
          </div>

          {/* 明细表格 */}
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <DetailTable title="受访页详情" items={interviewList} label="查看次数" />
            <DetailTable title="入口页详情" items={entryList} label="入口次数" />
          </div>
        </>
      )}
    </div>
  );
}

/** 明细表格：页面地址 + 数值 */
function DetailTable({ title, items, label }: { title: string; items: ListItem[]; label: string }) {
  const top = items.slice(0, 10);
  return (
    <div className="rounded-xl border border-adm-border bg-adm-input/30 p-3">
      <h4 className="mb-2 text-xs font-medium text-adm-text-secondary">{title}</h4>
      {top.length === 0 ? (
        <p className="py-4 text-center text-xs text-adm-text-tertiary">暂无数据</p>
      ) : (
        <div className="space-y-1">
          {top.map((it, idx) => (
            <div key={idx} className="flex items-center justify-between gap-2 rounded px-2 py-1 text-xs hover:bg-adm-card-hover">
              <span className="min-w-0 flex-1 truncate text-adm-text-secondary" title={itemName(it)}>
                {itemName(it)}
              </span>
              <span className="shrink-0 font-medium text-adm-text">{itemValue(it)}</span>
            </div>
          ))}
        </div>
      )}
      <p className="mt-2 text-[10px] text-adm-text-tertiary">{label}</p>
    </div>
  );
}
