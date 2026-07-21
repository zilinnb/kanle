/**
 * 51.la OpenAPI v6 代理路由
 *
 * 实现：
 * 1. SHA256HEX 签名认证（accessKey/nonce/secretKey/timestamp 按字典顺序拼接）
 * 2. 趋势数据代理（按天/按小时）
 * 3. 实时明细数据代理（来路/受访页/入口页/新老访客/终端/地区/浏览器）
 * 4. 聚合 overview 端点 —— 一次性返回仪表盘所需全部数据
 *
 * 安全：所有端点要求管理员登录。若站点未配置 51.la（laAccessKey/laSecretKey/laMaskId 为空），
 * 返回 400 提示未配置，前端据此隐藏 ECharts 模块。
 *
 * 缓存：内存缓存 5 分钟，避免频繁调用 51.la API 触发限流。
 */
import { Router, Request, Response } from "express";
import crypto from "crypto";
import axios from "axios";
import { SiteSetting } from "../models";
import { authenticate, requireAdmin, AuthRequest } from "../middleware/auth";

const router = Router();

const LA_API_BASE = "https://v6-open.51.la";
const CACHE_TTL = 2 * 60 * 1000; // 2 分钟（趋势数据）
const REALTIME_CACHE_TTL = 30 * 1000; // 30 秒（实时数据）

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}
const cache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCached<T>(key: string, data: T, ttl = CACHE_TTL): void {
  cache.set(key, { data, expiresAt: Date.now() + ttl });
}

/** 生成 6 位随机 nonce */
function genNonce(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/**
 * 构造 51.la OpenAPI 签名
 * 规则：将 accessKey/nonce/secretKey/timestamp 按 key 字典顺序排列，
 * 拼接成 `key=value&key=value` 形式，SHA256 加密后转 hex 大写。
 */
function buildSign(accessKey: string, secretKey: string, nonce: string, timestamp: number): string {
  const params: Record<string, string> = {
    accessKey,
    nonce,
    secretKey,
    timestamp: String(timestamp),
  };
  const keys = Object.keys(params).sort();
  const signString = keys.map((k) => `${k}=${params[k]}`).join("&");
  return crypto.createHash("sha256").update(signString).digest("hex").toUpperCase();
}

interface LaConfig {
  accessKey: string;
  secretKey: string;
  maskId: string;
}

async function getLaConfig(): Promise<LaConfig | null> {
  const setting = await SiteSetting.findByPk(1);
  if (!setting) return null;
  const accessKey = (setting.laAccessKey || "").trim();
  const secretKey = (setting.laSecretKey || "").trim();
  const maskId = (setting.laMaskId || "").trim();
  if (!accessKey || !secretKey || !maskId) return null;
  return { accessKey, secretKey, maskId };
}

/**
 * 调用 51.la OpenAPI
 * @param path API 路径（如 /open/trend/day）
 * @param bizParams 业务参数（不含签名四要素）
 */
async function callLaApi<T = unknown>(path: string, bizParams: Record<string, unknown> = {}): Promise<T> {
  const cfg = await getLaConfig();
  if (!cfg) {
    throw new Error("NOT_CONFIGURED");
  }
  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = genNonce();
  const sign = buildSign(cfg.accessKey, cfg.secretKey, nonce, timestamp);

  const body = {
    accessKey: cfg.accessKey,
    nonce,
    timestamp,
    sign,
    maskId: cfg.maskId,
    ...bizParams,
  };

  const resp = await axios.post(`${LA_API_BASE}${path}`, body, {
    headers: { "Content-Type": "application/json" },
    timeout: 10000,
  });

  // 51.la 返回结构：{ code: 0, msg: "success", data: {...} }
  if (resp.data && typeof resp.data.code !== "undefined" && resp.data.code !== 0 && resp.data.code !== "00000") {
    throw new Error(`51.la API error: ${resp.data.msg || resp.data.message || JSON.stringify(resp.data)}`);
  }
  return (resp.data?.data ?? resp.data) as T;
}

/** 统一错误处理 */
function handleErr(err: unknown, res: Response): void {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg === "NOT_CONFIGURED") {
    res.status(400).json({ message: "未配置 51.la OpenAPI，请在网站设置中填写 accessKey/secretKey/maskId", notConfigured: true });
    return;
  }
  if (msg.includes("timeout")) {
    res.status(504).json({ message: "51.la API 请求超时" });
    return;
  }
  console.error("[analytics] 51.la API error:", msg);
  res.status(500).json({ message: msg || "获取统计数据失败" });
}

// ====== 路由 ======

// GET /api/analytics/status - 检查是否已配置 51.la
router.get("/status", authenticate, requireAdmin, async (_req: AuthRequest, res: Response) => {
  const cfg = await getLaConfig();
  res.json({ configured: !!cfg });
});

// GET /api/analytics/trend?range=7|30&unit=day|hour
router.get("/trend", authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const range = parseInt(req.query.range as string, 10) || 7;
    const unit = (req.query.unit as string) === "hour" ? "hour" : "day";
    const cacheKey = `trend:${unit}:${range}`;
    const cached = getCached<unknown>(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - (range - 1));
    const startStr = unit === "day"
      ? `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`
      : `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")} ${String(start.getHours()).padStart(2, "0")}:00:00`;
    const endStr = unit === "day"
      ? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
      : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:59:59`;
    const path = unit === "day" ? "/open/trend/day" : "/open/trend/hour";
    const data = await callLaApi(path, { startDate: startStr, endDate: endStr });
    setCached(cacheKey, data);
    res.json(data);
  } catch (err) {
    handleErr(err, res);
  }
});

// GET /api/analytics/realtime?type=ACTIVE_USER|SRC|INTERVIEW|ENTRY|TERMINAL|BROWSER|REGION
router.get("/realtime", authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const type = (req.query.type as string) || "ACTIVE_USER";
    const cacheKey = `realtime:${type}`;
    const cached = getCached<unknown>(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }
    const data = await callLaApi("/open/online/data", { type });
    // 实时数据变化快，缓存 30 秒
    setCached(cacheKey, data, REALTIME_CACHE_TTL);
    res.json(data);
  } catch (err) {
    handleErr(err, res);
  }
});

/**
 * GET /api/analytics/overview - 聚合仪表盘数据
 * 返回：趋势(7天)、新老访客、来路、受访页、入口页
 * ?force=1 跳过缓存，强制拉取最新数据（供前端"刷新"按钮使用）
 */
router.get("/overview", authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const force = req.query.force === "1" || req.query.force === "true";
    const cacheKey = "overview:default";
    if (!force) {
      const cached = getCached<unknown>(cacheKey);
      if (cached) {
        res.json(cached);
        return;
      }
    }
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - 6); // 最近 7 天
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const startDate = fmt(start);
    const endDate = fmt(now);

    // 并行请求多个端点
    const [trend, newVsReturn, src, interview, entry] = await Promise.allSettled([
      callLaApi("/open/trend/day", { startDate, endDate }),
      callLaApi("/open/online/data", { type: "ACTIVE_USER" }),
      callLaApi("/open/online/data", { type: "SRC" }),
      callLaApi("/open/online/data", { type: "INTERVIEW" }),
      callLaApi("/open/online/data", { type: "ENTRY" }),
    ]);

    const unwrap = <T,>(r: PromiseSettledResult<T>): T | null =>
      r.status === "fulfilled" ? r.value : null;

    const data = {
      trend: unwrap(trend),
      newVsReturn: unwrap(newVsReturn),
      src: unwrap(src),
      interview: unwrap(interview),
      entry: unwrap(entry),
      range: { startDate, endDate },
      fetchedAt: new Date().toISOString(),
    };
    // 趋势用 2 分钟缓存，但实时明细（来路/受访页/入口页）变化较快，用 30 秒
    setCached(cacheKey, data, REALTIME_CACHE_TTL);
    res.json(data);
  } catch (err) {
    handleErr(err, res);
  }
});

export default router;
