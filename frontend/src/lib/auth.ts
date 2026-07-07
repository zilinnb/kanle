export interface CurrentUser {
  /** 是否是已登录的博主 */
  isLoggedIn: boolean;
  nickname: string;
  email: string;
  website: string;
  /** 登录用户的 token（仅博主有） */
  token?: string;
}

/**
 * 获取当前用户身份。
 * 优先返回已登录的博主，其次返回填写过信息的游客，都没有则返回 null。
 */
export function getCurrentUser(): CurrentUser | null {
  if (typeof window === "undefined") return null;

  // 1. 优先检查登录博主
  const token = localStorage.getItem("admin_token");
  const nickname = localStorage.getItem("admin_nickname");
  const email = localStorage.getItem("admin_email") || "";
  if (token && nickname) {
    return { isLoggedIn: true, nickname, email, website: "", token };
  }

  // 2. 其次检查游客信息
  const vName = localStorage.getItem("visitor_name");
  const vEmail = localStorage.getItem("visitor_email");
  const vWebsite = localStorage.getItem("visitor_website") || "";
  if (vName && vEmail) {
    return { isLoggedIn: false, nickname: vName, email: vEmail, website: vWebsite };
  }

  return null;
}

/**
 * 构造带 Authorization Bearer token 的请求 headers（如果用户已登录）。
 * 用于所有客户端 fetch /api/posts 等需要识别身份的接口：
 *   - 登录用户：返回 { Authorization: "Bearer xxx" }
 *   - 未登录：返回 {}（后端走 cookie visitorId 维度）
 *
 * 关键：登录后必须带 token，否则后端 req.user=null，
 * 会用 cookie visitorId 查询 meLiked——但 visitorId 维度的点赞
 * 已在登录时被 migrateLikesToUserId 升级/软删，导致 meLiked=false 错误。
 */
export function authFetchHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const user = getCurrentUser();
  if (user?.isLoggedIn && user.token) {
    return { Authorization: `Bearer ${user.token}` };
  }
  return {};
}


