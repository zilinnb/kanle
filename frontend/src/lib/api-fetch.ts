const PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

/**
 * 获取 API URL。
 * - 客户端：返回 NEXT_PUBLIC_API_URL（/api 相对路径，通过 rewrites 代理）
 * - SSR：如果 API_URL 是相对路径，用 BACKEND_URL 构造绝对 URL（Node.js fetch 需要绝对 URL）
 */
export function getApiUrl() {
  if (typeof window === "undefined" && PUBLIC_API_URL.startsWith("/")) {
    return `${process.env.BACKEND_URL || "http://localhost:4000"}${PUBLIC_API_URL}`;
  }
  return PUBLIC_API_URL;
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("admin_token");
}

export function clearAuth() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("admin_token");
  localStorage.removeItem("admin_nickname");
  localStorage.removeItem("admin_email");
  localStorage.removeItem("admin_avatar");
  localStorage.removeItem("admin_cover");
  localStorage.removeItem("admin_bio");
  localStorage.removeItem("admin_website");
}

export async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  const token = getToken();
  const res = await fetch(`${getApiUrl()}${path}`, {
    ...options,
    headers: {
      ...(options?.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (res.status === 401) {
    clearAuth();
    if (typeof window !== "undefined") {
      window.location.href = "/";
    }
    throw new Error("Unauthorized");
  }
  return res;
}
