"use client";

import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Megaphone,
  Plus,
  Trash2,
  Pencil,
  Save,
  X,
  ImagePlus,
  Link2,
  Heart,
  MessageSquare,
  ExternalLink,
  FileText,
} from "lucide-react";
import { apiFetch, getToken } from "@/lib/api-fetch";
import { uploadImage, toAbsoluteUrl } from "@/lib/upload";
import { cravatarUrl } from "@/lib/avatar";
import { renderContent } from "@/lib/sanitize";
import RichTextEditor from "@/components/RichTextEditor";
import { useExitAnimation } from "@/lib/use-exit-animation";
import ConfirmDialog from "@/components/admin/ConfirmDialog";

interface AdLinkCard {
  url: string;
  title: string;
  description: string;
  image: string;
  siteName: string;
}

interface AdItem {
  id: string;
  content: string;
  images: (string | { src: string; video?: string })[];
  linkCard: AdLinkCard | null;
  adAvatar: string;
  adNickname: string;
  likesDisabled: boolean;
  commentsDisabled: boolean;
  createdAt: string;
}

interface FormState {
  adAvatar: string;
  adNickname: string;
  content: string;
  images: string[];
  linkCard: AdLinkCard | null;
  likesDisabled: boolean;
  commentsDisabled: boolean;
}

const EMPTY_FORM: FormState = {
  adAvatar: "",
  adNickname: "",
  content: "",
  images: [],
  linkCard: null,
  likesDisabled: false,
  commentsDisabled: false,
};

/** 将头像输入解析为最终 URL：邮箱→Cravatar，链接/上传路径→原值 */
function resolveAdAvatar(input: string): string {
  const trimmed = (input || "").trim();
  if (!trimmed) return "";
  if (!trimmed.startsWith("http") && trimmed.includes("@")) {
    return cravatarUrl(trimmed, 96);
  }
  return trimmed;
}

export default function AdminAds() {
  const router = useRouter();
  const [ads, setAds] = useState<AdItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [permId, setPermId] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const imagesInputRef = useRef<HTMLInputElement>(null);

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };
  const { closing, handleClose } = useExitAnimation(closeForm, 220);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmConvertId, setConfirmConvertId] = useState<string | null>(null);

  const token = getToken();

  const fetchAds = async () => {
    try {
      const res = await apiFetch("/ads");
      if (res.ok) {
        const data = await res.json();
        setAds(data.data || []);
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
    fetchAds();
  }, [router, token]);

  const startAdd = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(true);
  };

  const startEdit = (ad: AdItem) => {
    setForm({
      adAvatar: ad.adAvatar || "",
      adNickname: ad.adNickname || "",
      content: ad.content || "",
      images: (ad.images || []).map((img) => (typeof img === "string" ? img : img.src)),
      linkCard: ad.linkCard
        ? { ...ad.linkCard }
        : null,
      likesDisabled: !!ad.likesDisabled,
      commentsDisabled: !!ad.commentsDisabled,
    });
    setEditingId(ad.id);
    setShowForm(true);
  };

  const handleAvatarUpload = async (file: File) => {
    if (!token) return;
    setUploadingAvatar(true);
    try {
      const url = await uploadImage(file, token);
      setForm((f) => ({ ...f, adAvatar: url }));
    } catch (e) {
      alert((e as Error).message || "上传失败");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleImagesUpload = async (files: FileList) => {
    if (!token) return;
    setUploadingImages(true);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        const url = await uploadImage(file, token);
        urls.push(url);
      }
      setForm((f) => ({ ...f, images: [...f.images, ...urls] }));
    } catch (e) {
      alert((e as Error).message || "上传失败");
    } finally {
      setUploadingImages(false);
    }
  };

  const removeImage = (idx: number) => {
    setForm((f) => ({ ...f, images: f.images.filter((_, i) => i !== idx) }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolveAdAvatar(form.adAvatar) || !form.adNickname.trim()) {
      alert("请填写广告头像和昵称");
      return;
    }
    setSaving(true);

    const isEdit = editingId !== null;
    const path = isEdit ? `/ads/${editingId}` : "/ads";
    const method = isEdit ? "PUT" : "POST";

    const body: Record<string, unknown> = {
      adAvatar: resolveAdAvatar(form.adAvatar),
      adNickname: form.adNickname,
      content: form.content,
      images: form.images,
      linkCard: form.linkCard,
    };
    if (isEdit) {
      body.likesDisabled = form.likesDisabled;
      body.commentsDisabled = form.commentsDisabled;
    }

    try {
      const res = await apiFetch(path, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        handleClose();
        fetchAds();
      } else {
        const data = await res.json().catch(() => ({ message: "保存失败" }));
        alert(data.message || "保存失败");
      }
    } catch {
      alert("网络错误");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const res = await apiFetch(`/ads/${id}`, { method: "DELETE" });
    if (res.ok) fetchAds();
    setConfirmDeleteId(null);
  };

  const handleTogglePermission = async (
    id: string,
    field: "likesDisabled" | "commentsDisabled",
    current: boolean
  ) => {
    if (!token) return;
    setPermId(id);
    try {
      const res = await apiFetch(`/ads/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: !current }),
      });
      if (res.ok) {
        setAds((prev) =>
          prev.map((a) => (a.id === id ? { ...a, [field]: !current } : a))
        );
      } else {
        alert("操作失败");
      }
    } catch {
      alert("网络错误");
    } finally {
      setPermId(null);
    }
  };

  const handleConvertToPost = async (id: string) => {
    if (!confirm("确定将这条广告转回普通动态吗？")) return;
    try {
      const res = await apiFetch(`/ads/${id}/convert-to-post`, { method: "POST" });
      if (res.ok) {
        setAds((prev) => prev.filter((a) => a.id !== id));
      } else {
        alert("操作失败");
      }
    } catch {
      alert("网络错误");
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-adm-text">广告管理</h2>
          <p className="mt-1 text-sm text-adm-text-secondary">
            管理朋友圈信息流中展示的广告（插入第 5 条动态之后）
          </p>
        </div>
        {!showForm && (
          <button
            onClick={startAdd}
            className="flex items-center gap-1.5 rounded-xl bg-adm-primary px-4 py-2 text-sm font-medium text-adm-primary-text transition-colors hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            添加广告
          </button>
        )}
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
          className={`w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-adm-border bg-adm-card p-5 shadow-lg ${
            closing ? "animate-modal-out" : "animate-modal-in"
          }`}
        >
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-adm-text">
              {editingId ? "编辑广告" : "添加广告"}
            </h3>
            <button
              type="button"
              onClick={handleClose}
              className="text-adm-text-tertiary transition-colors hover:text-adm-text-secondary"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* 头像 + 昵称 */}
          <div className="flex items-start gap-4">
            <div className="shrink-0">
              <label className="mb-1.5 block text-xs font-medium text-adm-text-secondary">
                广告头像
              </label>
              <div
                onClick={() => avatarInputRef.current?.click()}
                className="relative h-16 w-16 cursor-pointer overflow-hidden rounded-full border border-adm-border bg-adm-input"
              >
                {resolveAdAvatar(form.adAvatar) ? (
                  <Image
                    src={toAbsoluteUrl(resolveAdAvatar(form.adAvatar))}
                    alt="广告头像"
                    fill
                    className="object-cover"
                    sizes="64px"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <ImagePlus className="h-5 w-5 text-adm-text-tertiary" />
                  </div>
                )}
                {uploadingAvatar && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  </div>
                )}
              </div>
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
            <div className="flex-1 space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-adm-text-secondary">
                  邮箱 / 图片链接
                </label>
                <input
                  type="text"
                  value={form.adAvatar}
                  onChange={(e) => setForm({ ...form, adAvatar: e.target.value })}
                  className="w-full rounded-xl border border-adm-border bg-adm-input px-3 py-2.5 text-sm text-adm-text transition-colors focus:border-adm-text-secondary focus:bg-adm-input-focus focus:outline-none focus:ring-1 focus:ring-adm-text-secondary"
                  placeholder="邮箱或图片链接，也可点击头像上传"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-adm-text-secondary">
                  广告昵称
                </label>
                <input
                  type="text"
                  value={form.adNickname}
                  onChange={(e) => setForm({ ...form, adNickname: e.target.value })}
                  className="w-full rounded-xl border border-adm-border bg-adm-input px-3 py-2.5 text-sm text-adm-text transition-colors focus:border-adm-text-secondary focus:bg-adm-input-focus focus:outline-none focus:ring-1 focus:ring-adm-text-secondary"
                  placeholder="例如：品牌名"
                />
              </div>
            </div>
          </div>

          {/* 内容（前台斜体展示） */}
          <div className="mt-4">
            <label className="mb-1.5 block text-xs font-medium text-adm-text-secondary">
              广告内容（前台斜体展示）
            </label>
            <RichTextEditor
              value={form.content}
              onChange={(html) => setForm((f) => ({ ...f, content: html }))}
              placeholder="广告文案..."
              minHeight={120}
            />
          </div>

          {/* 图片 */}
          <div className="mt-4">
            <label className="mb-1.5 block text-xs font-medium text-adm-text-secondary">
              配图（选填，最多 9 张）
            </label>
            <div className="flex flex-wrap gap-2">
              {form.images.map((img, idx) => (
                <div
                  key={idx}
                  className="relative h-16 w-16 overflow-hidden rounded-lg border border-adm-border"
                >
                  <Image
                    src={toAbsoluteUrl(img)}
                    alt={`图片${idx + 1}`}
                    fill
                    className="object-cover"
                    sizes="64px"
                    unoptimized
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(idx)}
                    className="absolute right-0 top-0 flex h-5 w-5 items-center justify-center rounded-bl-lg bg-black/60 text-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {form.images.length < 9 && (
                <button
                  type="button"
                  onClick={() => imagesInputRef.current?.click()}
                  disabled={uploadingImages}
                  className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-adm-border bg-adm-input text-adm-text-tertiary transition-colors hover:border-adm-text-secondary hover:text-adm-text-secondary disabled:opacity-50"
                >
                  {uploadingImages ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-adm-border border-t-adm-text-tertiary" />
                  ) : (
                    <ImagePlus className="h-5 w-5" />
                  )}
                </button>
              )}
            </div>
            <input
              ref={imagesInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) handleImagesUpload(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          {/* 链接卡片 */}
          <div className="mt-4">
            <button
              type="button"
              onClick={() =>
                setForm({
                  ...form,
                  linkCard: form.linkCard
                    ? null
                    : { url: "", title: "", description: "", image: "", siteName: "" },
                })
              }
              className="flex items-center gap-1.5 text-xs font-medium text-adm-text-secondary transition-colors hover:text-adm-text"
            >
              <Link2 className="h-3.5 w-3.5" />
              {form.linkCard ? "移除链接卡片" : "添加链接卡片"}
            </button>
            {form.linkCard && (
              <div className="mt-2 space-y-3 rounded-xl border border-adm-border bg-adm-input/50 p-3">
                <input
                  type="url"
                  value={form.linkCard.url}
                  onChange={(e) =>
                    setForm({ ...form, linkCard: { ...form.linkCard!, url: e.target.value } })
                  }
                  className="w-full rounded-lg border border-adm-border bg-adm-input px-3 py-2 text-sm text-adm-text focus:border-adm-text-secondary focus:outline-none"
                  placeholder="链接地址 https://..."
                />
                <input
                  type="text"
                  value={form.linkCard.title}
                  onChange={(e) =>
                    setForm({ ...form, linkCard: { ...form.linkCard!, title: e.target.value } })
                  }
                  className="w-full rounded-lg border border-adm-border bg-adm-input px-3 py-2 text-sm text-adm-text focus:border-adm-text-secondary focus:outline-none"
                  placeholder="卡片标题"
                />
                <input
                  type="text"
                  value={form.linkCard.description}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      linkCard: { ...form.linkCard!, description: e.target.value },
                    })
                  }
                  className="w-full rounded-lg border border-adm-border bg-adm-input px-3 py-2 text-sm text-adm-text focus:border-adm-text-secondary focus:outline-none"
                  placeholder="卡片描述（选填）"
                />
                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    value={form.linkCard.image}
                    onChange={(e) =>
                      setForm({ ...form, linkCard: { ...form.linkCard!, image: e.target.value } })
                    }
                    className="flex-1 rounded-lg border border-adm-border bg-adm-input px-3 py-2 text-sm text-adm-text focus:border-adm-text-secondary focus:outline-none"
                    placeholder="卡片图片 URL（选填）"
                  />
                  {form.linkCard.image && (
                    <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-adm-border">
                      <Image
                        src={toAbsoluteUrl(form.linkCard.image)}
                        alt="卡片图"
                        fill
                        className="object-cover"
                        sizes="36px"
                        unoptimized
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 互动权限（仅编辑时可切换；新建默认开启） */}
          {editingId && (
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setForm({ ...form, likesDisabled: !form.likesDisabled })}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  form.likesDisabled
                    ? "text-adm-danger bg-adm-danger-bg"
                    : "text-adm-text-secondary bg-adm-card-hover"
                }`}
              >
                <Heart className="h-3.5 w-3.5" />
                {form.likesDisabled ? "点赞已关" : "允许点赞"}
              </button>
              <button
                type="button"
                onClick={() =>
                  setForm({ ...form, commentsDisabled: !form.commentsDisabled })
                }
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  form.commentsDisabled
                    ? "text-adm-danger bg-adm-danger-bg"
                    : "text-adm-text-secondary bg-adm-card-hover"
                }`}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                {form.commentsDisabled ? "评论已关" : "允许评论"}
              </button>
            </div>
          )}

          {/* 操作按钮 */}
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
      {ads.length === 0 && !showForm ? (
        <div className="rounded-2xl border border-dashed border-adm-border py-16 text-center">
          <Megaphone className="mx-auto mb-3 h-10 w-10 text-adm-text-tertiary" />
          <p className="text-sm text-adm-text-tertiary">还没有广告，点击右上角添加</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {ads.map((ad) => (
            <div
              key={ad.id}
              className="rounded-2xl border border-adm-border bg-adm-card p-4 transition-colors hover:border-adm-text-tertiary"
            >
              <div className="flex items-start gap-3">
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-adm-input">
                  {ad.adAvatar ? (
                    <Image
                      src={toAbsoluteUrl(ad.adAvatar)}
                      alt={ad.adNickname}
                      fill
                      className="object-cover"
                      sizes="40px"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Megaphone className="h-4 w-4 text-adm-text-tertiary" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-adm-text">
                      {ad.adNickname || "未命名"}
                    </p>
                    <span className="rounded bg-adm-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-adm-primary">
                      广告
                    </span>
                  </div>
                  {ad.content && (
                    <div
                      className="rich-content mt-0.5 line-clamp-2 overflow-hidden text-xs text-adm-text-secondary"
                      dangerouslySetInnerHTML={{ __html: renderContent(ad.content) }}
                    />
                  )}
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-adm-text-tertiary">
                    {ad.images?.length > 0 && (
                      <span>配图 {ad.images.length} 张</span>
                    )}
                    {ad.linkCard && (
                      <span className="flex items-center gap-0.5">
                        <Link2 className="h-3 w-3" />
                        链接卡片
                      </span>
                    )}
                    {ad.linkCard?.url && (
                      <a
                        href={ad.linkCard.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-0.5 text-wechat-link hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        访问
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => handleTogglePermission(ad.id, "likesDisabled", ad.likesDisabled)}
                    disabled={permId === ad.id}
                    title={ad.likesDisabled ? "已关闭点赞，点击开启" : "允许点赞，点击关闭"}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors disabled:opacity-50 ${
                      ad.likesDisabled
                        ? "text-adm-danger bg-adm-danger-bg"
                        : "text-adm-text-tertiary hover:bg-adm-card-hover hover:text-adm-text-secondary"
                    }`}
                  >
                    <Heart className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() =>
                      handleTogglePermission(ad.id, "commentsDisabled", ad.commentsDisabled)
                    }
                    disabled={permId === ad.id}
                    title={ad.commentsDisabled ? "已关闭评论，点击开启" : "允许评论，点击关闭"}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors disabled:opacity-50 ${
                      ad.commentsDisabled
                        ? "text-adm-danger bg-adm-danger-bg"
                        : "text-adm-text-tertiary hover:bg-adm-card-hover hover:text-adm-text-secondary"
                    }`}
                  >
                    <MessageSquare className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleConvertToPost(ad.id)}
                    title="转为动态"
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-adm-text-tertiary transition-colors hover:bg-adm-card-hover hover:text-adm-text-secondary"
                  >
                    <FileText className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => startEdit(ad)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-adm-text-tertiary transition-colors hover:bg-adm-card-hover hover:text-adm-text-secondary"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(ad.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-adm-text-tertiary transition-colors hover:bg-adm-danger-bg hover:text-adm-danger"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDeleteId}
        title="删除广告"
        message="确定删除这条广告吗？"
        danger
        confirmText="删除"
        onConfirm={() => confirmDeleteId && handleDelete(confirmDeleteId)}
        onCancel={() => setConfirmDeleteId(null)}
      />
      <ConfirmDialog
        open={!!confirmConvertId}
        title="转为动态"
        message="确定将这条广告转回普通动态吗？"
        confirmText="确定"
        onConfirm={() => confirmConvertId && handleConvertToPost(confirmConvertId)}
        onCancel={() => setConfirmConvertId(null)}
      />
    </div>
  );
}
