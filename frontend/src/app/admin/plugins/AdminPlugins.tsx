"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Music,
  RefreshCw,
  Check,
  Link2,
  Save,
  Puzzle,
  Upload,
  Trash2,
  Download,
  AlertCircle,
  FileCode2,
} from "lucide-react";
import { apiFetch, getApiUrl, getToken } from "@/lib/api-fetch";

interface SiteSettings {
  siteName: string;
  description: string;
  keywords: string;
  domain: string;
  beian: string;
  faviconUrl: string;
  ogImage: string;
  musicUrl: string;
  musicId: string;
  musicSource: string;
  playlistId: string;
  socialLinks: string;
}

const SETTINGS_DEFAULTS: SiteSettings = {
  siteName: "",
  description: "",
  keywords: "",
  domain: "",
  beian: "",
  faviconUrl: "",
  ogImage: "",
  musicUrl: "",
  musicId: "",
  musicSource: "",
  playlistId: "",
  socialLinks: "[]",
};

/** 插件 platform 名 → 对应的真实音乐平台名 */
const PLATFORM_MAP: Record<string, string> = {
  小秋音乐: "QQ音乐",
  小蜗音乐: "酷我音乐",
  小枸音乐: "酷狗音乐",
  小蜜音乐: "咪咕音乐",
  小芸音乐: "网易云音乐",
};

interface SourceInfo {
  platform: string;
  name: string;
  primaryKey: string[];
}

interface PluginInfo {
  id: string;
  platform: string;
  version: string;
  author: string;
  description?: string;
  srcUrl?: string;
  primaryKey?: string[];
  supportedSearchType?: string[];
  methods: string[];
  fileName: string;
}

export default function AdminPlugins() {
  const router = useRouter();
  const [sources, setSources] = useState<SourceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<SiteSettings>(SETTINGS_DEFAULTS);
  const [savingMusic, setSavingMusic] = useState(false);
  const [musicSaved, setMusicSaved] = useState(false);

  // 插件管理 state
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [pluginsLoading, setPluginsLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [subscribeUrl, setSubscribeUrl] = useState("");
  const [subscribing, setSubscribing] = useState(false);
  const [pluginError, setPluginError] = useState<string | null>(null);
  const [pluginSuccess, setPluginSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const token = getToken();

  const currentSourceName =
    sources.find((s) => s.platform === settings.musicSource)?.name ||
    settings.musicSource ||
    "未选择";

  const fetchSources = async () => {
    try {
      const res = await fetch(`${getApiUrl()}/music/sources`);
      if (res.ok) setSources(await res.json());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await apiFetch("/settings");
      if (res.ok) {
        const data = await res.json();
        setSettings({ ...SETTINGS_DEFAULTS, ...data });
      }
    } catch {
      // ignore
    }
  };

  const fetchPlugins = async () => {
    setPluginsLoading(true);
    try {
      const res = await apiFetch("/admin/plugins");
      if (res.ok) {
        setPlugins(await res.json());
      }
    } catch {
      // ignore
    } finally {
      setPluginsLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      router.replace("/");
      return;
    }
    fetchSources();
    fetchSettings();
    fetchPlugins();
  }, [router, token]);

  // 插件操作
  const showPluginError = (msg: string) => {
    setPluginError(msg);
    setPluginSuccess(null);
    setTimeout(() => setPluginError(null), 5000);
  };
  const showPluginSuccess = (msg: string) => {
    setPluginSuccess(msg);
    setPluginError(null);
    setTimeout(() => setPluginSuccess(null), 4000);
  };

  const handleUploadFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".js")) {
      showPluginError("仅支持 .js 插件文件");
      return;
    }
    setUploading(true);
    setPluginError(null);
    setPluginSuccess(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await apiFetch("/admin/plugins/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        showPluginSuccess(`插件「${data.name || file.name}」安装成功`);
        await fetchPlugins();
        await fetchSources();
      } else {
        showPluginError(data.message || "插件安装失败");
      }
    } catch {
      showPluginError("网络错误，上传失败");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleImportUrl = async () => {
    const url = importUrl.trim();
    if (!url) return;
    setImporting(true);
    setPluginError(null);
    setPluginSuccess(null);
    try {
      const res = await apiFetch("/admin/plugins/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        showPluginSuccess(`插件「${data.name || "未知"}」导入成功`);
        setImportUrl("");
        await fetchPlugins();
        await fetchSources();
      } else {
        showPluginError(data.message || "插件导入失败");
      }
    } catch {
      showPluginError("网络错误，导入失败");
    } finally {
      setImporting(false);
    }
  };

  const handleSubscribe = async () => {
    const url = subscribeUrl.trim();
    if (!url) return;
    setSubscribing(true);
    setPluginError(null);
    setPluginSuccess(null);
    try {
      const res = await apiFetch("/admin/plugins/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok || res.status === 207) {
        const failedInfo =
          data.failed && data.failed.length > 0
            ? `（失败: ${data.failed.map((f: { name: string }) => f.name).join(", ")}）`
            : "";
        showPluginSuccess(`${data.message || "订阅完成"}${failedInfo}`);
        setSubscribeUrl("");
        await fetchPlugins();
        await fetchSources();
      } else {
        showPluginError(data.message || "订阅失败");
      }
    } catch {
      showPluginError("网络错误，订阅失败");
    } finally {
      setSubscribing(false);
    }
  };

  const handleDeletePlugin = async (plugin: PluginInfo) => {
    if (!window.confirm(`确认删除插件「${plugin.platform}」？`)) return;
    setPluginError(null);
    setPluginSuccess(null);
    try {
      const res = await apiFetch(
        `/admin/plugins/${encodeURIComponent(plugin.id)}`,
        { method: "DELETE" }
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        showPluginSuccess(`插件「${plugin.platform}」已删除`);
        await fetchPlugins();
        await fetchSources();
      } else {
        showPluginError(data.message || "删除失败");
      }
    } catch {
      showPluginError("网络错误，删除失败");
    }
  };

  const handleSaveMusic = async () => {
    setSavingMusic(true);
    setMusicSaved(false);
    try {
      const res = await apiFetch("/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        setMusicSaved(true);
        setTimeout(() => setMusicSaved(false), 2000);
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.message || "保存失败");
      }
    } catch {
      alert("网络错误");
    } finally {
      setSavingMusic(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-adm-border border-t-adm-text" />
          <p className="text-sm text-adm-text-secondary">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Music className="h-5 w-5 text-adm-text-tertiary" />
        <h1 className="text-lg font-semibold text-adm-text">音乐管理</h1>
        <span className="ml-auto rounded-full bg-adm-input px-2.5 py-0.5 text-xs text-adm-text-secondary">
          {sources.length} 个音源
        </span>
      </div>

      {/* 双列布局：音源插件 + 背景音乐配置 */}
      <div className="space-y-4 gap-4 sm:grid sm:grid-cols-2 sm:items-start sm:space-y-0">
      {/* 音源插件卡片 */}
      <div className="rounded-2xl border border-adm-border bg-adm-card p-4">
        <div className="mb-4 flex items-center gap-2 border-b border-adm-border pb-3">
          <Puzzle className="h-4 w-4 text-adm-text-tertiary" />
          <h2 className="text-sm font-semibold text-adm-text">音源插件</h2>
          <span className="ml-auto rounded-full bg-adm-primary/10 px-2 py-0.5 text-[10px] font-medium text-adm-primary">
            {plugins.length} 个已安装
          </span>
        </div>

        <p className="mb-4 text-xs text-adm-text-tertiary">
          导入 MusicFree 插件 .js 脚本，与 MusicFree 桌面端/安卓端插件完全兼容。支持搜索、播放、歌词、歌单导入、音乐详情等能力。可上传单文件、粘贴 .js 直链，或粘贴订阅 .json 一次性安装多个音源。
        </p>

        {/* 操作行 1：上传 + 单文件在线导入 */}
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            ref={fileInputRef}
            type="file"
            accept=".js"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleUploadFile(f);
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-adm-primary px-4 py-2.5 text-sm font-medium text-adm-primary-text transition-colors hover:opacity-90 disabled:opacity-50"
          >
            {uploading ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            {uploading ? "安装中..." : "上传插件"}
          </button>

          <div className="flex flex-1 items-center gap-2">
            <div className="relative flex-1">
              <Link2 className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-adm-text-tertiary" />
              <input
                type="url"
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && importUrl.trim() && !importing) {
                    handleImportUrl();
                  }
                }}
                placeholder="粘贴插件 .js 在线 URL 进行导入"
                className="w-full rounded-xl border border-adm-border bg-adm-input py-2.5 pl-9 pr-3 text-sm text-adm-text transition-colors focus:border-adm-text-secondary focus:bg-adm-input-focus focus:outline-none focus:ring-1 focus:ring-adm-text-secondary"
              />
            </div>
            <button
              type="button"
              onClick={handleImportUrl}
              disabled={!importUrl.trim() || importing}
              className="flex shrink-0 items-center gap-1.5 rounded-xl bg-adm-input px-4 py-2.5 text-sm font-medium text-adm-text-secondary transition-colors hover:bg-adm-card-hover disabled:opacity-50"
            >
              {importing ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              {importing ? "导入中..." : "导入"}
            </button>
          </div>
        </div>

        {/* 操作行 2：订阅 .json（一次安装多个插件） */}
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-center gap-2">
            <div className="relative flex-1">
              <Link2 className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-adm-text-tertiary" />
              <input
                type="url"
                value={subscribeUrl}
                onChange={(e) => setSubscribeUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && subscribeUrl.trim() && !subscribing) {
                    handleSubscribe();
                  }
                }}
                placeholder="粘贴订阅 .json URL，一次性安装多个音源"
                className="w-full rounded-xl border border-adm-border bg-adm-input py-2.5 pl-9 pr-3 text-sm text-adm-text transition-colors focus:border-adm-text-secondary focus:bg-adm-input-focus focus:outline-none focus:ring-1 focus:ring-adm-text-secondary"
              />
            </div>
            <button
              type="button"
              onClick={handleSubscribe}
              disabled={!subscribeUrl.trim() || subscribing}
              className="flex shrink-0 items-center gap-1.5 rounded-xl bg-adm-input px-4 py-2.5 text-sm font-medium text-adm-text-secondary transition-colors hover:bg-adm-card-hover disabled:opacity-50"
            >
              {subscribing ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              {subscribing ? "订阅中..." : "订阅"}
            </button>
          </div>
        </div>

        {/* 错误/成功提示 */}
        {pluginError && (
          <div className="mb-4 flex items-start gap-2 rounded-xl bg-adm-danger-bg px-3 py-2.5 text-xs text-adm-danger animate-modal-in">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="break-all">{pluginError}</span>
          </div>
        )}
        {pluginSuccess && (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-green-500/10 px-3 py-2.5 text-xs text-green-600 dark:text-green-400 animate-modal-in">
            <Check className="h-3.5 w-3.5 shrink-0" />
            <span className="break-all">{pluginSuccess}</span>
          </div>
        )}

        {/* 插件列表 */}
        {pluginsLoading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-4 w-4 animate-spin text-adm-text-tertiary" />
            <span className="ml-2 text-xs text-adm-text-tertiary">加载插件列表...</span>
          </div>
        ) : plugins.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-adm-border py-10 text-center">
            <FileCode2 className="mb-2 h-8 w-8 text-adm-text-tertiary" />
            <p className="text-sm text-adm-text-secondary">尚未安装任何插件</p>
            <p className="mt-1 text-xs text-adm-text-tertiary">
              上传 .js 文件或粘贴 URL 在线导入
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {plugins.map((plugin) => {
              const methodLabels: Record<string, string> = {
                search: "搜索",
                getMediaSource: "播放",
                getLyric: "歌词",
                getMusicInfo: "详情",
                getAlbumInfo: "专辑",
                getMusicSheetInfo: "歌单信息",
                getArtistWorks: "歌手作品",
                importMusicSheet: "导入歌单",
                importMusicItem: "导入单曲",
                getTopLists: "排行榜",
                getTopListDetail: "排行榜详情",
                getRecommendSheetTags: "推荐标签",
                getRecommendSheetsByTag: "推荐歌单",
                getMusicComments: "评论",
              };
              return (
                <li
                  key={plugin.id}
                  className="flex flex-col gap-3 rounded-xl border border-adm-border bg-adm-input/60 p-3 sm:flex-row sm:items-center"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-adm-card text-adm-text-tertiary">
                      <Puzzle className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-medium text-adm-text">
                          {plugin.platform}
                        </span>
                        {PLATFORM_MAP[plugin.platform] && (
                          <span className="rounded-full bg-adm-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-adm-primary">
                            {PLATFORM_MAP[plugin.platform]}
                          </span>
                        )}
                        {plugin.version && (
                          <span className="rounded-full bg-adm-input px-1.5 py-0.5 text-[10px] text-adm-text-tertiary">
                            v{plugin.version}
                          </span>
                        )}
                        {plugin.author && (
                          <span className="text-[10px] text-adm-text-tertiary">
                            by {plugin.author}
                          </span>
                        )}
                      </div>
                      {plugin.description && (
                        <p className="mt-1 truncate text-xs text-adm-text-tertiary">
                          {plugin.description}
                        </p>
                      )}
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {plugin.methods.map((m) => (
                          <span
                            key={m}
                            className="rounded bg-adm-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-adm-primary"
                          >
                            {methodLabels[m] || m}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeletePlugin(plugin)}
                    className="flex shrink-0 items-center justify-center gap-1 rounded-lg bg-adm-danger-bg px-2.5 py-1.5 text-xs text-adm-danger transition-colors hover:bg-adm-danger/10 sm:px-3"
                    aria-label={`删除插件 ${plugin.platform}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span className="sm:inline">删除</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* 背景音乐配置卡片 */}
      <div className="rounded-2xl border border-adm-border bg-adm-card p-4">
        <div className="mb-4 flex items-center gap-2 border-b border-adm-border pb-3">
          <Music className="h-4 w-4 text-adm-text-tertiary" />
          <h2 className="text-sm font-semibold text-adm-text">背景音乐</h2>
          <span className="ml-auto rounded-full bg-adm-primary/10 px-2 py-0.5 text-[10px] font-medium text-adm-primary">
            {currentSourceName}
          </span>
        </div>

        {/* Source selector */}
        <div className="mb-5">
          <label className="mb-1.5 block text-xs font-medium text-adm-text-secondary">
            音源选择 <span className="text-adm-text-tertiary">（已安装的 MusicFree 插件音源，直接选择即可使用）</span>
          </label>
          <select
            value={settings.musicSource}
            onChange={(e) => {
              setSettings({ ...settings, musicSource: e.target.value });
            }}
            className="w-full rounded-xl border border-adm-border bg-adm-input py-2.5 px-3 text-sm text-adm-text transition-colors focus:border-adm-text-secondary focus:bg-adm-input-focus focus:outline-none focus:ring-1 focus:ring-adm-text-secondary"
          >
            {sources.length === 0 ? (
              <option value={settings.musicSource}>{currentSourceName}（暂无可用音源）</option>
            ) : (
              sources.map((s) => (
                <option key={s.platform} value={s.platform}>
                  {PLATFORM_MAP[s.platform] ? `${s.name}（${PLATFORM_MAP[s.platform]}）` : s.name}
                </option>
              ))
            )}
          </select>
        </div>

        {/* Playlist ID input */}
        <div className="mb-5">
          <label className="mb-1.5 block text-xs font-medium text-adm-text-secondary">
            {currentSourceName}歌单 ID <span className="text-adm-text-tertiary">（优先级最高，填写后顶栏将按顺序播放歌单内全部歌曲）</span>
          </label>
          <div className="relative">
            <Music className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-adm-text-tertiary" />
            <input
              type="text"
              value={settings.playlistId}
              onChange={(e) => setSettings({ ...settings, playlistId: e.target.value.trim() })}
              className="w-full rounded-xl border border-adm-border bg-adm-input py-2.5 pl-10 pr-3 text-sm text-adm-text transition-colors focus:border-adm-text-secondary focus:bg-adm-input-focus focus:outline-none focus:ring-1 focus:ring-adm-text-secondary"
              placeholder="留空则使用下方单曲 ID"
            />
          </div>
          <p className="mt-1.5 text-xs text-adm-text-tertiary">
            打开对应音源的歌单页，URL 中的 ID 即为歌单 ID。填写后单曲 ID 将被忽略。
          </p>
        </div>

        {/* Song ID input */}
        <div className="mb-5">
          <label className="mb-1.5 block text-xs font-medium text-adm-text-secondary">
            {currentSourceName}歌曲 ID
          </label>
          <div className="relative">
            <Music className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-adm-text-tertiary" />
            <input
              type="text"
              value={settings.musicId}
              onChange={(e) => setSettings({ ...settings, musicId: e.target.value.trim() })}
              className="w-full rounded-xl border border-adm-border bg-adm-input py-2.5 pl-10 pr-3 text-sm text-adm-text transition-colors focus:border-adm-text-secondary focus:bg-adm-input-focus focus:outline-none focus:ring-1 focus:ring-adm-text-secondary"
              placeholder="如：1307374414"
            />
          </div>
          <p className="mt-1.5 text-xs text-adm-text-tertiary">
            打开对应音源的歌曲页，URL 中的数字即为歌曲 ID
          </p>
        </div>

        <button
          type="button"
          onClick={handleSaveMusic}
          disabled={savingMusic}
          className="flex items-center gap-2 rounded-xl bg-adm-primary px-5 py-2.5 text-sm font-medium text-adm-primary-text transition-colors hover:opacity-90 disabled:opacity-50"
        >
          {musicSaved ? (
            <>
              <Check className="h-4 w-4" />
              已保存
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              {savingMusic ? "保存中..." : "保存背景音乐"}
            </>
          )}
        </button>
      </div>
      </div>
    </div>
  );
}
