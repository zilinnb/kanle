"use client";

import { useEffect, useState } from "react";
import { MapPin, Save, Check, Server, Code, KeyRound } from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";

export default function AmapConfigSection() {
  const [amapKey, setAmapKey] = useState("");
  const [amapJsKey, setAmapJsKey] = useState("");
  const [amapSecurityJsCode, setAmapSecurityJsCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    apiFetch("/settings/amap-config")
      .then((res) => res.json())
      .then(
        (data: {
          amapKey: string;
          amapJsKey: string;
          amapSecurityJsCode: string;
        }) => {
          setAmapKey(data.amapKey || "");
          setAmapJsKey(data.amapJsKey || "");
          setAmapSecurityJsCode(data.amapSecurityJsCode || "");
        }
      )
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
        body: JSON.stringify({ amapKey, amapJsKey, amapSecurityJsCode }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-6 rounded-xl border border-adm-border bg-adm-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <MapPin className="h-5 w-5 text-adm-text-secondary" />
        <h3 className="text-base font-semibold text-adm-text">地图位置配置</h3>
      </div>

      <div className="mb-5 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-700 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-300">
        <strong>需要两个不同类型的 Key：</strong>
        <br />
        1. 「Web服务」类型 — 后端 REST API 用（位置搜索、逆地理编码）
        <br />
        2. 「Web端(JS API)」类型 — 前端地图组件用（小地图、定位选择）
        <br />
        请前往{" "}
        <a
          href="https://lbs.amap.com/dev/key/app"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-blue-600 underline dark:text-blue-400"
        >
          高德开放平台
        </a>{" "}
        分别创建。JS API Key 还需在控制台添加域名白名单{" "}
        <code className="rounded bg-blue-100 px-1 dark:bg-blue-900">
          kanle.net
        </code>
        。
      </div>

      {loading ? (
        <div className="space-y-3">
          <div className="h-10 animate-pulse rounded-lg bg-adm-input" />
          <div className="h-10 animate-pulse rounded-lg bg-adm-input" />
          <div className="h-10 animate-pulse rounded-lg bg-adm-input" />
        </div>
      ) : (
        <>
          {/* Web 服务 Key — 后端用 */}
          <div className="mb-2 flex items-center gap-1.5">
            <Server className="h-3.5 w-3.5 text-adm-text-tertiary" />
            <label className="block text-sm font-medium text-adm-text-secondary">
              高德地图 Web 服务 Key（后端用）
            </label>
          </div>
          <input
            type="text"
            value={amapKey}
            onChange={(e) => setAmapKey(e.target.value)}
            placeholder="「Web服务」类型的 Key"
            className="w-full rounded-lg border border-adm-border bg-adm-input px-3 py-2.5 text-sm text-adm-text placeholder:text-adm-text-tertiary focus:border-adm-primary focus:outline-none focus:ring-1 focus:ring-adm-primary"
          />
          <p className="mt-1.5 text-xs text-adm-text-tertiary">
            用于后端代理的位置搜索和逆地理编码。在高德开放平台创建「Web服务」类型的
            Key。
          </p>

          {/* JS API Key — 前端用 */}
          <div className="mb-2 mt-4 flex items-center gap-1.5">
            <Code className="h-3.5 w-3.5 text-adm-text-tertiary" />
            <label className="block text-sm font-medium text-adm-text-secondary">
              高德地图 JS API Key（前端用）
            </label>
          </div>
          <input
            type="text"
            value={amapJsKey}
            onChange={(e) => setAmapJsKey(e.target.value)}
            placeholder="「Web端(JS API)」类型的 Key"
            className="w-full rounded-lg border border-adm-border bg-adm-input px-3 py-2.5 text-sm text-adm-text placeholder:text-adm-text-tertiary focus:border-adm-primary focus:outline-none focus:ring-1 focus:ring-adm-primary"
          />
          <p className="mt-1.5 text-xs text-adm-text-tertiary">
            用于前端地图组件（小地图、定位选择）。创建「Web端(JS
            API)」类型的 Key，并在控制台添加域名白名单{" "}
            <code className="rounded bg-adm-input px-1">kanle.net</code>。
          </p>

          {/* JS API 安全密钥 */}
          <div className="mb-2 mt-4 flex items-center gap-1.5">
            <KeyRound className="h-3.5 w-3.5 text-adm-text-tertiary" />
            <label className="block text-sm font-medium text-adm-text-secondary">
              JS API 安全密钥
            </label>
          </div>
          <input
            type="text"
            value={amapSecurityJsCode}
            onChange={(e) => setAmapSecurityJsCode(e.target.value)}
            placeholder="2021-12-02 之后申请的 JS API Key 必填"
            className="w-full rounded-lg border border-adm-border bg-adm-input px-3 py-2.5 text-sm text-adm-text placeholder:text-adm-text-tertiary focus:border-adm-primary focus:outline-none focus:ring-1 focus:ring-adm-primary"
          />
          <p className="mt-1.5 text-xs text-adm-text-tertiary">
            与 JS API Key 配套使用。如果 JS API Key 是 2021-12-02
            之后申请的，必须填写安全密钥，否则地图无法加载。前往{" "}
            <a
              href="https://console.amap.com/dev/key/app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-adm-primary hover:underline"
            >
              控制台
            </a>{" "}
            查看对应 Key 的安全密钥。
          </p>

          <button
            onClick={handleSave}
            disabled={saving}
            className="mt-4 flex items-center gap-1.5 rounded-lg bg-adm-primary px-4 py-2 text-sm font-medium text-adm-primary-text transition-colors hover:opacity-90 disabled:opacity-50"
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
        </>
      )}
    </div>
  );
}
