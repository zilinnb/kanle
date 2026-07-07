"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Upload,
  UserCircle,
  ImageIcon,
  Mail,
  User,
  FileText,
  Globe,
  Lock,
  Eye,
  EyeOff,
  Save,
  Check,
  Library,
  Plus,
  Trash2,
} from "lucide-react";
import { uploadImage, toAbsoluteUrl } from "@/lib/upload";
import { resolveAvatar } from "@/lib/avatar";
import { apiFetch, getToken } from "@/lib/api-fetch";
import MediaPicker from "@/components/MediaPicker";

interface User {
  id: string;
  email: string;
  username: string;
  nickname: string;
  avatar: string;
  cover: string;
  bio: string;
  website: string;
}

function ImageField({
  label,
  url,
  onChange,
  token,
  rounded = false,
}: {
  label: string;
  url: string;
  onChange: (url: string) => void;
  token: string;
  rounded?: boolean;
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
        <div
          className={`relative shrink-0 overflow-hidden bg-adm-input ${
            rounded ? "h-16 w-16 rounded-full" : "h-20 w-32 rounded-xl"
          }`}
        >
          {url ? (
            <Image
              src={toAbsoluteUrl(url)}
              alt={label}
              fill
              className="object-cover"
              sizes={rounded ? "64px" : "128px"}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-adm-text-tertiary">
              {rounded ? (
                <UserCircle className="h-8 w-8" />
              ) : (
                <ImageIcon className="h-7 w-7" />
              )}
            </div>
          )}
        </div>
        <div className="flex-1 space-y-2">
          <input
            type="text"
            value={url}
            onChange={(e) => onChange(e.target.value)}
            placeholder="留空则使用Cravatar头像"
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

/** 多张背景图轮播编辑器：每次访问随机展示一张 */
function BackgroundImagesEditor({
  images,
  onChange,
  token,
}: {
  images: string[];
  onChange: (next: string[]) => void;
  token: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [urlInput, setUrlInput] = useState("");

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const imageUrl = await uploadImage(file, token);
      onChange([...images, imageUrl]);
    } catch (err) {
      alert(err instanceof Error ? err.message : "上传失败");
    } finally {
      setUploading(false);
    }
  };

  const addUrl = () => {
    const url = urlInput.trim();
    if (!url) return;
    onChange([...images, url]);
    setUrlInput("");
  };

  const removeAt = (idx: number) => {
    onChange(images.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-3">
      {/* 已添加的图片网格 */}
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {images.map((url, idx) => (
            <div
              key={`${url}-${idx}`}
              className="group relative aspect-video overflow-hidden rounded-lg border border-adm-border bg-adm-input"
            >
              <Image
                src={toAbsoluteUrl(url)}
                alt={`背景图 ${idx + 1}`}
                fill
                className="object-cover"
                sizes="120px"
              />
              <button
                type="button"
                onClick={() => removeAt(idx)}
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/80"
                title="删除"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                {idx + 1}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 添加新图片：URL 输入 + 上传 + 媒体库 */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addUrl();
              }
            }}
            placeholder="输入图片URL，回车或点击添加"
            className="flex-1 rounded-xl border border-adm-border bg-adm-input px-3 py-2 text-sm text-adm-text transition-colors focus:border-adm-text-secondary focus:bg-adm-input-focus focus:outline-none focus:ring-1 focus:ring-adm-text-secondary"
          />
          <button
            type="button"
            onClick={addUrl}
            disabled={!urlInput.trim()}
            className="flex items-center gap-1 rounded-lg border border-adm-border bg-adm-card px-3 py-2 text-xs text-adm-text-secondary transition-colors hover:bg-adm-card-hover disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            添加
          </button>
        </div>
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
            从媒体库选择
          </button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
          className="hidden"
        />
      </div>

      <MediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        category="image"
        title="从媒体库选择背景图"
        onSelect={(item) => {
          onChange([...images, item.url]);
          setPickerOpen(false);
        }}
      />
    </div>
  );
}

export default function AdminUsers() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [form, setForm] = useState({
    email: "",
    username: "",
    nickname: "",
    bio: "",
    website: "",
    avatar: "",
    cover: "",
  });
  const [backgroundImages, setBackgroundImages] = useState<string[]>([]);
  const [password, setPassword] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const token = getToken();

  useEffect(() => {
    if (!token) {
      router.replace("/");
      return;
    }

    Promise.all([
      apiFetch("/admin/users").then((res) => res.json()),
      fetch(`${process.env.NEXT_PUBLIC_API_URL || "/api"}/settings`, { cache: "no-store" }).then((res) => res.json()),
    ])
      .then(([data, settings]: [User[], any]) => {
        if (Array.isArray(data)) {
          const admin = data[0];
          if (admin) {
            setUser(admin);
            setForm({
              email: admin.email || "",
              username: admin.username || "",
              nickname: admin.nickname,
              bio: admin.bio,
              website: admin.website || "",
              avatar: admin.avatar,
              cover: admin.cover,
            });
          }
        }
        // 解析 backgroundImages（JSON 字符串 → 数组）
        let bgImages: string[] = [];
        const raw = settings?.backgroundImages;
        if (Array.isArray(raw)) {
          bgImages = raw;
        } else if (typeof raw === "string" && raw) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) bgImages = parsed.filter((u) => typeof u === "string");
          } catch {
            bgImages = [];
          }
        }
        // 如果后端没有轮播图但用户有封面图，用封面图初始化
        const cover = data?.[0]?.cover;
        if (bgImages.length === 0 && cover) {
          bgImages = [cover];
        }
        setBackgroundImages(bgImages);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router, token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !user) return;
    setSaving(true);
    setSaved(false);

    // 同步 cover 为背景图第一张（或空），保持向后兼容
    const coverSynced = backgroundImages[0] || "";
    const formWithCover = { ...form, cover: coverSynced };

    const res = await apiFetch(`/admin/users/${user.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formWithCover),
    });

    // 同时保存背景图轮播到网站设置
    const settingsRes = await apiFetch("/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ backgroundImages: JSON.stringify(backgroundImages) }),
    });

    if (res.ok && settingsRes.ok) {
      // Sync localStorage so TopBar shows updated profile without re-login
      localStorage.setItem("admin_nickname", form.nickname);
      localStorage.setItem("admin_email", form.email);
      localStorage.setItem("admin_avatar", form.avatar);
      localStorage.setItem("admin_cover", coverSynced);
      localStorage.setItem("admin_bio", form.bio);
      localStorage.setItem("admin_website", form.website);
      setForm({ ...form, cover: coverSynced });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } else {
      const data = await res.json().catch(() => ({ message: "保存失败" }));
      alert(data.message || "保存失败");
    }
    setSaving(false);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (password.newPassword !== password.confirmPassword) {
      alert("两次新密码不一致");
      return;
    }
    setChangingPassword(true);

    const res = await apiFetch("/admin/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        oldPassword: password.oldPassword,
        newPassword: password.newPassword,
      }),
    });

    if (res.ok) {
      alert("密码修改成功");
      setPassword({ oldPassword: "", newPassword: "", confirmPassword: "" });
    } else {
      const data = await res.json().catch(() => ({ message: "修改失败" }));
      alert(data.message || "修改失败");
    }
    setChangingPassword(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-adm-border border-t-adm-text" />
      </div>
    );
  }

  const previewAvatar = resolveAvatar(form.avatar, form.email, 128);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-adm-text">个人资料</h2>
        <p className="mt-1 text-sm text-adm-text-secondary">管理你的博客信息和头像</p>
      </div>

      {/* Profile + Password forms — 双栏布局（桌面端） */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Profile form */}
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-adm-border bg-adm-card p-5 shadow-sm"
      >
        {/* Avatar preview + email */}
        <div className="mb-6 flex flex-col items-center gap-4 rounded-xl bg-adm-input p-5 sm:flex-row sm:items-center">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border-4 border-adm-card shadow-md">
            <Image
              src={previewAvatar}
              alt="头像预览"
              fill
              className="object-cover"
              sizes="80px"
              unoptimized={previewAvatar.endsWith(".svg")}
            />
          </div>
          <div className="text-center sm:text-left">
            <p className="text-sm font-medium text-adm-text">{form.nickname || "博主"}</p>
            <p className="text-xs text-adm-text-tertiary">
              {form.avatar ? "使用上传的头像" : "使用Cravatar邮箱头像"}
            </p>
          </div>
        </div>

        {/* Email field */}
        <div className="mb-5">
          <label className="mb-1.5 block text-xs font-medium text-adm-text-secondary">
            邮箱（用于Cravatar头像）
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-adm-text-tertiary" />
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full rounded-xl border border-adm-border bg-adm-input py-2.5 pl-10 pr-3 text-sm text-adm-text transition-colors focus:border-adm-text-secondary focus:bg-adm-input-focus focus:outline-none focus:ring-1 focus:ring-adm-text-secondary"
              placeholder="your@email.com"
            />
          </div>
          <p className="mt-1.5 text-xs text-adm-text-tertiary">
            填写邮箱后，如未上传自定义头像，将自动使用Cravatar头像
          </p>
        </div>

        {/* Username field */}
        <div className="mb-5">
          <label className="mb-1.5 block text-xs font-medium text-adm-text-secondary">
            用户名（用于登录）
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-adm-text-tertiary" />
            <input
              type="text"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value.trim() })}
              className="w-full rounded-xl border border-adm-border bg-adm-input py-2.5 pl-10 pr-3 text-sm text-adm-text transition-colors focus:border-adm-text-secondary focus:bg-adm-input-focus focus:outline-none focus:ring-1 focus:ring-adm-text-secondary"
              placeholder="3-50个字符，仅字母数字下划线"
              pattern="[a-zA-Z0-9_]{3,50}"
            />
          </div>
          <p className="mt-1.5 text-xs text-adm-text-tertiary">
            可使用用户名或邮箱登录后台
          </p>
        </div>

        {/* 背景图轮播（整合封面图）：添加多张则每次访问随机展示一张 */}
        <div className="mb-5">
          <label className="mb-1.5 block text-xs font-medium text-adm-text-secondary">
            背景图（轮播）
          </label>
          <BackgroundImagesEditor
            images={backgroundImages}
            onChange={setBackgroundImages}
            token={token || ""}
          />
          <p className="mt-2 text-xs text-adm-text-tertiary">
            添加一张即为固定封面；添加多张则每次访问首页随机展示其中一张
          </p>
        </div>

        {/* Avatar */}
        <ImageField
          label="自定义头像（可选，优先使用）"
          url={form.avatar}
          onChange={(avatar) => setForm({ ...form, avatar })}
          token={token || ""}
          rounded
        />

        {/* Nickname */}
        <div className="mb-5">
          <label className="mb-1.5 block text-xs font-medium text-adm-text-secondary">
            昵称
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-adm-text-tertiary" />
            <input
              type="text"
              value={form.nickname}
              onChange={(e) => setForm({ ...form, nickname: e.target.value })}
              className="w-full rounded-xl border border-adm-border bg-adm-input py-2.5 pl-10 pr-3 text-sm text-adm-text transition-colors focus:border-adm-text-secondary focus:bg-adm-input-focus focus:outline-none focus:ring-1 focus:ring-adm-text-secondary"
            />
          </div>
        </div>

        {/* Bio */}
        <div className="mb-5">
          <label className="mb-1.5 block text-xs font-medium text-adm-text-secondary">
            个性签名
          </label>
          <div className="relative">
            <FileText className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-adm-text-tertiary" />
            <input
              type="text"
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              className="w-full rounded-xl border border-adm-border bg-adm-input py-2.5 pl-10 pr-3 text-sm text-adm-text transition-colors focus:border-adm-text-secondary focus:bg-adm-input-focus focus:outline-none focus:ring-1 focus:ring-adm-text-secondary"
              placeholder="一句话介绍自己..."
            />
          </div>
        </div>

        {/* Website */}
        <div className="mb-6">
          <label className="mb-1.5 block text-xs font-medium text-adm-text-secondary">
            本网站域名
          </label>
          <div className="relative">
            <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-adm-text-tertiary" />
            <input
              type="text"
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
              className="w-full rounded-xl border border-adm-border bg-adm-input py-2.5 pl-10 pr-3 text-sm text-adm-text transition-colors focus:border-adm-text-secondary focus:bg-adm-input-focus focus:outline-none focus:ring-1 focus:ring-adm-text-secondary"
              placeholder="https://example.com"
            />
          </div>
          <p className="mt-1.5 text-xs text-adm-text-tertiary">
            博主的个人网站地址，前台昵称点击可跳转
          </p>
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
              {saving ? "保存中..." : "保存资料"}
            </>
          )}
        </button>
      </form>

      {/* Password change */}
      <form
        onSubmit={handleChangePassword}
        className="rounded-2xl border border-adm-border bg-adm-card p-5 shadow-sm"
      >
        <div className="mb-5 flex items-center gap-2">
          <Lock className="h-4 w-4 text-adm-text-tertiary" />
          <h3 className="text-sm font-semibold text-adm-text">修改密码</h3>
        </div>

        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-medium text-adm-text-secondary">
            原密码
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-adm-text-tertiary" />
            <input
              type={showOldPassword ? "text" : "password"}
              value={password.oldPassword}
              onChange={(e) =>
                setPassword({ ...password, oldPassword: e.target.value })
              }
              className="w-full rounded-xl border border-adm-border bg-adm-input py-2.5 pl-10 pr-10 text-sm text-adm-text transition-colors focus:border-adm-text-secondary focus:bg-adm-input-focus focus:outline-none focus:ring-1 focus:ring-adm-text-secondary"
              required
            />
            <button
              type="button"
              onClick={() => setShowOldPassword(!showOldPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-adm-text-tertiary hover:text-adm-text-secondary"
            >
              {showOldPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-medium text-adm-text-secondary">
            新密码
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-adm-text-tertiary" />
            <input
              type={showNewPassword ? "text" : "password"}
              value={password.newPassword}
              onChange={(e) =>
                setPassword({ ...password, newPassword: e.target.value })
              }
              className="w-full rounded-xl border border-adm-border bg-adm-input py-2.5 pl-10 pr-10 text-sm text-adm-text transition-colors focus:border-adm-text-secondary focus:bg-adm-input-focus focus:outline-none focus:ring-1 focus:ring-adm-text-secondary"
              required
              minLength={6}
            />
            <button
              type="button"
              onClick={() => setShowNewPassword(!showNewPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-adm-text-tertiary hover:text-adm-text-secondary"
            >
              {showNewPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        <div className="mb-6">
          <label className="mb-1.5 block text-xs font-medium text-adm-text-secondary">
            确认新密码
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-adm-text-tertiary" />
            <input
              type={showNewPassword ? "text" : "password"}
              value={password.confirmPassword}
              onChange={(e) =>
                setPassword({ ...password, confirmPassword: e.target.value })
              }
              className="w-full rounded-xl border border-adm-border bg-adm-input py-2.5 pl-10 pr-3 text-sm text-adm-text transition-colors focus:border-adm-text-secondary focus:bg-adm-input-focus focus:outline-none focus:ring-1 focus:ring-adm-text-secondary"
              required
              minLength={6}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={changingPassword}
          className="flex items-center gap-2 rounded-xl border border-adm-border bg-adm-card px-5 py-2.5 text-sm font-medium text-adm-text transition-colors hover:bg-adm-card-hover disabled:opacity-50"
        >
          <Lock className="h-4 w-4" />
          {changingPassword ? "修改中..." : "修改密码"}
        </button>
      </form>
      </div>
    </div>
  );
}
