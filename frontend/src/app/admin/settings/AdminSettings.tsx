"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Globe,
  Settings2,
  Search,
  FileText,
  Image as ImageIcon,
  Upload,
  Save,
  Check,
  Shield,
  Share2,
  Plus,
  Trash2,
  GripVertical,
  Moon,
  Type,
  Library,
  Megaphone,
  Rss,
  Zap,
  XCircle,
  Loader2,
} from "lucide-react";
import { uploadImage, cdnUrl } from "@/lib/upload";
import { getImageUrl, useSiteSettings } from "@/lib/site-settings-store";
import { apiFetch, getToken } from "@/lib/api-fetch";
import { SOCIAL_PLATFORMS, SocialIcon } from "@/components/SocialIcons";
import MediaPicker from "@/components/MediaPicker";
import EmailConfigSection from "./EmailConfigSection";
import AmapConfigSection from "./AmapConfigSection";

interface SiteSettings {
  siteName: string;
  description: string;
  keywords: string;
  domain: string;
  beian: string;
  beianUrl: string;
  faviconUrl: string;
  ogImage: string;
  musicUrl: string;
  musicId: string;
  musicSource: string;
  playlistId: string;
  socialLinks: string;
  postCollapseLength: number;
  darkModeEnabled: boolean;
  darkModeStartTime: string;
  darkModeEndTime: string;
  fontUrl: string;
  adOnArchives: boolean;
  rssEnabled: boolean;
  rssIncludeMoments: boolean;
  doubanId: string;
  cdnProxyUrl: string;
}

const DEFAULTS: SiteSettings = {
  siteName: "朋友圈博客",
  description: "一个像微信朋友圈一样的个人博客",
  keywords: "",
  domain: "",
  beian: "",
  beianUrl: "",
  faviconUrl: "",
  ogImage: "",
  musicUrl: "",
  musicId: "",
  musicSource: "netease",
  playlistId: "",
  socialLinks: "[]",
  postCollapseLength: 150,
  darkModeEnabled: false,
  darkModeStartTime: "18:00",
  darkModeEndTime: "06:00",
  fontUrl: "",
  adOnArchives: false,
  rssEnabled: true,
  rssIncludeMoments: true,
  doubanId: "",
  cdnProxyUrl: "",
};

interface SocialLink {
  type: string;
  url: string;
}

function SocialLinkEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (val: string) => void;
}) {
  let links: SocialLink[] = [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) links = parsed;
  } catch {
    links = [];
  }

  const update = (next: SocialLink[]) => onChange(JSON.stringify(next));

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const reorder = (from: number, to: number) => {
    if (from === to) return;
    const next = [...links];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    update(next);
  };

  return (
    <div className="space-y-2">
      {links.map((link, idx) => {
        const platform = SOCIAL_PLATFORMS.find((p) => p.type === link.type);
        const isDragging = dragIndex === idx;
        const isOver = overIndex === idx && dragIndex !== idx;
        return (
          <div
            key={idx}
            onDragOver={(e) => {
              e.preventDefault();
              if (overIndex !== idx) setOverIndex(idx);
            }}
            onDrop={() => {
              if (dragIndex !== null) reorder(dragIndex, idx);
              setDragIndex(null);
              setOverIndex(null);
            }}
            className={`flex items-center gap-2 rounded-xl border-2 ${
              isDragging
                ? "opacity-30 border-adm-primary"
                : isOver
                ? "border-adm-primary bg-adm-primary/5"
                : "border-transparent"
            }`}
          >
            {/* Drag handle — only this element is draggable */}
            <div
              draggable
              onDragStart={() => setDragIndex(idx)}
              onDragEnd={() => {
                setDragIndex(null);
                setOverIndex(null);
              }}
              className="flex h-10 w-5 shrink-0 cursor-grab items-center justify-center text-adm-text-tertiary active:cursor-grabbing"
              title="拖拽排序"
            >
              <GripVertical className="h-4 w-4" />
            </div>
            {/* Platform selector */}
            <div className="relative shrink-0">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-adm-border"
                style={{ color: platform?.color || "#999" }}
              >
                <SocialIcon type={link.type} className="h-5 w-5" />
              </div>
              <select
                value={link.type}
                onChange={(e) => {
                  const next = [...links];
                  next[idx] = { ...next[idx], type: e.target.value };
                  update(next);
                }}
                className="absolute inset-0 cursor-pointer opacity-0"
                title="选择平台"
              >
                {SOCIAL_PLATFORMS.map((p) => (
                  <option key={p.type} value={p.type}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            {/* URL input */}
            <input
              type="text"
              value={link.url}
              onChange={(e) => {
                const next = [...links];
                next[idx] = { ...next[idx], url: e.target.value };
                update(next);
              }}
              className="flex-1 rounded-xl border border-adm-border bg-adm-input px-3 py-2.5 text-sm text-adm-text transition-colors focus:border-adm-text-secondary focus:bg-adm-input-focus focus:outline-none focus:ring-1 focus:ring-adm-text-secondary"
              placeholder={`${platform?.label || "链接"}地址`}
            />
            {/* Delete button */}
            <button
              type="button"
              onClick={() => update(links.filter((_, i) => i !== idx))}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-adm-border text-adm-text-tertiary transition-colors hover:bg-adm-danger-bg hover:text-adm-danger"
              title="删除"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        );
      })}
      {/* Add button */}
      <button
        type="button"
        onClick={() => update([...links, { type: "github", url: "" }])}
        className="flex items-center gap-1.5 rounded-xl border border-dashed border-adm-border px-4 py-2.5 text-sm text-adm-text-secondary transition-colors hover:border-adm-text-secondary hover:text-adm-text"
      >
        <Plus className="h-4 w-4" />
        添加社交链接
      </button>
    </div>
  );
}

function ImageField({
  label,
  url,
  onChange,
  token,
  previewClass,
}: {
  label: string;
  url: string;
  onChange: (url: string) => void;
  token: string;
  previewClass: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const imageUrl = await uploadImage(file, token);
      onChange(imageUrl);
    } catch (err) {
      alert(err instanceof Error ? err.message : "上传失败");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mb-5">
      <label className="mb-1.5 block text-xs font-medium text-adm-text-secondary">
        {label}
      </label>
      <div className="flex items-center gap-4">
        <div className={`relative shrink-0 overflow-hidden bg-adm-input ${previewClass}`}>
          {url ? (
            <Image
              src={getImageUrl(url)}
              alt={label}
              fill
              className="object-cover"
              sizes="64px"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-adm-text-tertiary">
              <ImageIcon className="h-6 w-6" />
            </div>
          )}
        </div>
        <div className="flex-1 space-y-2">
          <input
            type="text"
            value={url}
            onChange={(e) => onChange(e.target.value)}
            placeholder="输入图片URL或上传"
            className="w-full rounded-xl border border-adm-border bg-adm-input px-3 py-2 text-sm text-adm-text transition-colors focus:border-adm-text-secondary focus:bg-adm-input-focus focus:outline-none focus:ring-1 focus:ring-adm-text-secondary"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 rounded-lg border border-adm-border bg-adm-card px-3 py-1.5 text-xs text-adm-text-secondary transition-colors hover:bg-adm-card-hover disabled:opacity-50"
            >
              <Upload className="h-3.5 w-3.5" />
              {uploading ? "上传中..." : "上传图片"}
            </button>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-adm-border bg-adm-card px-3 py-1.5 text-xs text-adm-text-secondary transition-colors hover:bg-adm-card-hover"
            >
              <Library className="h-3.5 w-3.5" />
              媒体库
            </button>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
            className="hidden"
          />
        </div>
      </div>
      <MediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        category="image"
        title={`从媒体库选择${label}`}
        onSelect={(item) => {
          onChange(item.url);
          setPickerOpen(false);
        }}
      />
    </div>
  );
}

/** CDN 代理测试按钮：用一张公开图片测试代理是否可用，显示预览结果 */
function CdnTestButton({ cdnProxyUrl }: { cdnProxyUrl: string }) {
  const [status, setStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const testImage = "https://www.baidu.com/img/flexible/logo/pc/result.png";

  const handleTest = () => {
    if (!cdnProxyUrl.trim()) {
      setStatus("idle");
      return;
    }
    setStatus("testing");
    setErrorMsg("");

    const proxiedUrl = cdnUrl(testImage, cdnProxyUrl.trim());
    const img = document.createElement("img");
    let finished = false;

    const timeout = setTimeout(() => {
      if (!finished) {
        finished = true;
        setStatus("error");
        setErrorMsg("超时（10s），代理可能不可用");
      }
    }, 10000);

    img.onload = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      if (img.naturalWidth > 1) {
        setStatus("success");
      } else {
        setStatus("error");
        setErrorMsg("返回了空白图片");
      }
    };

    img.onerror = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      setStatus("error");
      setErrorMsg("图片加载失败，请检查代理地址格式");
    };

    img.src = proxiedUrl;
  };

  if (!cdnProxyUrl.trim()) return null;

  const proxiedUrl = cdnUrl(testImage, cdnProxyUrl.trim());

  return (
    <div className="mt-3 rounded-lg border border-adm-border bg-adm-input/50 p-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleTest}
          disabled={status === "testing"}
          className="inline-flex items-center gap-1.5 rounded-lg bg-adm-primary px-3 py-1.5 text-xs font-medium text-adm-primary-text transition-opacity hover:opacity-80 disabled:opacity-50"
        >
          {status === "testing" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Zap className="h-3.5 w-3.5" />
          )}
          {status === "testing" ? "测试中..." : "测试代理"}
        </button>
        {status === "success" && (
          <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
            <Check className="h-3.5 w-3.5" /> 代理可用
          </span>
        )}
        {status === "error" && (
          <span className="inline-flex items-center gap-1 text-xs text-red-500">
            <XCircle className="h-3.5 w-3.5" /> {errorMsg}
          </span>
        )}
      </div>
      {status === "success" && (
        <div className="mt-2 flex items-center gap-2">
          <img
            src={proxiedUrl}
            alt="CDN test"
            className="h-12 w-12 rounded border border-adm-border object-cover"
          />
          <span className="text-xs text-adm-text-tertiary">
            通过 CDN 代理加载成功（{testImage}）
          </span>
        </div>
      )}
      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-adm-text-tertiary hover:text-adm-text-secondary">
          查看代理 URL
        </summary>
        <code className="mt-1 block break-all rounded bg-adm-input px-2 py-1 text-[10px] text-adm-text-secondary">
          {proxiedUrl}
        </code>
      </details>
    </div>
  );
}

export default function AdminSettings() {
  const router = useRouter();
  const [form, setForm] = useState<SiteSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const token = getToken();

  useEffect(() => {
    if (!token) {
      router.replace("/");
      return;
    }
    apiFetch("/settings")
      .then((res) => res.json())
      .then((data: SiteSettings) => {
        setForm({ ...DEFAULTS, ...data });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router, token]);

  const refreshSettings = useSiteSettings((s) => s.refreshSettings);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setSaved(false);

    const res = await apiFetch("/settings", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(form),
    });

    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      // 立即刷新前端设置 store，使 CDN 代理等配置即时生效
      refreshSettings();
    } else {
      const data = await res.json().catch(() => ({ message: "保存失败" }));
      alert(data.message || "保存失败");
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-adm-border border-t-adm-text" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-adm-text">网站设置</h2>
        <p className="mt-1 text-sm text-adm-text-secondary">
          管理网站名称、SEO 信息和站点配置
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-adm-border bg-adm-card p-5 shadow-sm"
      >
        <div className="grid grid-cols-1 gap-x-8 lg:grid-cols-2">
        {/* Left column: Basic info / SEO / Images / Legal / Posts */}
        <div>
        <div className="mb-6 flex items-center gap-2 border-b border-adm-border pb-3">
          <Settings2 className="h-4 w-4 text-adm-text-tertiary" />
          <h3 className="text-sm font-semibold text-adm-text">基本信息</h3>
        </div>

        {/* Site name */}
        <div className="mb-5">
          <label className="mb-1.5 block text-xs font-medium text-adm-text-secondary">
            网站名称
          </label>
          <div className="relative">
            <Settings2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-adm-text-tertiary" />
            <input
              type="text"
              value={form.siteName}
              onChange={(e) => setForm({ ...form, siteName: e.target.value })}
              className="w-full rounded-xl border border-adm-border bg-adm-input py-2.5 pl-10 pr-3 text-sm text-adm-text transition-colors focus:border-adm-text-secondary focus:bg-adm-input-focus focus:outline-none focus:ring-1 focus:ring-adm-text-secondary"
              placeholder="朋友圈博客"
            />
          </div>
          <p className="mt-1.5 text-xs text-adm-text-tertiary">
            显示在浏览器标签页标题和前台封面区域
          </p>
        </div>

        {/* Domain */}
        <div className="mb-5">
          <label className="mb-1.5 block text-xs font-medium text-adm-text-secondary">
            网站域名
          </label>
          <div className="relative">
            <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-adm-text-tertiary" />
            <input
              type="text"
              value={form.domain}
              onChange={(e) => setForm({ ...form, domain: e.target.value })}
              className="w-full rounded-xl border border-adm-border bg-adm-input py-2.5 pl-10 pr-3 text-sm text-adm-text transition-colors focus:border-adm-text-secondary focus:bg-adm-input-focus focus:outline-none focus:ring-1 focus:ring-adm-text-secondary"
              placeholder="https://example.com"
            />
          </div>
          <p className="mt-1.5 text-xs text-adm-text-tertiary">
            用于生成绝对 URL、Open Graph 链接和友链引用
          </p>
        </div>

        {/* SEO section */}
        <div className="mb-6 mt-8 flex items-center gap-2 border-b border-adm-border pb-3">
          <Search className="h-4 w-4 text-adm-text-tertiary" />
          <h3 className="text-sm font-semibold text-adm-text">SEO 优化</h3>
        </div>

        {/* Description */}
        <div className="mb-5">
          <label className="mb-1.5 block text-xs font-medium text-adm-text-secondary">
            网站描述（Description）
          </label>
          <textarea
            value={form.description}
            onChange={(e) =>
              setForm({ ...form, description: e.target.value })
            }
            rows={3}
            className="w-full resize-none rounded-xl border border-adm-border bg-adm-input px-3 py-2.5 text-sm text-adm-text transition-colors focus:border-adm-text-secondary focus:bg-adm-input-focus focus:outline-none focus:ring-1 focus:ring-adm-text-secondary"
            placeholder="一句话描述你的网站，将显示在搜索引擎结果中"
          />
          <p className="mt-1.5 text-xs text-adm-text-tertiary">
            建议长度 50-160 字符，用于搜索引擎 meta description
          </p>
        </div>

        {/* Keywords */}
        <div className="mb-5">
          <label className="mb-1.5 block text-xs font-medium text-adm-text-secondary">
            关键词（Keywords）
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-adm-text-tertiary" />
            <textarea
              value={form.keywords}
              onChange={(e) => setForm({ ...form, keywords: e.target.value })}
              rows={2}
              className="w-full resize-none rounded-xl border border-adm-border bg-adm-input py-2.5 pl-10 pr-3 text-sm text-adm-text transition-colors focus:border-adm-text-secondary focus:bg-adm-input-focus focus:outline-none focus:ring-1 focus:ring-adm-text-secondary"
              placeholder="博客, 个人博客, 朋友圈, 逗号分隔"
            />
          </div>
          <p className="mt-1.5 text-xs text-adm-text-tertiary">
            用英文逗号分隔，用于搜索引擎 meta keywords
          </p>
        </div>

        {/* Images section */}
        <div className="mb-6 mt-8 flex items-center gap-2 border-b border-adm-border pb-3">
          <ImageIcon className="h-4 w-4 text-adm-text-tertiary" />
          <h3 className="text-sm font-semibold text-adm-text">站点图片</h3>
        </div>

        <ImageField
          label="Favicon 网站图标"
          url={form.faviconUrl}
          onChange={(faviconUrl) => setForm({ ...form, faviconUrl })}
          token={token || ""}
          previewClass="h-12 w-12 rounded-lg"
        />

        <ImageField
          label="OG 分享封面图"
          url={form.ogImage}
          onChange={(ogImage) => setForm({ ...form, ogImage })}
          token={token || ""}
          previewClass="h-20 w-32 rounded-xl"
        />

        {/* Legal section */}
        <div className="mb-6 mt-8 flex items-center gap-2 border-b border-adm-border pb-3">
          <Shield className="h-4 w-4 text-adm-text-tertiary" />
          <h3 className="text-sm font-semibold text-adm-text">备案与合规</h3>
        </div>

        {/* Beian */}
        <div className="mb-6">
          <label className="mb-1.5 block text-xs font-medium text-adm-text-secondary">
            备案号
          </label>
          <div className="relative">
            <FileText className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-adm-text-tertiary" />
            <input
              type="text"
              value={form.beian}
              onChange={(e) => setForm({ ...form, beian: e.target.value })}
              className="w-full rounded-xl border border-adm-border bg-adm-input py-2.5 pl-10 pr-3 text-sm text-adm-text transition-colors focus:border-adm-text-secondary focus:bg-adm-input-focus focus:outline-none focus:ring-1 focus:ring-adm-text-secondary"
              placeholder="如：京ICP备12345678号"
            />
          </div>
          <p className="mt-1.5 text-xs text-adm-text-tertiary">
            中国大陆站点需填写备案号，将显示在页面底部
          </p>
        </div>

        <div className="mb-6">
          <label className="mb-1.5 block text-xs font-medium text-adm-text-secondary">
            备案跳转链接
          </label>
          <div className="relative">
            <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-adm-text-tertiary" />
            <input
              type="text"
              value={form.beianUrl}
              onChange={(e) => setForm({ ...form, beianUrl: e.target.value })}
              className="w-full rounded-xl border border-adm-border bg-adm-input py-2.5 pl-10 pr-3 text-sm text-adm-text transition-colors focus:border-adm-text-secondary focus:bg-adm-input-focus focus:outline-none focus:ring-1 focus:ring-adm-text-secondary"
              placeholder="https://beian.miit.gov.cn"
            />
          </div>
          <p className="mt-1.5 text-xs text-adm-text-tertiary">
            点击备案号跳转的链接，默认为工信部备案查询网站
          </p>
        </div>

        {/* Font config */}
        <div className="mb-6 mt-8 flex items-center gap-2 border-b border-adm-border pb-3">
          <Type className="h-4 w-4 text-adm-text-tertiary" />
          <h3 className="text-sm font-semibold text-adm-text">字体设置</h3>
        </div>

        <div className="mb-6">
          <label className="mb-1.5 block text-xs font-medium text-adm-text-secondary">
            自定义字体 CSS 链接
          </label>
          <div className="relative">
            <Type className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-adm-text-tertiary" />
            <input
              type="text"
              value={form.fontUrl}
              onChange={(e) => setForm({ ...form, fontUrl: e.target.value })}
              className="w-full rounded-xl border border-adm-border bg-adm-input py-2.5 pl-10 pr-3 text-sm text-adm-text transition-colors focus:border-adm-text-secondary focus:bg-adm-input-focus focus:outline-none focus:ring-1 focus:ring-adm-text-secondary"
              placeholder="https://example.com/font.css"
            />
          </div>
          <p className="mt-1.5 text-xs text-adm-text-tertiary">
            留空使用内嵌 HarmonyOS Sans 字体（
            <code className="rounded bg-adm-input px-1 py-0.5 text-[11px]">/fonts/embedded-font.css</code>
            ）。填写后将以自定义 CSS 链接加载字体，需包含 @font-face 声明。
          </p>
        </div>

        {/* CDN image proxy config */}
        <div className="mb-6 mt-8 flex items-center gap-2 border-b border-adm-border pb-3">
          <ImageIcon className="h-4 w-4 text-adm-text-tertiary" />
          <h3 className="text-sm font-semibold text-adm-text">图片 CDN 加速</h3>
        </div>

        <div className="mb-6">
          <label className="mb-1.5 block text-xs font-medium text-adm-text-secondary">
            CDN 代理地址
          </label>
          <div className="relative">
            <ImageIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-adm-text-tertiary" />
            <input
              type="text"
              value={form.cdnProxyUrl}
              onChange={(e) => setForm({ ...form, cdnProxyUrl: e.target.value })}
              className="w-full rounded-xl border border-adm-border bg-adm-input py-2.5 pl-10 pr-3 text-sm text-adm-text transition-colors focus:border-adm-text-secondary focus:bg-adm-input-focus focus:outline-none focus:ring-1 focus:ring-adm-text-secondary"
              placeholder="https://gimg0.baidu.com/gimg/app=2001&n=0&g=0n&fmt=jpeg&src="
            />
          </div>
          <p className="mt-1.5 text-xs text-adm-text-tertiary">
            填写后前端所有图片将经过此代理加载（地址 + 原图URL编码拼接）。留空则使用原图地址。支持格式：<code className="rounded bg-adm-input px-1 py-0.5 text-[11px]">https://gimg0.baidu.com/gimg/app=2001&n=0&g=0n&fmt=jpeg&src=</code>（百度图床）、<code className="rounded bg-adm-input px-1 py-0.5 text-[11px]">https://images.weserv.nl/?url=</code>（weserv）
          </p>
          <CdnTestButton cdnProxyUrl={form.cdnProxyUrl} />
        </div>

        {/* Post display config */}
        <div className="mb-6 mt-8 flex items-center gap-2 border-b border-adm-border pb-3">
          <FileText className="h-4 w-4 text-adm-text-tertiary" />
          <h3 className="text-sm font-semibold text-adm-text">动态展示</h3>
        </div>

        <div className="mb-6">
          <label className="mb-1.5 block text-xs font-medium text-adm-text-secondary">
            长文折叠字数
          </label>
          <input
            type="number"
            min={0}
            max={10000}
            value={form.postCollapseLength}
            onChange={(e) =>
              setForm({
                ...form,
                postCollapseLength: parseInt(e.target.value) || 0,
              })
            }
            className="w-32 rounded-lg border border-adm-border bg-adm-bg px-3 py-2 text-sm text-adm-text focus:border-adm-primary focus:outline-none focus:ring-1 focus:ring-adm-primary"
            placeholder="150"
          />
          <p className="mt-1.5 text-xs text-adm-text-tertiary">
            动态文字超过此字数时自动折叠，显示"展开"按钮；设为 0 则不折叠
          </p>
        </div>

        {/* Right column: Dark mode / Social links */}
        </div>
        <div>

        {/* Dark mode auto-schedule section */}
        <div className="mb-6 mt-8 flex items-center gap-2 border-b border-adm-border pb-3">
          <Moon className="h-4 w-4 text-adm-text-tertiary" />
          <h3 className="text-sm font-semibold text-adm-text">夜间模式</h3>
        </div>

        <div className="mb-6">
          <label className="mb-1.5 block text-xs font-medium text-adm-text-secondary">
            自动调度
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={form.darkModeEnabled}
              onChange={(e) => setForm({ ...form, darkModeEnabled: e.target.checked })}
              className="h-4 w-4 rounded border-adm-border text-adm-primary focus:ring-adm-primary"
            />
            <span className="text-sm text-adm-text">按时间段自动切换深色模式</span>
          </label>
          <p className="mt-1.5 text-xs text-adm-text-tertiary">
            开启后在设定时段自动切换夜间模式；前端手动按钮仍可临时覆盖（2 小时后恢复自动）
          </p>
        </div>

        <div className="mb-6 flex gap-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-adm-text-secondary">
              夜间开始
            </label>
            <input
              type="time"
              value={form.darkModeStartTime}
              disabled={!form.darkModeEnabled}
              onChange={(e) => setForm({ ...form, darkModeStartTime: e.target.value })}
              className="rounded-lg border border-adm-border bg-adm-bg px-3 py-2 text-sm text-adm-text focus:border-adm-primary focus:outline-none focus:ring-1 focus:ring-adm-primary disabled:opacity-50"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-adm-text-secondary">
              夜间结束
            </label>
            <input
              type="time"
              value={form.darkModeEndTime}
              disabled={!form.darkModeEnabled}
              onChange={(e) => setForm({ ...form, darkModeEndTime: e.target.value })}
              className="rounded-lg border border-adm-border bg-adm-bg px-3 py-2 text-sm text-adm-text focus:border-adm-primary focus:outline-none focus:ring-1 focus:ring-adm-primary disabled:opacity-50"
            />
          </div>
        </div>

        {/* Ad placement section */}
        <div className="mb-6 mt-8 flex items-center gap-2 border-b border-adm-border pb-3">
          <Megaphone className="h-4 w-4 text-adm-text-tertiary" />
          <h3 className="text-sm font-semibold text-adm-text">广告设置</h3>
        </div>

        <div className="mb-6 flex items-center gap-3">
          <input
            type="checkbox"
            id="adOnArchives"
            checked={form.adOnArchives}
            onChange={(e) => setForm({ ...form, adOnArchives: e.target.checked })}
            className="h-4 w-4 rounded border-adm-border text-adm-primary focus:ring-adm-primary"
          />
          <label htmlFor="adOnArchives" className="text-sm text-adm-text">
            在归档页显示广告
          </label>
          <p className="text-xs text-adm-text-tertiary">
            开启后广告会出现在归档页时间线中（第 5 条动态之后）
          </p>
        </div>

        {/* RSS feed section */}
        <div className="mb-6 mt-8 flex items-center gap-2 border-b border-adm-border pb-3">
          <Rss className="h-4 w-4 text-adm-text-tertiary" />
          <h3 className="text-sm font-semibold text-adm-text">RSS 订阅</h3>
        </div>

        <div className="mb-6 flex items-center gap-3">
          <input
            type="checkbox"
            id="rssEnabled"
            checked={form.rssEnabled}
            onChange={(e) => setForm({ ...form, rssEnabled: e.target.checked })}
            className="h-4 w-4 rounded border-adm-border text-adm-primary focus:ring-adm-primary"
          />
          <label htmlFor="rssEnabled" className="text-sm text-adm-text">
            开启 RSS 订阅
          </label>
          <p className="text-xs text-adm-text-tertiary">
            关闭后 /feed 将返回 404，订阅器无法获取内容
          </p>
        </div>

        <div className="mb-6 flex items-center gap-3">
          <input
            type="checkbox"
            id="rssIncludeMoments"
            checked={form.rssIncludeMoments}
            disabled={!form.rssEnabled}
            onChange={(e) => setForm({ ...form, rssIncludeMoments: e.target.checked })}
            className="h-4 w-4 rounded border-adm-border text-adm-primary focus:ring-adm-primary disabled:opacity-50"
          />
          <label htmlFor="rssIncludeMoments" className="text-sm text-adm-text">
            订阅包含动态
          </label>
          <p className="text-xs text-adm-text-tertiary">
            关闭后 RSS 只输出文章，不包含朋友圈动态
          </p>
        </div>

        {/* Social links section */}
        <div className="mb-6 mt-8 flex items-center gap-2 border-b border-adm-border pb-3">
          <Share2 className="h-4 w-4 text-adm-text-tertiary" />
          <h3 className="text-sm font-semibold text-adm-text">社交链接</h3>
        </div>

        <div className="mb-6">
          <p className="mb-3 text-xs text-adm-text-tertiary">
            拖拽左侧手柄调整显示顺序，点击图标可切换平台。顺序即为侧边栏展示顺序
          </p>
          <SocialLinkEditor
            value={form.socialLinks}
            onChange={(socialLinks) => setForm({ ...form, socialLinks })}
          />
        </div>

        {/* Close right column + grid wrapper */}
        </div>
        </div>

        <button
          type="submit"
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
              {saving ? "保存中..." : "保存设置"}
            </>
          )}
        </button>
      </form>

      {/* Email + Amap config 并排 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <EmailConfigSection />
        <AmapConfigSection />
      </div>
    </div>
  );
}
