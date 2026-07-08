"use client";

import { useEffect, useState } from "react";
import { Film, Save, Check, User, RefreshCw, ExternalLink } from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";

export default function DoubanConfigSection() {
  const [doubanId, setDoubanId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  useEffect(() => {
    apiFetch("/settings")
      .then((res) => res.json())
      .then((data: { doubanId?: string }) => {
        setDoubanId(data.doubanId || "");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await apiFetch("/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doubanId }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await apiFetch("/douban/sync", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        setSyncMsg({ ok: true, text: data.message || "同步成功" });
      } else {
        setSyncMsg({
          ok: false,
          text: data?.message || "同步失败，请稍后重试",
        });
      }
    } catch {
      setSyncMsg({ ok: false, text: "网络错误，请稍后重试" });
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMsg(null), 5000);
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <Film className="h-5 w-5 text-adm-text-secondary" />
        <h3 className="text-base font-semibold text-adm-text">豆瓣集成</h3>
      </div>

      <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300">
        <strong>如何获取豆瓣 ID？</strong>
        <br />
        登录豆瓣后，进入「我的豆瓣」主页，地址栏中的{" "}
        <code className="rounded bg-amber-100 px-1 dark:bg-amber-900">
          https://www.douban.com/people/<strong>{"{你的ID}"}</strong>/
        </code>{" "}
        部分即为你的豆瓣 ID。也支持数字 ID。填写后将在首页左侧边栏展示你的电影、图书、音乐收藏。
        <br />
        <a
          href="https://www.douban.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex items-center gap-0.5 font-medium text-amber-600 underline dark:text-amber-400"
        >
          前往豆瓣 <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {loading ? (
        <div className="space-y-3">
          <div className="h-10 animate-pulse rounded-lg bg-adm-input" />
        </div>
      ) : (
        <>
          <div className="mb-2 flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 text-adm-text-tertiary" />
            <label className="block text-sm font-medium text-adm-text-secondary">
              豆瓣用户 ID
            </label>
          </div>
          <input
            type="text"
            value={doubanId}
            onChange={(e) => setDoubanId(e.target.value)}
            placeholder="例如：your_name 或 123456789"
            className="w-full rounded-lg border border-adm-border bg-adm-input px-3 py-2.5 text-sm text-adm-text placeholder:text-adm-text-tertiary focus:border-adm-primary focus:outline-none focus:ring-1 focus:ring-adm-primary"
          />
          <p className="mt-1.5 text-xs text-adm-text-tertiary">
            数据每小时自动刷新一次（缓存 30 分钟）。保存后可点击下方按钮立即同步。
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg bg-adm-primary px-4 py-2 text-sm font-medium text-adm-primary-text transition-colors hover:opacity-90 disabled:opacity-50"
            >
              {saving ? (
                "保存中..."
              ) : saved ? (
                <>
                  <Check className="h-4 w-4" />
                  已保存
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  保存
                </>
              )}
            </button>

            <button
              onClick={handleSync}
              disabled={syncing || !doubanId}
              className="flex items-center gap-1.5 rounded-lg border border-adm-border bg-adm-card px-4 py-2 text-sm font-medium text-adm-text-secondary transition-colors hover:bg-adm-card-hover disabled:opacity-50"
            >
              {syncing ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  同步中...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  立即同步
                </>
              )}
            </button>

            {syncMsg && (
              <span
                className={`text-xs ${
                  syncMsg.ok ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                }`}
              >
                {syncMsg.text}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
