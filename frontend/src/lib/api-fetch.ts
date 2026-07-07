const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

export function getApiUrl() {
  return API_URL;
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
  const res = await fetch(`${API_URL}${path}`, {
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
