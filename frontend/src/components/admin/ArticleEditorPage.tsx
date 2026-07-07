"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, X, Image as ImageIcon, MapPin, Heart, MessageSquare, Pin } from "lucide-react";
import ArticleEditor from "@/components/ArticleEditor";
import { apiFetch, getToken } from "@/lib/api-fetch";
import { uploadImage, toAbsoluteUrl } from "@/lib/upload";
import type { PostMusic, LinkCard, PostVideo } from "@/lib/mock-data";
import CardPreview from "@/components/admin/CardPreview";
import LinkCardPanel from "@/components/admin/LinkCardPanel";
import MusicPanel from "@/components/admin/MusicPanel";
import VideoPanel from "@/components/admin/VideoPanel";

interface ArticleEditorPageProps {
  articleId?: string;
}

export default function ArticleEditorPage({ articleId }: ArticleEditorPageProps) {
  const router = useRouter();
  const isEdit = !!articleId;

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [cover, setCover] = useState("");
  const [articleType, setArticleType] = useState<"original" | "repost" | "ai">("original");
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState<null | "published" | "draft">(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [region, setRegion] = useState("");
  const [locating, setLocating] = useState(false);
  const [likesDisabled, setLikesDisabled] = useState(false);
  const [commentsDisabled, setCommentsDisabled] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [music, setMusic] = useState<PostMusic | null>(null);
  const [linkCard, setLinkCard] = useState<LinkCard | null>(null);
  const [video, setVideo] = useState<PostVideo | null>(null);
  const [activePanel, setActivePanel] = useState<null | "linkCard" | "music" | "video">(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  // 编辑模式：加载完成后记录初始快照，用于判断是否有未保存改动
  const initialSnapshotRef = useRef<{ title: string; content: string } | null>(null);

  useEffect(() => {
    if (!articleId) return;
    (async () => {
      try {
        const res = await apiFetch(`/posts/${articleId}`);
        if (!res.ok) throw new Error("加载失败");
        const data = await res.json();
        setTitle(data.title || "");
        setContent(data.content || "");
        setCover(data.cover || "");
        setArticleType(data.articleType || "original");
        setRegion(data.region || "");
        setLikesDisabled(!!data.likesDisabled);
        setCommentsDisabled(!!data.commentsDisabled);
        setPinned(!!data.pinned);
        setMusic(data.music ?? null);
        setLinkCard(data.linkCard ?? null);
        setVideo(data.video ?? null);
        initialSnapshotRef.current = { title: data.title || "", content: data.content || "" };
      } catch (err) {
        alert(err instanceof Error ? err.message : "加载文章失败");
        router.push("/admin/articles");
      } finally {
        setLoading(false);
      }
    })();
  }, [articleId, router]);

  const handleAutoLocate = useCallback(async () => {
    setLocating(true);
    try {
      const res = await apiFetch("/location/ip");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "定位失败");
      }
      const data = await res.json();
      if (data.province) {
        setRegion(data.province);
      } else {
        throw new Error("无法获取定位信息");
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "定位失败");
    } finally {
      setLocating(false);
    }
  }, []);

  const handleCoverUpload = useCallback(async (file: File) => {
    const token = getToken();
    if (!token) {
      alert("请先登录");
      return;
    }
    setUploadingCover(true);
    try {
      const url = await uploadImage(file, token);
      setCover(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : "封面上传失败");
    } finally {
      setUploadingCover(false);
    }
  }, []);

  const onCoverChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleCoverUpload(file);
      e.target.value = "";
    },
    [handleCoverUpload]
  );

  const handleSave = useCallback(async (status: "published" | "draft" = "published") => {
    if (status === "published") {
      if (!title.trim()) {
        alert("请输入标题");
        return;
      }
      if (!content.trim()) {
        alert("请输入正文内容");
        return;
      }
    }
    setSaving(status);
    try {
      const token = getToken();
      if (!token) {
        alert("请先登录");
        router.push("/admin");
        return;
      }
      const body = {
        type: "article" as const,
        title: title.trim(),
        content,
        excerpt: title.trim(),
        cover,
        category: "",
        articleType,
        region: region || undefined,
        likesDisabled,
        commentsDisabled,
        pinned,
        status,
        music: music || null,
        linkCard: linkCard || null,
        video: video || null,
      };

      if (isEdit) {
        const res = await apiFetch(`/posts/${articleId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || "保存失败");
        }
      } else {
        const res = await apiFetch(`/posts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || "发布失败");
        }
      }

      savedDraftRef.current = true;
      router.push("/admin/articles");
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "操作失败");
    } finally {
      setSaving(null);
    }
  }, [title, content, cover, articleType, region, likesDisabled, commentsDisabled, pinned, music, linkCard, video, isEdit, articleId, router]);

  // 判断是否有未保存改动
  // - 新建模式：标题或正文任一非空即视为有内容
  // - 编辑模式：与初始快照比较，任一不同即视为有改动
  const hasUnsavedContent = useCallback(() => {
    if (!isEdit) {
      return title.trim().length > 0 || content.trim().length > 0;
    }
    const snap = initialSnapshotRef.current;
    if (!snap) return false;
    return snap.title !== title || snap.content !== content;
  }, [title, content, isEdit]);

  // 草稿提交状态记录：避免保存后触发 beforeunload 提示
  const savedDraftRef = useRef(false);

  // 返回按钮：若有未保存内容，提醒是否保存为草稿
  const handleBack = useCallback(() => {
    if (savedDraftRef.current) {
      router.push("/admin/articles");
      return;
    }
    if (hasUnsavedContent()) {
      const ok = window.confirm("你有未保存的内容，是否保存为草稿？\n\n点击「确定」保存为草稿（仅后端可见，不会在首页显示）；\n点击「取消」放弃当前内容并离开。");
      if (ok) {
        handleSave("draft");
        return;
      }
    }
    router.push("/admin/articles");
  }, [hasUnsavedContent, handleSave, router]);

  // 浏览器关闭/刷新时提醒（仅当有未保存内容时）
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (savedDraftRef.current) return;
      if (hasUnsavedContent()) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsavedContent]);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-adm-text-tertiary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-4">
      {/* 顶部一行：返回 + 标题 + 草稿 + 发布按钮 */}
      <div className="mb-3 flex items-center gap-2">
        <button
          type="button"
          onClick={handleBack}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-adm-text-secondary transition-colors hover:bg-adm-card-hover"
          aria-label="返回"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="标题"
          maxLength={200}
          className="min-w-0 flex-1 rounded-xl border border-adm-border bg-adm-card px-4 py-2.5 text-lg font-bold text-adm-text placeholder:text-adm-text-tertiary focus:outline-none focus:ring-2 focus:ring-gray-400/30 dark:bg-[#1e1e22]"
        />
        <button
          type="button"
          onClick={() => handleSave("draft")}
          disabled={saving !== null}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-adm-border bg-adm-card px-4 py-2.5 text-sm font-medium text-adm-text-secondary transition-colors hover:bg-adm-card-hover disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#1e1e22]"
        >
          {saving === "draft" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          保存草稿
        </button>
        <button
          type="button"
          onClick={() => handleSave("published")}
          disabled={saving !== null || !title.trim()}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200 dark:disabled:bg-white/10 dark:disabled:text-gray-600"
        >
          {saving === "published" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {isEdit ? "保存" : "发布"}
        </button>
      </div>

      {/* 文章类型选择 */}
      <div className="mb-3 flex items-center gap-2">
        <span className="shrink-0 text-xs font-medium text-adm-text-secondary">类型</span>
        <div className="flex gap-1">
          {[
            { value: "original", label: "原创" },
            { value: "repost", label: "转载" },
            { value: "ai", label: "AI生成" },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setArticleType(opt.value as "original" | "repost" | "ai")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                articleType === opt.value
                  ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                  : "bg-adm-input text-adm-text-secondary hover:bg-adm-card-hover"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 左右分栏：编辑器（左/中） + 封面（右） */}
      <div className="flex flex-col gap-4 lg:flex-row">
        {/* 编辑区域 */}
        <div className="min-w-0 flex-1">
          <ArticleEditor
            value={content}
            onChange={setContent}
            token={getToken() || ""}
            placeholder="开始写作..."
            onInsertLinkCard={() => setActivePanel("linkCard")}
            onInsertMusic={() => setActivePanel("music")}
            onInsertVideo={() => setActivePanel("video")}
            hasLinkCard={!!linkCard}
            hasMusic={!!music}
            hasVideo={!!video}
          />
        </div>

        {/* 封面 + 定位 + 互动 + 卡片预览 */}
        <aside className="lg:w-80 lg:shrink-0">
          <div className="space-y-4">
            {/* 封面 */}
            <div className="rounded-xl border border-adm-border bg-adm-card p-4">
              <label className="mb-2 block text-xs font-medium text-adm-text-secondary">
                封面图片
              </label>
              {cover ? (
                <div className="group relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={toAbsoluteUrl(cover)}
                    alt="封面"
                    className="aspect-video w-full rounded-lg object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setCover("")}
                    className="absolute right-1 top-1 rounded bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => coverInputRef.current?.click()}
                  disabled={uploadingCover}
                  className="flex aspect-video w-full flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-adm-border text-adm-text-tertiary transition-colors hover:border-gray-500 hover:text-gray-600 dark:hover:border-gray-400 dark:hover:text-gray-300"
                >
                  {uploadingCover ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <ImageIcon className="h-5 w-5" />
                      <span className="text-xs">点击上传</span>
                    </>
                  )}
                </button>
              )}
              <input
                ref={coverInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={onCoverChange}
                className="hidden"
              />
            </div>

            {/* 定位 */}
            <div className="rounded-xl border border-adm-border bg-adm-card p-4">
              <label className="mb-2 block text-xs font-medium text-adm-text-secondary">
                定位（仅显示省份）
              </label>
              {region ? (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <MapPin className="h-4 w-4 shrink-0 text-adm-text-secondary" />
                    <span className="truncate text-sm text-adm-text">{region}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRegion("")}
                    className="rounded p-1 text-adm-text-tertiary transition-colors hover:bg-adm-card-hover hover:text-adm-text"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleAutoLocate}
                  disabled={locating}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-adm-border py-2.5 text-xs text-adm-text-tertiary transition-colors hover:border-gray-500 hover:text-gray-600 disabled:opacity-50 dark:hover:border-gray-400 dark:hover:text-gray-300"
                >
                  {locating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <MapPin className="h-4 w-4" />
                  )}
                  {locating ? "定位中..." : "添加定位"}
                </button>
              )}
            </div>

            {/* 互动设置 */}
            <div className="rounded-xl border border-adm-border bg-adm-card p-4">
              <label className="mb-3 block text-xs font-medium text-adm-text-secondary">
                互动设置
              </label>
              <div className="space-y-3">
                <ToggleRow
                  icon={<Heart className="h-4 w-4" />}
                  label="允许点赞"
                  checked={!likesDisabled}
                  onChange={(v) => setLikesDisabled(!v)}
                />
                <ToggleRow
                  icon={<MessageSquare className="h-4 w-4" />}
                  label="允许评论"
                  checked={!commentsDisabled}
                  onChange={(v) => setCommentsDisabled(!v)}
                />
                <ToggleRow
                  icon={<Pin className="h-4 w-4 rotate-45" />}
                  label="置顶文章"
                  checked={pinned}
                  onChange={setPinned}
                />
              </div>
            </div>

            {/* 附加卡片预览 */}
            <CardPreview
              music={music}
              linkCard={linkCard}
              video={video}
              onRemoveMusic={() => setMusic(null)}
              onRemoveLinkCard={() => setLinkCard(null)}
              onRemoveVideo={() => setVideo(null)}
              onEditMusic={() => setActivePanel("music")}
              onEditLinkCard={() => setActivePanel("linkCard")}
              onEditVideo={() => setActivePanel("video")}
            />
          </div>
        </aside>
      </div>

      {/* 卡片面板 */}
      <LinkCardPanel
        open={activePanel === "linkCard"}
        onClose={() => setActivePanel(null)}
        onConfirm={(card) => { setLinkCard(card); setActivePanel(null); }}
        initial={linkCard}
        token={getToken() || ""}
      />
      <MusicPanel
        open={activePanel === "music"}
        onClose={() => setActivePanel(null)}
        onConfirm={(m) => { setMusic(m); setActivePanel(null); }}
        initial={music}
        token={getToken() || ""}
      />
      <VideoPanel
        open={activePanel === "video"}
        onClose={() => setActivePanel(null)}
        onConfirm={(v) => { setVideo(v); setActivePanel(null); }}
        initial={video}
        token={getToken() || ""}
      />
    </div>
  );
}

function ToggleRow({
  icon,
  label,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm text-adm-text">
        <span className="text-adm-text-secondary">{icon}</span>
        <span>{label}</span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
          checked ? "bg-[#07c160]" : "bg-adm-input"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}
