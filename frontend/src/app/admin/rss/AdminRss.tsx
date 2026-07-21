"use client";

import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Rss,
  Plus,
  Trash2,
  Pencil,
  Save,
  X,
  Globe,
  ExternalLink,
  GripVertical,
  ImagePlus,
  Upload,
  Link2,
  Mail,
  Check,
  Eraser,
  RefreshCw,
} from "lucide-react";
import { cravatarUrl } from "@/lib/avatar";
import { apiFetch, getToken } from "@/lib/api-fetch";
import { uploadImage, toAbsoluteUrl } from "@/lib/upload";
import { useExitAnimation } from "@/lib/use-exit-animation";
import ConfirmDialog from "@/components/admin/ConfirmDialog";

interface RssSource {
  id: string;
  name: string;
  url: string;
  avatar: string;
  desc: string;
  sort: number;
  articleCount: number;
}

interface FormState {
  name: string;
  url: string;
  desc: string;
  avatar: string;
}

const EMPTY_FORM: FormState = { name: "", url: "", desc: "", avatar: "" };

/**
 * 解析订阅源头像为最终 URL：
 * - 邮箱（含 @ 且非 http）→ Cravatar
 * - 图片直连 / 上传路径 → 原值转绝对 URL
 */
function resolveSourceAvatar(source: { avatar?: string }, size = 96): string {
  const avatar = (source.avatar || "").trim();
  if (!avatar) return "";
  if (!avatar.startsWith("http") && avatar.includes("@")) {
    return cravatarUrl(avatar, size);
  }
  return toAbsoluteUrl(avatar);
}

export default function AdminRss() {
  const router = useRouter();
  const [sources, setSources] = useState<RssSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };
  const { closing, handleClose } = useExitAnimation(closeForm, 200);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const token = getToken();

  const fetchSources = async () => {
    try {
      const res = await apiFetch("/rss/sources");
      if (res.ok) {
        const data = await res.json();
        setSources(data.data || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      router.replace("/");
      return;
    }
    fetchSources();
  }, [router, token]);

  const startAdd = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(true);
  };

  const startEdit = (source: RssSource) => {
    setForm({
      name: source.name,
      url: source.url,
      desc: source.desc,
      avatar: (source.avatar || "").trim(),
    });
    setEditingId(source.id);
    setShowForm(true);
  };

  const handleAvatarUpload = async (file: File) => {
    if (!token) return;
    setUploadingAvatar(true);
    try {
      const url = await uploadImage(file, token);
      setForm((f) => ({ ...f, avatar: url }));
    } catch (e) {
      alert((e as Error).message || "上传失败");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.url.trim()) return;
    setSaving(true);

    const isEdit = editingId !== null;
    const path = isEdit ? `/rss/sources/${editingId}` : `/rss/sources`;
    const method = isEdit ? "PUT" : "POST";

    const res = await apiFetch(path, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(form),
    });

    if (res.ok) {
      handleClose();
      fetchSources();
    } else {
      const data = await res.json().catch(() => ({ message: "保存失败" }));
      alert(data.message || "保存失败");
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const res = await apiFetch(`/rss/sources/${id}`, {
      method: "DELETE",
    });
    if (res.ok) fetchSources();
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await apiFetch("/rss/refresh", {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(
          `刷新完成：共 ${data.total ?? 0} 个订阅源，新增 ${data.inserted ?? 0} 篇文章`
        );
        fetchSources();
      } else {
        const data = await res.json().catch(() => ({ message: "刷新失败" }));
        alert(data.message || "刷新失败");
      }
    } catch {
      alert("刷新失败");
    } finally {
      setRefreshing(false);
    }
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-adm-text">友圈管理</h2>
          <p className="mt-1 text-sm text-adm-text-secondary">
            管理 RSS 订阅源，聚合友圈文章
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 rounded-xl border border-adm-border px-4 py-2 text-sm font-medium text-adm-text-secondary transition-colors hover:bg-adm-card-hover disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "刷新中..." : "刷新所有"}
          </button>
          {!showForm && (
            <button
              onClick={startAdd}
              className="flex items-center gap-1.5 rounded-xl bg-adm-primary px-4 py-2 text-sm font-medium text-adm-primary-text transition-colors hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              添加订阅源
            </button>
          )}
        </div>
      </div>

      {/* Add/Edit form */}
      {(showForm || closing) && createPortal(
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 ${
            closing ? "animate-overlay-out" : "animate-overlay-in"
          }`}
          onClick={handleClose}
        >
        <form
          onSubmit={handleSave}
          onClick={(e) => e.stopPropagation()}
          className={`w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-adm-border bg-adm-card p-5 shadow-lg ${
            closing ? "animate-modal-out" : "animate-modal-in"
          }`}
        >
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-adm-text">
              {editingId ? "编辑订阅源" : "添加订阅源"}
            </h3>
            <button
              type="button"
              onClick={handleClose}
              className="text-adm-text-tertiary transition-colors hover:text-adm-text-secondary"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-adm-text-secondary">
              名称
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-xl border border-adm-border bg-adm-input px-3 py-2.5 text-sm text-adm-text transition-colors focus:border-adm-text-secondary focus:bg-adm-input-focus focus:outline-none focus:ring-1 focus:ring-adm-text-secondary"
              placeholder="订阅源名称"
            />
          </div>

          <div className="mt-4">
            <label className="mb-1.5 block text-xs font-medium text-adm-text-secondary">
              RSS 地址
            </label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-adm-text-tertiary" />
              <input
                type="text"
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                className="w-full rounded-xl border border-adm-border bg-adm-input py-2.5 pl-10 pr-3 text-sm text-adm-text transition-colors focus:border-adm-text-secondary focus:bg-adm-input-focus focus:outline-none focus:ring-1 focus:ring-adm-text-secondary"
                placeholder="https://example.com/rss.xml"
              />
            </div>
          </div>

          {/* 头像：支持上传 / 图片链接 */}
          <div className="mt-4">
            <label className="mb-1.5 block text-xs font-medium text-adm-text-secondary">
              头像（选填）
            </label>
            <div className="flex items-start gap-4">
              {/* 左侧：头像预览 + 上传按钮 */}
              <div className="shrink-0 flex flex-col items-center gap-2">
                <div
                  onClick={() => avatarInputRef.current?.click()}
                  className="group relative h-20 w-20 cursor-pointer overflow-hidden rounded-full border border-adm-border bg-adm-input transition-colors hover:border-adm-text-secondary"
                  title="点击上传图片"
                >
                  {resolveSourceAvatar(form, 160) ? (
                    <Image
                      src={resolveSourceAvatar(form, 160)}
                      alt="头像预览"
                      fill
                      className="object-cover"
                      sizes="80px"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <ImagePlus className="h-6 w-6 text-adm-text-tertiary" />
                    </div>
                  )}
                  {/* 悬停遮罩 */}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                    <Upload className="h-5 w-5 text-white" />
                  </div>
                  {uploadingAvatar && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="flex items-center gap-1 rounded-lg border border-adm-border px-2.5 py-1 text-[11px] text-adm-text-secondary transition-colors hover:bg-adm-card-hover disabled:opacity-50"
                >
                  <Upload className="h-3 w-3" />
                  上传
                </button>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleAvatarUpload(file);
                    e.target.value = "";
                  }}
                />
              </div>

              {/* 右侧：图片链接输入 + 类型识别 */}
              <div className="min-w-0 flex-1">
                <input
                  type="text"
                  value={form.avatar}
                  onChange={(e) => setForm({ ...form, avatar: e.target.value })}
                  className="w-full rounded-xl border border-adm-border bg-adm-input px-3 py-2.5 text-sm text-adm-text transition-colors focus:border-adm-text-secondary focus:bg-adm-input-focus focus:outline-none focus:ring-1 focus:ring-adm-text-secondary"
                  placeholder="邮箱（自动获取 Cravatar）或 https:// 图片链接"
                />
                {/* 实时识别类型提示 */}
                <div className="mt-1.5 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[11px]">
                    {(() => {
                      const v = form.avatar.trim();
                      if (!v) {
                        return (
                          <span className="text-adm-text-tertiary">
                            三种方式：上传 / 邮箱 / 图片链接
                          </span>
                        );
                      }
                      if (v.startsWith("http")) {
                        return (
                          <>
                            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-400">
                              <Check className="h-2.5 w-2.5" />
                            </span>
                            <span className="text-green-600 dark:text-green-400">图片直链</span>
                          </>
                        );
                      }
                      if (v.includes("@")) {
                        return (
                          <>
                            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-400">
                              <Check className="h-2.5 w-2.5" />
                            </span>
                            <span className="text-green-600 dark:text-green-400">Cravatar 头像</span>
                          </>
                        );
                      }
                      return (
                        <span className="text-amber-500">
                          无法识别：请输入以 http 开头的图片链接
                        </span>
                      );
                    })()}
                  </div>
                  {form.avatar.trim() && (
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, avatar: "" })}
                      className="flex items-center gap-1 text-[11px] text-adm-text-tertiary transition-colors hover:text-adm-danger"
                    >
                      <Eraser className="h-3 w-3" />
                      清除
                    </button>
                  )}
                </div>
                {/* 三种方式快捷说明 */}
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-adm-text-tertiary">
                  <span className="flex items-center gap-1">
                    <Upload className="h-2.5 w-2.5" />点击头像上传
                  </span>
                  <span className="flex items-center gap-1">
                    <Mail className="h-2.5 w-2.5" />邮箱自动获取 Cravatar
                  </span>
                  <span className="flex items-center gap-1">
                    <Link2 className="h-2.5 w-2.5" />图片直链
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <label className="mb-1.5 block text-xs font-medium text-adm-text-secondary">
              描述（选填）
            </label>
            <input
              type="text"
              value={form.desc}
              onChange={(e) => setForm({ ...form, desc: e.target.value })}
              className="w-full rounded-xl border border-adm-border bg-adm-input px-3 py-2.5 text-sm text-adm-text transition-colors focus:border-adm-text-secondary focus:bg-adm-input-focus focus:outline-none focus:ring-1 focus:ring-adm-text-secondary"
              placeholder="一句话描述..."
            />
          </div>

          <div className="mt-5 flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 rounded-xl bg-adm-primary px-4 py-2 text-sm font-medium text-adm-primary-text transition-colors hover:opacity-90 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? "保存中..." : "保存"}
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="rounded-xl border border-adm-border px-4 py-2 text-sm text-adm-text-secondary transition-colors hover:bg-adm-card-hover"
            >
              取消
            </button>
          </div>
        </form>
        </div>,
        document.body
      )}

      {/* List */}
      {sources.length === 0 && !showForm ? (
        <div className="rounded-2xl border border-dashed border-adm-border py-16 text-center">
          <Rss className="mx-auto mb-3 h-10 w-10 text-adm-text-tertiary" />
          <p className="text-sm text-adm-text-tertiary">还没有订阅源，点击右上角添加</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {sources.map((source) => (
            <div
              key={source.id}
              className="flex items-center gap-3 rounded-xl border border-adm-border bg-adm-card p-4 transition-colors hover:border-adm-text-tertiary"
            >
              <GripVertical className="h-4 w-4 shrink-0 text-adm-text-tertiary" />
              <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-adm-input">
                {/* 默认头像（底层） */}
                <div className="flex h-full w-full items-center justify-center">
                  <Rss className="h-4 w-4 text-adm-text-tertiary" />
                </div>
                {/* 实际头像（上层），加载失败时隐藏 */}
                {resolveSourceAvatar(source, 72) && (
                  <img
                    src={resolveSourceAvatar(source, 72)}
                    alt={source.name}
                    className="absolute inset-0 h-full w-full object-cover"
                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-adm-text">
                  {source.name}
                </p>
                {source.desc && (
                  <p className="truncate text-xs text-adm-text-tertiary">{source.desc}</p>
                )}
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-0.5 inline-flex items-center gap-1 text-xs text-wechat-link hover:underline"
                >
                  {source.url}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <div className="shrink-0 rounded-md bg-adm-input px-2 py-1 text-[11px] text-adm-text-secondary">
                {source.articleCount ?? 0} 篇
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  onClick={() => startEdit(source)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-adm-text-tertiary transition-colors hover:bg-adm-card-hover hover:text-adm-text-secondary"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setConfirmDeleteId(source.id)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-adm-text-tertiary transition-colors hover:bg-adm-danger-bg hover:text-adm-danger"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDeleteId}
        title="删除订阅源"
        message="确定删除这个订阅源吗？相关文章也将被删除。"
        danger
        confirmText="删除"
        onConfirm={() => confirmDeleteId && handleDelete(confirmDeleteId)}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}
