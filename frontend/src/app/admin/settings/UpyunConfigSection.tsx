"use client";

import { useEffect, useState } from "react";
import { Cloud, Save, Check, Eye, EyeOff, ExternalLink, Zap, AlertTriangle, FolderUp } from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";

export default function UpyunConfigSection() {
  const [enabled, setEnabled] = useState(false);
  const [bucket, setBucket] = useState("");
  const [operator, setOperator] = useState("");
  const [password, setPassword] = useState("");
  const [domain, setDomain] = useState("");
  const [pathPrefix, setPathPrefix] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; https?: boolean } | null>(null);
  const [migrating, setMigrating] = useState(false);
  const [migrateResult, setMigrateResult] = useState<{
    success: boolean;
    message: string;
    detail?: {
      totalFiles: number;
      uploaded: number;
      failed: number;
      recordsUpdated: { media: number; posts: number; comments: number; friendLinks: number; users: number; settings: number };
      errors: string[];
    };
  } | null>(null);

  useEffect(() => {
    apiFetch("/settings/upyun-config")
      .then((res) => res.json())
      .then(
        (data: {
          upyunEnabled: boolean;
          upyunBucket: string;
          upyunOperator: string;
          upyunPassword: string;
          upyunDomain: string;
          upyunPath: string;
        }) => {
          setEnabled(data.upyunEnabled);
          setBucket(data.upyunBucket || "");
          setOperator(data.upyunOperator || "");
          setPassword(data.upyunPassword || "");
          setDomain(data.upyunDomain || "");
          setPathPrefix(data.upyunPath || "");
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
        body: JSON.stringify({
          upyunEnabled: enabled,
          upyunBucket: bucket,
          upyunOperator: operator,
          upyunPassword: password,
          upyunDomain: domain,
          upyunPath: pathPrefix,
        }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await apiFetch("/upload/test-upyun", { method: "POST" });
      const data = await res.json();
      setTestResult({ success: data.success, message: data.message, https: data.https });
    } catch {
      setTestResult({ success: false, message: "请求失败，请检查网络" });
    } finally {
      setTesting(false);
    }
  };

  const handleMigrate = async () => {
    if (!confirm("确认将本地所有上传文件迁移到又拍云？迁移后数据库中的文件 URL 将更新为又拍云 CDN 地址，本地文件不会被删除。")) return;
    setMigrating(true);
    setMigrateResult(null);
    try {
      const res = await apiFetch("/upload/migrate-to-upyun", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        const r = data.result;
        const totalUpdated = r.recordsUpdated.media + r.recordsUpdated.posts + r.recordsUpdated.comments + r.recordsUpdated.friendLinks + r.recordsUpdated.users + r.recordsUpdated.settings;
        setMigrateResult({
          success: true,
          message: `迁移完成：上传 ${r.uploaded}/${r.totalFiles} 个文件，更新 ${totalUpdated} 条记录`,
          detail: r,
        });
      } else {
        setMigrateResult({ success: false, message: data.message || "迁移失败" });
      }
    } catch {
      setMigrateResult({ success: false, message: "请求失败，请检查网络" });
    } finally {
      setMigrating(false);
    }
  };

  return (
    <div className="rounded-xl border border-adm-border bg-adm-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <Cloud className="h-5 w-5 text-adm-text-secondary" />
        <h3 className="text-base font-semibold text-adm-text">又拍云存储</h3>
        {enabled && (
          <span className="ml-auto rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-950/50 dark:text-green-400">
            已启用
          </span>
        )}
      </div>

      <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300">
        启用后，所有上传的图片、音频、视频将自动存储到又拍云 CDN，并记录到
        <a href="/admin/media" className="mx-1 font-medium text-amber-600 underline dark:text-amber-400">
          媒体库
        </a>
        。请前往
        <a
          href="https://console.upyun.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="mx-1 font-medium text-amber-600 underline dark:text-amber-400"
        >
          又拍云控制台
        </a>
        获取以下信息。
      </div>

      {loading ? (
        <div className="space-y-3">
          <div className="h-10 animate-pulse rounded-lg bg-adm-input" />
          <div className="h-10 animate-pulse rounded-lg bg-adm-input" />
          <div className="h-10 animate-pulse rounded-lg bg-adm-input" />
        </div>
      ) : (
        <>
          {/* 启用开关 — 使用稳定的开关模式：div 容器 + 任意 px 定位 */}
          <div className="mb-4 flex cursor-pointer items-center justify-between rounded-lg border border-adm-border bg-adm-input px-4 py-3" onClick={() => setEnabled((v) => !v)}>
            <div>
              <div className="text-sm font-medium text-adm-text">启用又拍云存储</div>
              <div className="mt-0.5 text-xs text-adm-text-tertiary">
                关闭后将使用本地磁盘存储
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              onClick={(e) => {
                e.stopPropagation();
                setEnabled((v) => !v);
              }}
              className={`relative h-[22px] w-[40px] shrink-0 rounded-full transition-colors ${
                enabled ? "bg-green-500" : "bg-black/15 dark:bg-white/20"
              }`}
            >
              <span
                className={`absolute left-[2px] top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow transition-transform ${
                  enabled ? "translate-x-[18px]" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* 服务名 */}
          <div className="mb-2">
            <label className="block text-sm font-medium text-adm-text-secondary">
              服务名称（Bucket）
            </label>
          </div>
          <input
            type="text"
            value={bucket}
            onChange={(e) => setBucket(e.target.value)}
            placeholder="又拍云存储服务名"
            className="w-full rounded-lg border border-adm-border bg-adm-input px-3 py-2.5 text-sm text-adm-text placeholder:text-adm-text-tertiary focus:border-adm-primary focus:outline-none focus:ring-1 focus:ring-adm-primary"
          />
          <p className="mt-1.5 text-xs text-adm-text-tertiary">
            在又拍云控制台创建的「存储服务」名称。
          </p>

          {/* 操作员 */}
          <div className="mb-2 mt-4">
            <label className="block text-sm font-medium text-adm-text-secondary">
              操作员名称
            </label>
          </div>
          <input
            type="text"
            value={operator}
            onChange={(e) => setOperator(e.target.value)}
            placeholder="操作员账号"
            className="w-full rounded-lg border border-adm-border bg-adm-input px-3 py-2.5 text-sm text-adm-text placeholder:text-adm-text-tertiary focus:border-adm-primary focus:outline-none focus:ring-1 focus:ring-adm-primary"
          />
          <p className="mt-1.5 text-xs text-adm-text-tertiary">
            在控制台「存储服务 → 账号管理 → 操作员」中创建，需有读写权限。
          </p>

          {/* 操作员密码 */}
          <div className="mb-2 mt-4">
            <label className="block text-sm font-medium text-adm-text-secondary">
              操作员密码
            </label>
          </div>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="操作员密码"
              className="w-full rounded-lg border border-adm-border bg-adm-input px-3 py-2.5 pr-10 text-sm text-adm-text placeholder:text-adm-text-tertiary focus:border-adm-primary focus:outline-none focus:ring-1 focus:ring-adm-primary"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-adm-text-tertiary hover:text-adm-text"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="mt-1.5 text-xs text-adm-text-tertiary">
            留空保存时保留原密码不变。
          </p>

          {/* CDN 域名 */}
          <div className="mb-2 mt-4">
            <label className="block text-sm font-medium text-adm-text-secondary">
              CDN 加速域名
            </label>
          </div>
          <input
            type="text"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="https://cdn.example.com"
            className="w-full rounded-lg border border-adm-border bg-adm-input px-3 py-2.5 text-sm text-adm-text placeholder:text-adm-text-tertiary focus:border-adm-primary focus:outline-none focus:ring-1 focus:ring-adm-primary"
          />
          <p className="mt-1.5 text-xs text-adm-text-tertiary">
            绑定到该存储服务的 CDN 域名，需包含 http:// 或 https:// 前缀。
          </p>
          {enabled && domain && domain.startsWith("http://") && (
            <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-700 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                当前使用 HTTP 域名，在 HTTPS 网站上图片会被浏览器拦截（Mixed Content）。
                请在又拍云控制台绑定自定义域名并开启 HTTPS，然后将域名改为 https:// 开头。
              </span>
            </div>
          )}

          {/* 存储路径前缀 */}
          <div className="mb-2 mt-4">
            <label className="block text-sm font-medium text-adm-text-secondary">
              存储路径前缀（可选）
            </label>
          </div>
          <input
            type="text"
            value={pathPrefix}
            onChange={(e) => setPathPrefix(e.target.value)}
            placeholder="media"
            className="w-full rounded-lg border border-adm-border bg-adm-input px-3 py-2.5 text-sm text-adm-text placeholder:text-adm-text-tertiary focus:border-adm-primary focus:outline-none focus:ring-1 focus:ring-adm-primary"
          />
          <p className="mt-1.5 text-xs text-adm-text-tertiary">
            上传文件的路径前缀，如填 <code className="rounded bg-adm-input px-1">media</code> 则文件存储在
            <code className="rounded bg-adm-input px-1">/media/2024/01/xxx.jpg</code>。留空则使用根目录。
          </p>

          <div className="mt-5 flex items-center gap-2">
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
            {enabled && (
              <button
                onClick={handleTest}
                disabled={testing}
                className="flex items-center gap-1.5 rounded-lg border border-adm-border bg-adm-card px-4 py-2 text-sm font-medium text-adm-text-secondary transition-colors hover:bg-adm-card-hover disabled:opacity-50"
              >
                {testing ? (
                  "测试中..."
                ) : (
                  <>
                    <Zap className="h-4 w-4" />
                    测试连接
                  </>
                )}
              </button>
            )}
          </div>
          {testResult && (
            <div
              className={`mt-3 flex items-start gap-2 rounded-lg p-3 text-sm ${
                testResult.success
                  ? "border border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/50 dark:text-green-400"
                  : "border border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-400"
              }`}
            >
              {testResult.success ? (
                <Check className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <div>
                <p>{testResult.message}</p>
                {testResult.success && testResult.https === false && (
                  <p className="mt-1 text-xs opacity-80">
                    注意：CDN 域名使用 HTTP，在 HTTPS 网站上图片会被浏览器拦截。请绑定 HTTPS 域名。
                  </p>
                )}
              </div>
            </div>
          )}

          {/* 本地文件迁移 */}
          {enabled && (
            <div className="mt-6 rounded-lg border border-adm-border bg-adm-input/50 p-4">
              <div className="flex items-start gap-2">
                <FolderUp className="mt-0.5 h-5 w-5 shrink-0 text-adm-text-secondary" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-adm-text">本地文件迁移</div>
                  <div className="mt-0.5 text-xs text-adm-text-tertiary">
                    将服务器本地上传目录中的所有文件上传到又拍云，并自动更新文章、动态、评论、用户头像等所有引用了本地 URL 的记录。本地文件不会被删除。
                  </div>
                  <button
                    onClick={handleMigrate}
                    disabled={migrating}
                    className="mt-3 flex items-center gap-1.5 rounded-lg bg-adm-primary px-4 py-2 text-sm font-medium text-adm-primary-text transition-colors hover:opacity-90 disabled:opacity-50"
                  >
                    {migrating ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        迁移中...
                      </>
                    ) : (
                      <>
                        <FolderUp className="h-4 w-4" />
                        开始迁移
                      </>
                    )}
                  </button>
                  {migrateResult && (
                    <div
                      className={`mt-3 rounded-lg p-3 text-sm ${
                        migrateResult.success
                          ? "border border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/50 dark:text-green-400"
                          : "border border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-400"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {migrateResult.success ? (
                          <Check className="mt-0.5 h-4 w-4 shrink-0" />
                        ) : (
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                        )}
                        <div className="flex-1">
                          <p>{migrateResult.message}</p>
                          {migrateResult.detail && migrateResult.success && (
                            <div className="mt-2 space-y-0.5 text-xs opacity-80">
                              {migrateResult.detail.recordsUpdated.media > 0 && (
                                <p>媒体库记录：{migrateResult.detail.recordsUpdated.media} 条</p>
                              )}
                              {migrateResult.detail.recordsUpdated.posts > 0 && (
                                <p>文章/动态：{migrateResult.detail.recordsUpdated.posts} 条</p>
                              )}
                              {migrateResult.detail.recordsUpdated.comments > 0 && (
                                <p>评论：{migrateResult.detail.recordsUpdated.comments} 条</p>
                              )}
                              {migrateResult.detail.recordsUpdated.users > 0 && (
                                <p>用户资料：{migrateResult.detail.recordsUpdated.users} 条</p>
                              )}
                              {migrateResult.detail.recordsUpdated.settings > 0 && (
                                <p>网站设置：{migrateResult.detail.recordsUpdated.settings} 条</p>
                              )}
                              {migrateResult.detail.failed > 0 && (
                                <p className="text-red-600 dark:text-red-400">
                                  失败文件：{migrateResult.detail.failed} 个
                                </p>
                              )}
                            </div>
                          )}
                          {migrateResult.detail && migrateResult.detail.errors.length > 0 && (
                            <details className="mt-2">
                              <summary className="cursor-pointer text-xs opacity-70">查看错误详情</summary>
                              <ul className="mt-1 space-y-0.5 text-xs opacity-60">
                                {migrateResult.detail.errors.map((e, i) => (
                                  <li key={i}>{e}</li>
                                ))}
                              </ul>
                            </details>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
