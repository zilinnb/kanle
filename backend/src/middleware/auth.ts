import { Request, Response, NextFunction } from "express";
import { verifyToken, TokenPayload } from "../utils/jwt";
import { User } from "../models";

export interface AuthRequest extends Request {
  user?: TokenPayload;
  /** WP Ulike cookie 访客 ID（由 visitor-cookie 中间件挂载） */
  visitorId?: string;
}

export async function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ message: "未提供认证令牌" });
    return;
  }

  const token = authHeader.split(" ")[1];
  try {
    const payload = verifyToken(token);
    // 验证用户是否仍然存在（防止用户被删除后旧 token 仍然有效）
    const user = await User.findByPk(payload.id, {
      attributes: ["id", "role"],
    });
    if (!user) {
      res.status(401).json({ message: "用户不存在，请重新登录" });
      return;
    }
    // 使用数据库中最新的 role，防止 token 里的 role 过期
    req.user = { id: user.id, email: payload.email, role: user.role };
    next();
  } catch {
    res.status(401).json({ message: "无效的认证令牌" });
  }
}

/** 可选认证：有 token 则验证，无 token 则作为匿名用户继续 */
export async function authenticateOptional(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next();
  }
  const token = authHeader.split(" ")[1];
  try {
    const payload = verifyToken(token);
    const user = await User.findByPk(payload.id, {
      attributes: ["id", "role"],
    });
    if (user) {
      req.user = { id: user.id, email: payload.email, role: user.role };
    }
  } catch {
    // 无效 token，作为匿名用户继续
  }
  next();
}

export function requireAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  if (req.user?.role !== "admin") {
    res.status(403).json({ message: "需要管理员权限" });
    return;
  }
  next();
}
