"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PenLine, User, Lock, Eye, EyeOff, ArrowRight } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

export default function AdminLogin() {
  const router = useRouter();
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "登录失败");
        return;
      }

      localStorage.setItem("admin_token", data.token);
      router.replace("/admin");
    } catch {
      setError("网络错误，请检查后端服务");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-adm-bg px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-adm-primary shadow-xl">
            <PenLine className="h-7 w-7 text-adm-primary-text" />
          </div>
          <h1 className="text-xl font-bold text-adm-text">朋友圈博客</h1>
          <p className="mt-1 text-sm text-adm-text-secondary">管理后台登录</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-adm-border bg-adm-card p-6 shadow-sm"
        >
          {error && (
            <div className="mb-4 rounded-lg bg-adm-danger-bg px-3 py-2 text-sm text-adm-danger">
              {error}
            </div>
          )}

          {/* 用户名或邮箱 */}
          <div className="mb-4">
            <label className="mb-1.5 block text-xs font-medium text-adm-text-secondary">
              用户名或邮箱
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-adm-text-tertiary" />
              <input
                type="text"
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                className="w-full rounded-xl border border-adm-border bg-adm-input py-2.5 pl-10 pr-3 text-sm text-adm-text transition-colors placeholder:text-adm-text-tertiary focus:border-adm-text-secondary focus:bg-adm-input-focus focus:outline-none focus:ring-1 focus:ring-adm-text-secondary"
                placeholder="用户名或邮箱"
                autoComplete="username"
                required
              />
            </div>
          </div>

          {/* Password */}
          <div className="mb-6">
            <label className="mb-1.5 block text-xs font-medium text-adm-text-secondary">
              密码
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-adm-text-tertiary" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-adm-border bg-adm-input py-2.5 pl-10 pr-10 text-sm text-adm-text transition-colors placeholder:text-adm-text-tertiary focus:border-adm-text-secondary focus:bg-adm-input-focus focus:outline-none focus:ring-1 focus:ring-adm-text-secondary"
                placeholder="请输入密码"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-adm-text-tertiary hover:text-adm-text-secondary"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="group flex w-full items-center justify-center gap-2 rounded-xl bg-adm-primary py-2.5 text-sm font-medium text-adm-primary-text transition-colors hover:opacity-90 disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-adm-primary-text/30 border-t-adm-primary-text" />
                登录中...
              </span>
            ) : (
              <>
                登录
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </>
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-adm-text-tertiary">
          朋友圈风格个人博客管理系统
        </p>
      </div>
    </div>
  );
}
