"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldBan, ShieldCheck, Trash2, Plus, Mail, Globe, Clock, Infinity as InfinityIcon,
  Search, AlertTriangle, Loader2, X, ShieldAlert,
} from "lucide-react";
import { apiFetch, getToken } from "@/lib/api-fetch";

interface BlacklistItem {
  id: string;
  type: "email" | "ip";
  value: string;
  reason?: string | null;
  expiresAt?: string | null;
  createdAt: string;
}

const DURATION_OPTIONS = [
  { label: "1 小时", value: 60 * 60 * 1000 },
  { label: "1 天", value: 24 * 60 * 60 * 1000 },
  { label: "7 天", value: 7 * 24 * 60 * 60 * 1000 },
  { label: "30 天", value: 30 * 24 * 60 * 60 * 1000 },
  { label: "永久", value: 0 },
];

/** 计算封禁状态：已过期 / 剩余时间 / 永久 */
function getBanStatus(expiresAt?: string | null): { label: string; expired: boolean; permanent: boolean } {
  if (!expiresAt) return { label: "永久", expired: false, permanent: true };
  const d = new Date(expiresAt);
  const now = Date.now();
  if (d.getTime() <= now) return { label: "已过期", expired: true, permanent: false };
  const diff = d.getTime() - now;
  const min = Math.floor(diff / 60000);
  if (min < 60) return { label: `${min} 分钟后解除`, expired: false, permanent: false };
  const hr = Math.floor(min / 60);
  if (hr < 24) return { label: `${hr} 小时后解除`, expired: false, permanent: false };
  const day = Math.floor(hr / 24);
  return { label: `${day} 天后解除`, expired: false, permanent: false };
}

export default function AdminBlacklist() {
  const router = useRouter();
  const [list, setList] = useState<BlacklistItem[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // 添加表单
  const [formType, setFormType] = useState<"email" | "ip">("email");
  const [formValue, setFormValue] = useState("");
  const [formReason, setFormReason] = useState("");
  const [formDuration, setFormDuration] = useState<number>(24 * 60 * 60 * 1000);
  const [adding, setAdding] = useState(false);
  const [formError, setFormError] = useState("");
  const [switching, setSwitching] = useState(false);

  // 违禁词管理
  const [bannedWords, setBannedWords] = useState<string[]>([]);
  const [bannedWordInput, setBannedWordInput] = useState("");
  const [savingBannedWords, setSavingBannedWords] = useState(false);
  const [bannedWordError, setBannedWordError] = useState("");

  const token = getToken();

  const fetchAll = useCallback(() => {
    if (!token) return;
    setLoading(true);
    Promise.all([
      apiFetch("/admin/blacklist").then((r) => r.json()),
      apiFetch("/admin/blacklist/status").then((r) => r.json()),
      apiFetch("/admin/blacklist/banned-words").then((r) => r.json()),
    ])
      .then(([blist, st, bw]) => {
        setList(Array.isArray(blist) ? blist : []);
        setEnabled(st?.enabled ?? true);
        setBannedWords(Array.isArray(bw?.words) ? bw.words : []);
      })
      .catch(() => {
        setList([]);
      })
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (!token) {
      router.replace("/");
      return;
    }
    fetchAll();
  }, [router, token, fetchAll]);

  const handleToggleEnabled = async () => {
    setSwitching(true);
    const next = !enabled;
    try {
      const res = await apiFetch("/admin/blacklist/status", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      if (res.ok) {
        setEnabled(next);
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.message || "切换失败，请重试");
      }
    } catch {
      alert("网络错误，请重试");
    } finally {
      setSwitching(false);
    }
  };

  const handleAdd = async () => {
    setFormError("");
    const v = formValue.trim();
    if (!v) {
      setFormError("请输入要封禁的邮箱或 IP");
      return;
    }
    if (formType === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      setFormError("邮箱格式不正确");
      return;
    }
    setAdding(true);
    try {
      const res = await apiFetch("/admin/blacklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: formType,
          value: v,
          reason: formReason.trim() || null,
          durationMs: formDuration === 0 ? null : formDuration,
        }),
      });
      if (res.ok) {
        const item = await res.json();
        setList((prev) => [item, ...prev]);
        setFormValue("");
        setFormReason("");
      } else {
        const data = await res.json().catch(() => ({}));
        setFormError(data.message || data.errors?.[0]?.msg || "添加失败");
      }
    } catch {
      setFormError("网络错误，请重试");
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (id: string) => {
    if (!confirm("确定解除此封禁吗？")) return;
    const res = await apiFetch(`/admin/blacklist/${id}`, { method: "DELETE" });
    if (res.ok) {
      setList((prev) => prev.filter((b) => b.id !== id));
    } else {
      alert("解封失败，请重试");
    }
  };

  // ===== 违禁词管理 =====
  const saveBannedWords = async (words: string[]) => {
    setSavingBannedWords(true);
    setBannedWordError("");
    try {
      const res = await apiFetch("/admin/blacklist/banned-words", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ words }),
      });
      if (res.ok) {
        const data = await res.json();
        setBannedWords(Array.isArray(data?.words) ? data.words : words);
      } else {
        setBannedWordError("保存失败，请重试");
      }
    } catch {
      setBannedWordError("网络错误，请重试");
    } finally {
      setSavingBannedWords(false);
    }
  };

  const handleAddBannedWord = () => {
    setBannedWordError("");
    const raw = bannedWordInput.trim();
    if (!raw) return;
    // 支持批量添加：按逗号、换行、空格分隔
    const newWords = raw
      .split(/[,，\n\s、]+/)
      .map((w) => w.trim())
      .filter(Boolean);
    if (newWords.length === 0) return;
    const existing = new Set(bannedWords.map((w) => w.toLowerCase()));
    const unique = newWords.filter((w) => !existing.has(w.toLowerCase()));
    if (unique.length === 0) {
      setBannedWordError("这些违禁词已存在");
      return;
    }
    const next = [...bannedWords, ...unique];
    setBannedWords(next);
    setBannedWordInput("");
    saveBannedWords(next);
  };

  const handleRemoveBannedWord = (w: string) => {
    const next = bannedWords.filter((x) => x !== w);
    setBannedWords(next);
    saveBannedWords(next);
  };

  const handleClearAllBannedWords = () => {
    if (bannedWords.length === 0) return;
    if (!confirm(`确定清空全部 ${bannedWords.length} 个违禁词吗？`)) return;
    setBannedWords([]);
    saveBannedWords([]);
  };

  const filtered = list.filter(
    (b) =>
      b.value.toLowerCase().includes(search.toLowerCase()) ||
      (b.reason || "").toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-adm-text-tertiary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 标题 */}
      <div>
        <h2 className="text-lg font-bold text-adm-text">黑名单管理</h2>
        <p className="mt-1 text-sm text-adm-text-secondary">
          管理评论封禁名单与防刷开关。自动封禁的记录也会出现在这里。
        </p>
      </div>

      {/* 总开关卡片 */}
      <div
        className={`rounded-2xl border p-4 transition-colors ${
          enabled
            ? "border-adm-border bg-adm-card"
            : "border-adm-danger/30 bg-adm-danger-bg/30"
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                enabled ? "bg-adm-primary/10 text-adm-primary" : "bg-adm-danger-bg text-adm-danger"
              }`}
            >
              {enabled ? <ShieldCheck className="h-5 w-5" /> : <ShieldBan className="h-5 w-5" />}
            </div>
            <div>
              <p className="text-sm font-semibold text-adm-text">
                评论防刷{enabled ? "已开启" : "已关闭"}
              </p>
              <p className="mt-0.5 text-xs text-adm-text-secondary">
                {enabled
                  ? "限流（10秒2条）与黑名单检查均生效"
                  : "所有评论防刷已停用，任何人可自由评论"}
              </p>
            </div>
          </div>
          <button
            onClick={handleToggleEnabled}
            disabled={switching}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
              enabled
                ? "bg-adm-primary"
                : "bg-gray-300 dark:bg-gray-600"
            }`}
            aria-label={enabled ? "关闭防刷" : "开启防刷"}
          >
            <span
              className={`absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform duration-200 ${
                enabled ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
        {!enabled && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-adm-danger-bg/50 px-3 py-2 text-xs text-adm-danger">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>当前处于关闭状态，存在被刷评论的风险，建议保持开启。</span>
          </div>
        )}
      </div>

      {/* 违禁词管理 */}
      <div className="rounded-2xl border border-adm-border bg-adm-card p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-adm-text-secondary" />
            <h3 className="text-sm font-semibold text-adm-text">违禁词管理</h3>
            {bannedWords.length > 0 && (
              <span className="rounded-full bg-adm-primary/10 px-2 py-0.5 text-[10px] font-medium text-adm-primary">
                {bannedWords.length} 个
              </span>
            )}
          </div>
          {bannedWords.length > 0 && (
            <button
              onClick={handleClearAllBannedWords}
              disabled={savingBannedWords}
              className="text-xs text-adm-text-tertiary transition-colors hover:text-adm-danger disabled:opacity-50"
            >
              清空全部
            </button>
          )}
        </div>
        <p className="mb-3 text-xs text-adm-text-secondary">
          设置评论违禁词后，用户评论包含这些词时将被拦截，并提示具体触发的违禁词。支持批量添加（用逗号、空格或换行分隔）。
        </p>

        {/* 添加输入框 */}
        <div className="flex gap-2">
          <input
            type="text"
            value={bannedWordInput}
            onChange={(e) => setBannedWordInput(e.target.value)}
            placeholder="输入违禁词，多个用逗号或空格分隔"
            className="flex-1 rounded-lg border border-adm-border bg-adm-input px-3 py-2 text-sm text-adm-text focus:border-adm-text-secondary focus:outline-none"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (!savingBannedWords) handleAddBannedWord();
              }
            }}
          />
          <button
            onClick={handleAddBannedWord}
            disabled={savingBannedWords || !bannedWordInput.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-adm-primary px-4 py-2 text-sm font-medium text-adm-primary-text transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {savingBannedWords ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            添加
          </button>
        </div>

        {/* 错误提示 */}
        {bannedWordError && <p className="mt-2 text-xs text-adm-danger">{bannedWordError}</p>}

        {/* 违禁词标签列表 */}
        {bannedWords.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {bannedWords.map((w) => (
              <span
                key={w}
                className="group flex items-center gap-1 rounded-md border border-adm-border bg-adm-input/50 py-1 pl-2.5 pr-1 text-xs text-adm-text"
              >
                <span className="break-all">{w}</span>
                <button
                  onClick={() => handleRemoveBannedWord(w)}
                  disabled={savingBannedWords}
                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-adm-text-tertiary transition-colors hover:bg-adm-danger/10 hover:text-adm-danger disabled:opacity-50"
                  aria-label={`删除违禁词 ${w}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        ) : (
          <div className="mt-3 rounded-lg border border-dashed border-adm-border py-6 text-center">
            <ShieldCheck className="mx-auto mb-1.5 h-6 w-6 text-adm-text-tertiary" />
            <p className="text-xs text-adm-text-tertiary">暂未设置违禁词</p>
          </div>
        )}
      </div>

      {/* 添加封禁表单 */}
      <div className="rounded-2xl border border-adm-border bg-adm-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <Plus className="h-4 w-4 text-adm-text-secondary" />
          <h3 className="text-sm font-semibold text-adm-text">添加封禁</h3>
        </div>
        <div className="space-y-2.5">
          <div className="flex gap-2">
            <div className="flex rounded-lg border border-adm-border bg-adm-input p-0.5">
              <button
                onClick={() => setFormType("email")}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs transition-colors ${
                  formType === "email"
                    ? "bg-adm-primary text-adm-primary-text"
                    : "text-adm-text-secondary hover:text-adm-text"
                }`}
              >
                <Mail className="h-3 w-3" />
                邮箱
              </button>
              <button
                onClick={() => setFormType("ip")}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs transition-colors ${
                  formType === "ip"
                    ? "bg-adm-primary text-adm-primary-text"
                    : "text-adm-text-secondary hover:text-adm-text"
                }`}
              >
                <Globe className="h-3 w-3" />
                IP
              </button>
            </div>
            <input
              type="text"
              value={formValue}
              onChange={(e) => setFormValue(e.target.value)}
              placeholder={formType === "email" ? "user@example.com" : "123.45.67.89"}
              className="flex-1 rounded-lg border border-adm-border bg-adm-input px-3 py-2 text-sm text-adm-text focus:border-adm-text-secondary focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !adding) handleAdd();
              }}
            />
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
            <input
              type="text"
              value={formReason}
              onChange={(e) => setFormReason(e.target.value)}
              placeholder="封禁原因（选填，如：刷评论、广告）"
              className="rounded-lg border border-adm-border bg-adm-input px-3 py-2 text-sm text-adm-text focus:border-adm-text-secondary focus:outline-none"
            />
            <select
              value={formDuration}
              onChange={(e) => setFormDuration(Number(e.target.value))}
              className="rounded-lg border border-adm-border bg-adm-input px-3 py-2 text-sm text-adm-text focus:border-adm-text-secondary focus:outline-none"
            >
              {DURATION_OPTIONS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
          {formError && <p className="text-xs text-adm-danger">{formError}</p>}
          <button
            onClick={handleAdd}
            disabled={adding || !formValue.trim()}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-adm-primary px-4 py-2 text-sm font-medium text-adm-primary-text transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            添加封禁
          </button>
        </div>
      </div>

      {/* 列表 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-adm-text-secondary">
            共 {list.length} 条记录{search ? `，匹配 ${filtered.length} 条` : ""}
          </p>
          {list.length > 0 && (
            <div className="relative w-40 sm:w-56">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-adm-text-tertiary" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索..."
                className="w-full rounded-lg border border-adm-border bg-adm-card py-1.5 pl-8 pr-2 text-xs text-adm-text focus:border-adm-text-secondary focus:outline-none"
              />
            </div>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-adm-border bg-adm-card py-12 text-center">
            <ShieldCheck className="mx-auto mb-2 h-8 w-8 text-adm-text-tertiary" />
            <p className="text-sm text-adm-text-tertiary">
              {search ? "未找到匹配的记录" : "暂无封禁记录"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((b) => {
              const status = getBanStatus(b.expiresAt);
              return (
                <div
                  key={b.id}
                  className={`rounded-xl border p-3 transition-colors ${
                    status.expired
                      ? "border-adm-border bg-adm-card/50 opacity-60"
                      : "border-adm-border bg-adm-card hover:bg-adm-card-hover/50"
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        b.type === "email"
                          ? "bg-blue-500/10 text-blue-500"
                          : "bg-purple-500/10 text-purple-500"
                      }`}
                    >
                      {b.type === "email" ? <Mail className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="text-sm font-medium text-adm-text break-all">{b.value}</span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                            b.type === "email"
                              ? "bg-blue-500/10 text-blue-500"
                              : "bg-purple-500/10 text-purple-500"
                          }`}
                        >
                          {b.type === "email" ? "邮箱" : "IP"}
                        </span>
                        <span
                          className={`flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] ${
                            status.expired
                              ? "bg-adm-card-hover text-adm-text-tertiary"
                              : status.permanent
                                ? "bg-adm-danger-bg text-adm-danger"
                                : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                          }`}
                        >
                          {status.permanent ? (
                            <InfinityIcon className="h-2.5 w-2.5" />
                          ) : (
                            <Clock className="h-2.5 w-2.5" />
                          )}
                          {status.label}
                        </span>
                      </div>
                      {b.reason && (
                        <p className="mt-0.5 text-xs text-adm-text-secondary">原因：{b.reason}</p>
                      )}
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <span className="text-[10px] text-adm-text-tertiary">
                          {new Date(b.createdAt).toLocaleString("zh-CN", { hour12: false })}
                        </span>
                        <button
                          onClick={() => handleRemove(b.id)}
                          className="flex items-center gap-1 rounded-lg bg-adm-danger-bg px-2 py-1 text-[11px] text-adm-danger transition-colors hover:bg-adm-danger/10"
                        >
                          <Trash2 className="h-3 w-3" />
                          解除封禁
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
