import { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import { AuthRequest } from "../middleware/auth";

/**
 * WP Ulike 风格的访客身份识别中间件：
 * 1. 读取 req.cookies.visitorId
 * 2. 若无 → 生成 UUID v4 → 写入 HttpOnly cookie（1 年有效，SameSite=Lax）
 * 3. 挂到 req.visitorId 供后续路由使用
 *
 * Cookie 优先于 IP/email：同一公司/校园网下不同人 IP 相同，cookie 区分到位。
 * HttpOnly 防 XSS 读取，SameSite=Lax 允许顶层导航携带。
 */
const VISITOR_COOKIE_NAME = "visitorId";
const VISITOR_COOKIE_MAX_AGE = 365 * 24 * 60 * 60 * 1000; // 1 年

export function visitorCookieMiddleware(req: Request, res: Response, next: NextFunction) {
  let visitorId: string | undefined;

  const raw = (req as any).cookies?.[VISITOR_COOKIE_NAME];
  if (typeof raw === "string" && raw.trim() !== "") {
    visitorId = raw.trim();
  } else {
    visitorId = uuidv4();
    res.cookie(VISITOR_COOKIE_NAME, visitorId, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: VISITOR_COOKIE_MAX_AGE,
      path: "/",
    });
  }

  (req as AuthRequest).visitorId = visitorId;
  next();
}
