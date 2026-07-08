"use client";

import { useEffect, useState } from "react";
import {
  Mail,
  Save,
  Check,
  Send,
  RotateCcw,
  FileCode,
  Eye,
  EyeOff,
  Variable,
} from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";

interface EmailConfig {
  emailNotifyEnabled: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpFrom: string;
  notifyEmail: string;
  emailTemplate: string;
  isDefaultTemplate: boolean;
  smtpPass: string;
}

const DEFAULT_CONFIG: EmailConfig = {
  emailNotifyEnabled: false,
  smtpHost: "",
  smtpPort: 465,
  smtpSecure: true,
  smtpUser: "",
  smtpFrom: "",
  notifyEmail: "",
  emailTemplate: "",
  isDefaultTemplate: true,
  smtpPass: "",
};

const TEMPLATE_VARS = [
  "{{siteName}} — 网站名称",
  "{{actorNickname}} — 评论者昵称",
  "{{actorAvatar}} — 评论者头像",
  "{{actionText}} — 操作描述",
  "{{commentContent}} — 评论内容",
  "{{ownerNickname}} — 博主昵称",
  "{{ownerAvatar}} — 博主头像",
  "{{ownerMessage}} — 博主自动回复语",
  "{{postPreview}} — 动态内容预览",
  "{{postUrl}} — 动态链接",
];

export default function EmailConfigSection() {
  const [config, setConfig] = useState<EmailConfig>(DEFAULT_CONFIG);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showTemplate, setShowTemplate] = useState(false);

  useEffect(() => {
    apiFetch("/settings/email-config")
      .then((res) => res.json())
      .then((data: EmailConfig) => {
        setConfig({ ...DEFAULT_CONFIG, ...data });
        // 回填已保存的密码/授权码，刷新页面后仍可见
        setPassword(data.smtpPass || "");
        if (data.emailTemplate) setShowTemplate(true);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const body: Record<string, unknown> = {
        emailNotifyEnabled: config.emailNotifyEnabled,
        smtpHost: config.smtpHost,
        smtpPort: config.smtpPort,
        smtpSecure: config.smtpSecure,
        smtpUser: config.smtpUser,
        smtpFrom: config.smtpFrom,
        notifyEmail: config.notifyEmail,
        emailTemplate: config.emailTemplate,
      };
      if (password) body.smtpPass = password;

      const res = await apiFetch("/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setSaved(true);
        apiFetch("/settings/email-config")
          .then((res) => res.json())
          .then((data: EmailConfig) => {
            setConfig({ ...DEFAULT_CONFIG, ...data });
            // 保存后回填密码，避免密码字段被清空
            setPassword(data.smtpPass || "");
          })
          .catch(() => {});
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
      const res = await apiFetch("/settings/email-test", { method: "POST" });
      const data = await res.json();
      setTestResult(data);
    } catch {
      setTestResult({ success: false, message: "请求失败" });
    } finally {
      setTesting(false);
    }
  };

  const handleLoadDefault = async () => {
    try {
      const res = await apiFetch("/settings/default-template");
      const html = await res.text();
      setConfig({ ...config, emailTemplate: html, isDefaultTemplate: false });
      setShowTemplate(true);
    } catch {
      alert("加载默认模板失败");
    }
  };

  const handleResetDefault = () => {
    setConfig({ ...config, emailTemplate: "", isDefaultTemplate: true });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-adm-border border-t-adm-text" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-adm-border bg-adm-card p-6 shadow-sm">
      {/* Section header */}
      <div className="mb-6 flex items-center justify-between border-b border-adm-border pb-3">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-adm-text-tertiary" />
          <h3 className="text-sm font-semibold text-adm-text">邮件通知</h3>
        </div>
        {/* Enable toggle */}
        <button
          type="button"
          onClick={() =>
            setConfig({ ...config, emailNotifyEnabled: !config.emailNotifyEnabled })
          }
          className="flex cursor-pointer items-center gap-2"
        >
          <span className={`text-xs font-medium transition-colors ${config.emailNotifyEnabled ? "text-adm-text" : "text-adm-text-tertiary"}`}>
            {config.emailNotifyEnabled ? "已开启" : "已关闭"}
          </span>
          <span
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
              config.emailNotifyEnabled ? "bg-green-500" : "bg-gray-300 dark:bg-gray-600"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
                config.emailNotifyEnabled ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </span>
        </button>
      </div>

      {/* SMTP config */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* SMTP Host */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-adm-text-secondary">
              SMTP 服务器
            </label>
            <input
              type="text"
              value={config.smtpHost}
              onChange={(e) => setConfig({ ...config, smtpHost: e.target.value })}
              className="w-full rounded-xl border border-adm-border bg-adm-input px-3 py-2 text-sm text-adm-text transition-colors focus:border-adm-text-secondary focus:bg-adm-input-focus focus:outline-none"
              placeholder="smtp.qq.com"
            />
          </div>
          {/* SMTP Port */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-adm-text-secondary">
              端口
            </label>
            <input
              type="number"
              value={config.smtpPort}
              onChange={(e) =>
                setConfig({ ...config, smtpPort: parseInt(e.target.value) || 465 })
              }
              className="w-full rounded-xl border border-adm-border bg-adm-input px-3 py-2 text-sm text-adm-text transition-colors focus:border-adm-text-secondary focus:bg-adm-input-focus focus:outline-none"
              placeholder="465"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* SMTP User */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-adm-text-secondary">
              用户名
            </label>
            <input
              type="text"
              value={config.smtpUser}
              onChange={(e) => setConfig({ ...config, smtpUser: e.target.value })}
              className="w-full rounded-xl border border-adm-border bg-adm-input px-3 py-2 text-sm text-adm-text transition-colors focus:border-adm-text-secondary focus:bg-adm-input-focus focus:outline-none"
              placeholder="发件邮箱地址"
            />
          </div>
          {/* SMTP Password */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-adm-text-secondary">
              密码 / 授权码
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-adm-border bg-adm-input px-3 py-2 pr-10 text-sm text-adm-text transition-colors focus:border-adm-text-secondary focus:bg-adm-input-focus focus:outline-none"
                placeholder="邮箱密码或授权码"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-adm-text-tertiary transition-colors hover:text-adm-text"
                title={showPassword ? "隐藏密码" : "显示密码"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* SMTP From */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-adm-text-secondary">
              发件人（名称 + 邮箱）
            </label>
            <input
              type="text"
              value={config.smtpFrom}
              onChange={(e) => setConfig({ ...config, smtpFrom: e.target.value })}
              className="w-full rounded-xl border border-adm-border bg-adm-input px-3 py-2 text-sm text-adm-text transition-colors focus:border-adm-text-secondary focus:bg-adm-input-focus focus:outline-none"
              placeholder='如：博客 <noreply@example.com>'
            />
            <p className="mt-1 text-xs text-adm-text-tertiary">收件人看到的发件人名称和邮箱，留空则使用用户名</p>
          </div>
          {/* Notify Email */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-adm-text-secondary">
              通知收件邮箱
            </label>
            <input
              type="email"
              value={config.notifyEmail}
              onChange={(e) => setConfig({ ...config, notifyEmail: e.target.value })}
              className="w-full rounded-xl border border-adm-border bg-adm-input px-3 py-2 text-sm text-adm-text transition-colors focus:border-adm-text-secondary focus:bg-adm-input-focus focus:outline-none"
              placeholder="留空则通知博主邮箱"
            />
          </div>
        </div>

        {/* SSL/TLS toggle */}
        <button
          type="button"
          onClick={() => setConfig({ ...config, smtpSecure: !config.smtpSecure })}
          className="flex cursor-pointer items-center gap-2"
        >
          <span
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
              config.smtpSecure ? "bg-green-500" : "bg-gray-300 dark:bg-gray-600"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
                config.smtpSecure ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </span>
          <span className="text-xs text-adm-text-secondary">
            SSL/TLS 加密（端口 465 通常开启，587 通常关闭）
          </span>
        </button>
      </div>

      {/* Test button + result */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleTest}
          disabled={testing}
          className="flex items-center gap-1.5 rounded-lg border border-adm-border bg-adm-card px-3 py-1.5 text-xs text-adm-text-secondary transition-colors hover:bg-adm-card-hover disabled:opacity-50"
        >
          <Send className="h-3.5 w-3.5" />
          {testing ? "发送中..." : "发送测试邮件"}
        </button>
        {testResult && (
          <span
            className={`text-xs ${
              testResult.success ? "text-green-600" : "text-adm-danger"
            }`}
          >
            {testResult.message}
          </span>
        )}
      </div>

      {/* Email template section */}
      <div className="mt-8 border-t border-adm-border pt-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCode className="h-4 w-4 text-adm-text-tertiary" />
            <h3 className="text-sm font-semibold text-adm-text">邮件模板</h3>
            {config.isDefaultTemplate && (
              <span className="rounded bg-adm-input px-1.5 py-0.5 text-[10px] text-adm-text-tertiary">
                默认模板
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowTemplate(!showTemplate)}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-adm-text-secondary transition-colors hover:bg-adm-card-hover"
            >
              <Eye className="h-3 w-3" />
              {showTemplate ? "收起" : "展开"}
            </button>
            {config.emailTemplate ? (
              <button
                type="button"
                onClick={handleResetDefault}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-adm-text-secondary transition-colors hover:bg-adm-card-hover"
              >
                <RotateCcw className="h-3 w-3" />
                恢复默认
              </button>
            ) : (
              <button
                type="button"
                onClick={handleLoadDefault}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-adm-text-secondary transition-colors hover:bg-adm-card-hover"
              >
                <FileCode className="h-3 w-3" />
                加载默认模板
              </button>
            )}
          </div>
        </div>

        {/* Template variables hint */}
        <div className="mb-3 rounded-lg bg-adm-input px-3 py-2">
          <div className="mb-1 flex items-center gap-1 text-[11px] font-medium text-adm-text-secondary">
            <Variable className="h-3 w-3" />
            可用变量
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5">
            {TEMPLATE_VARS.map((v) => (
              <code key={v} className="text-[10px] text-adm-text-tertiary">
                {v}
              </code>
            ))}
          </div>
        </div>

        {showTemplate && (
          <textarea
            value={config.emailTemplate}
            onChange={(e) =>
              setConfig({
                ...config,
                emailTemplate: e.target.value,
                isDefaultTemplate: false,
              })
            }
            rows={16}
            className="w-full resize-y rounded-xl border border-adm-border bg-adm-input px-3 py-2 font-mono text-xs text-adm-text transition-colors focus:border-adm-text-secondary focus:bg-adm-input-focus focus:outline-none"
            placeholder="点击「加载默认模板」查看默认模板，或粘贴自定义 HTML 模板。留空使用默认模板。"
          />
        )}
      </div>

      {/* Save button */}
      <div className="mt-6">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-xl bg-adm-primary px-5 py-2.5 text-sm font-medium text-adm-primary-text transition-colors hover:opacity-90 disabled:opacity-50"
        >
          {saved ? (
            <>
              <Check className="h-4 w-4" />
              已保存
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              {saving ? "保存中..." : "保存邮件配置"}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
