import type { Request } from "express";

/**
 * 从 Express 请求中提取客户端真实 IP。
 * 优先级：X-Forwarded-For（取第一个，nginx 反向代理场景）> X-Real-IP > req.ip > connection.remoteAddress
 * 注意：生产环境 nginx 需配置 proxy_set_header X-Real-IP $remote_addr; 和 X-Forwarded-For。
 */
export function getClientIp(req: Request): string {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length > 0) {
    return xff.split(",")[0].trim();
  }
  if (Array.isArray(xff) && xff.length > 0) {
    return xff[0].trim();
  }
  const xRealIp = req.headers["x-real-ip"];
  if (typeof xRealIp === "string" && xRealIp.length > 0) {
    return xRealIp.trim();
  }
  if (req.ip) return req.ip;
  const remote = req.connection?.remoteAddress;
  return remote || "unknown";
}

/** 邮箱标准化：小写 + trim，作为限流和黑名单的 key */
export function normalizeEmail(email: string): string {
  return (email || "").trim().toLowerCase();
}

/** IP 标准化：去掉 IPv6 前缀 ::ffff: 让 v4/v6 对齐 */
export function normalizeIp(ip: string): string {
  if (!ip) return "unknown";
  if (ip.startsWith("::ffff:")) return ip.slice(7);
  return ip;
}
