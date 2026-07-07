"use client";

import { useEffect, useState } from "react";
import { Loader2, X, Music, Upload, ImagePlus, Search } from "lucide-react";
import type { PostMusic } from "@/lib/mock-data";
import { MUSIC_PLUGIN_LABELS } from "@/lib/mock-data";
import { uploadImage, toAbsoluteUrl, toHttps } from "@/lib/upload";
import LyricEditor from "@/components/LyricEditor";
import AdminModal from "./AdminModal";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
const PLATFORM_MAP = MUSIC_PLUGIN_LABELS;

interface MusicPanelProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (music: PostMusic) => void;
  initial?: PostMusic | null;
  token: string;
}

export default function MusicPanel({
  open,
  onClose,
  onConfirm,
  initial,
  token,
}: MusicPanelProps) {
  const [tab, setTab] = useState<"search" | "upload">(
    initial ? "upload" : "search"
  );
  // Search state
  const [plugins, setPlugins] = useState<{ platform: string; name: string }[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState("");
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [loadingMusic, setLoadingMusic] = useState(false);

  // Upload state
  const [name, setName] = useState(initial?.name ?? "");
  const [artist, setArtist] = useState(initial?.artist ?? "");
  const [cover, setCover] = useState(initial?.cover ?? "");
  const [audioMode, setAudioMode] = useState<"file" | "url">(
    initial?.url ? "url" : "file"
  );
  const [audioUrl, setAudioUrl] = useState(initial?.url ?? "");
  const [audioName, setAudioName] = useState(initial?.name ?? "");
  const [lrc, setLrc] = useState(initial?.lrc ?? "");
  const [showLyric, setShowLyric] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  const [error, setError] = useState("");

  // Fetch music sources
  useEffect(() => {
    if (!open || plugins.length > 0) return;
    fetch(`${API_URL}/music/sources`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: { platform: string; name: string }[]) => {
        setPlugins(data);
        if (data.length > 0 && !selectedPlatform) {
          setSelectedPlatform(data[0].platform);
        }
      })
      .catch(() => {});
  }, [open, plugins.length, selectedPlatform]);

  // Reset when opening
  useEffect(() => {
    if (open && initial) {
      setName(initial.name ?? "");
      setArtist(initial.artist ?? "");
      setCover(initial.cover ?? "");
      setAudioUrl(initial.url ?? "");
      setAudioName(initial.name ?? "");
      setLrc(initial.lrc ?? "");
      setAudioMode(initial.url ? "url" : "file");
      setTab("upload");
    } else if (open) {
      setName("");
      setArtist("");
      setCover("");
      setAudioUrl("");
      setAudioName("");
      setLrc("");
      setAudioMode("file");
      setTab("search");
    }
    setError("");
    setResults([]);
    setKeyword("");
  }, [open, initial]);

  const handleSearch = async () => {
    const kw = keyword.trim();
    if (!kw || !selectedPlatform) return;
    setSearching(true);
    setError("");
    setResults([]);
    try {
      const res = await fetch(
        `${API_URL}/music/search?platform=${encodeURIComponent(selectedPlatform)}&keyword=${encodeURIComponent(kw)}&page=1&type=music`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setResults(data.data || []);
        if (!data.data || data.data.length === 0) {
          setError("未找到相关歌曲");
        }
      } else {
        const err = await res.json().catch(() => ({ message: "搜索失败" }));
        setError(err.message || "搜索失败");
      }
    } catch {
      setError("网络错误");
    } finally {
      setSearching(false);
    }
  };

  const handlePickSong = async (item: any) => {
    setLoadingMusic(true);
    setError("");
    try {
      const standardFields = new Set([
        "id", "platform", "title", "artist", "album", "artwork", "url", "lrc", "rawLrc", "duration",
      ]);
      const extra: Record<string, any> = {};
      for (const [k, v] of Object.entries(item)) {
        if (!standardFields.has(k) && v != null && v !== "") {
          extra[k] = v;
        }
      }
      const res = await fetch(`${API_URL}/music/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          id: String(item.id),
          platform: selectedPlatform,
          extra,
          title: item.title,
          artist: item.artist,
          artwork: item.artwork,
          album: item.album,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const finalExtra =
          Object.keys(extra).length > 0 ? extra : (data.extra || undefined);
        onConfirm({
          name: item.title || data.name || "音乐",
          artist: item.artist || data.author || "",
          cover: item.artwork || data.cover || "",
          url: data.mp3url || "",
          source: "musicfree",
          platform: selectedPlatform,
          musicId: String(item.id),
          extra: finalExtra,
        });
      } else {
        const err = await res.json().catch(() => ({ message: "获取失败" }));
        setError(err.message || "获取歌曲失败");
      }
    } catch {
      setError("网络错误");
    } finally {
      setLoadingMusic(false);
    }
  };

  const handleUploadAudio = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    setUploadingAudio(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("audio", file);
      const res = await fetch(`${API_URL}/upload/audio`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        setAudioUrl(data.url);
        setAudioName(file.name);
        if (!name) setName(file.name.replace(/\.[^.]+$/, ""));
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.message || "上传失败");
      }
    } catch {
      setError("网络错误，上传失败");
    } finally {
      setUploadingAudio(false);
    }
  };

  const handleUploadCover = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    setUploadingCover(true);
    setError("");
    try {
      const url = await uploadImage(file, token);
      setCover(url);
    } catch (e: any) {
      setError(e.message || "封面上传失败");
    } finally {
      setUploadingCover(false);
    }
  };

  const handleConfirmUpload = () => {
    const url = audioMode === "file" ? audioUrl : audioUrl.trim();
    if (!url) {
      setError("请上传音频文件或输入音频直链");
      return;
    }
    onConfirm({
      name: name || "未知歌曲",
      artist: artist || "未知艺术家",
      cover,
      url,
      source: "upload",
      lrc: lrc || undefined,
    });
  };

  return (
    <AdminModal
      open={open}
      onClose={onClose}
      title="添加音乐"
      footer={
        tab === "upload" ? (
          <>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-adm-border px-4 py-2 text-sm text-adm-text-secondary transition-colors hover:bg-adm-card-hover"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleConfirmUpload}
              disabled={audioMode === "file" ? !audioUrl : !audioUrl.trim()}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:opacity-40 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
            >
              确认
            </button>
          </>
        ) : undefined
      }
    >
      {/* Tabs */}
      <div className="mb-4 flex border-b border-adm-border">
        <button
          type="button"
          onClick={() => setTab("search")}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
            tab === "search"
              ? "border-b-2 border-gray-900 text-adm-text dark:border-white dark:text-gray-200"
              : "text-adm-text-tertiary"
          }`}
        >
          搜索
        </button>
        <button
          type="button"
          onClick={() => setTab("upload")}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
            tab === "upload"
              ? "border-b-2 border-gray-900 text-adm-text dark:border-white dark:text-gray-200"
              : "text-adm-text-tertiary"
          }`}
        >
          上传音乐
        </button>
      </div>

      {/* Body content */}
      <div>
        {error && (
          <p className="mb-3 text-xs text-red-500">{error}</p>
        )}

          {/* Search Tab */}
          {tab === "search" && (
            <div className="flex flex-col gap-3">
              {plugins.length === 0 ? (
                <p className="py-8 text-center text-xs text-adm-text-tertiary">
                  暂无可用音源，请先在后台「音乐管理」安装并启用插件
                </p>
              ) : (
                <>
                  <select
                    value={selectedPlatform}
                    onChange={(e) => {
                      setSelectedPlatform(e.target.value);
                      setResults([]);
                    }}
                    className="w-full rounded-lg border border-adm-border bg-adm-input px-3 py-2 text-sm text-adm-text focus:outline-none dark:focus:border-gray-500"
                  >
                    {plugins.map((p) => (
                      <option key={p.platform} value={p.platform}>
                        {PLATFORM_MAP[p.platform] ? `${p.name}（${PLATFORM_MAP[p.platform]}）` : p.name}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={keyword}
                      onChange={(e) => setKeyword(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !searching) handleSearch();
                      }}
                      placeholder="搜索歌曲、歌手"
                      className="flex-1 rounded-lg border border-adm-border bg-adm-input px-3 py-2 text-sm text-adm-text placeholder:text-adm-text-tertiary focus:border-gray-400 focus:outline-none dark:focus:border-gray-500"
                    />
                    <button
                      type="button"
                      onClick={handleSearch}
                      disabled={searching || !keyword.trim()}
                      className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:opacity-40 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
                    >
                      {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    </button>
                  </div>

                  {/* Results */}
                  <div className="space-y-1">
                    {searching && (
                      <div className="space-y-2">
                        {[...Array(4)].map((_, i) => (
                          <div key={i} className="flex items-center gap-2.5 p-2">
                            <div className="h-10 w-10 shrink-0 animate-pulse rounded bg-adm-input" />
                            <div className="flex-1 space-y-1">
                              <div className="h-3 w-3/4 animate-pulse rounded bg-adm-input" />
                              <div className="h-2.5 w-1/2 animate-pulse rounded bg-adm-input" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {!searching && results.length > 0 && (
                      <div className="space-y-1">
                        {results.map((item, i) => (
                          <button
                            key={`${item.id}-${i}`}
                            type="button"
                            onClick={() => handlePickSong(item)}
                            disabled={loadingMusic}
                            className="flex w-full items-center gap-2.5 rounded-lg p-2 text-left transition-colors hover:bg-adm-card-hover disabled:opacity-50"
                          >
                            {item.artwork ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={toHttps(item.artwork)}
                                alt=""
                                className="h-10 w-10 shrink-0 rounded object-cover"
                              />
                            ) : (
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-adm-input">
                                <Music className="h-4 w-4 text-adm-text-tertiary" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm text-adm-text">
                                {item.title}
                              </p>
                              <p className="truncate text-xs text-adm-text-tertiary">
                                {item.artist}
                                {item.album ? ` · ${item.album}` : ""}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Upload Tab */}
          {tab === "upload" && (
            <div className="space-y-4">
              {/* Cover */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-adm-text-secondary">
                  歌曲封面（可选）
                </label>
                {cover ? (
                  <div className="relative inline-block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={toAbsoluteUrl(cover)}
                      alt="封面预览"
                      className="h-24 w-24 rounded-lg object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setCover("")}
                      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                      aria-label="移除封面"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <label className="block">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        handleUploadCover(e.target.files);
                        e.target.value = "";
                      }}
                    />
                    <div className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-adm-border transition-colors hover:border-gray-400">
                      {uploadingCover ? (
                        <Loader2 className="h-6 w-6 animate-spin text-adm-text-tertiary" />
                      ) : (
                        <>
                          <ImagePlus className="h-6 w-6 text-adm-text-tertiary" />
                          <span className="mt-1 text-[10px] text-adm-text-tertiary">封面</span>
                        </>
                      )}
                    </div>
                  </label>
                )}
              </div>

              {/* Name */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-adm-text-secondary">
                  歌曲名称
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="歌曲名称"
                  className="w-full rounded-lg border border-adm-border bg-adm-input px-3 py-2 text-sm text-adm-text placeholder:text-adm-text-tertiary focus:border-gray-400 focus:outline-none dark:focus:border-gray-500"
                />
              </div>

              {/* Artist */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-adm-text-secondary">
                  艺术家
                </label>
                <input
                  type="text"
                  value={artist}
                  onChange={(e) => setArtist(e.target.value)}
                  placeholder="歌手名"
                  className="w-full rounded-lg border border-adm-border bg-adm-input px-3 py-2 text-sm text-adm-text placeholder:text-adm-text-tertiary focus:border-gray-400 focus:outline-none dark:focus:border-gray-500"
                />
              </div>

              {/* Audio source */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-adm-text-secondary">
                  音频来源
                </label>
                <div className="mb-2 flex gap-1 rounded-lg bg-adm-input p-0.5">
                  <button
                    type="button"
                    onClick={() => setAudioMode("file")}
                    className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
                      audioMode === "file"
                        ? "bg-white text-adm-text dark:bg-white/10 dark:text-gray-200"
                        : "text-adm-text-tertiary"
                    }`}
                  >
                    上传文件
                  </button>
                  <button
                    type="button"
                    onClick={() => setAudioMode("url")}
                    className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
                      audioMode === "url"
                        ? "bg-white text-adm-text dark:bg-white/10 dark:text-gray-200"
                        : "text-adm-text-tertiary"
                    }`}
                  >
                    直链 URL
                  </button>
                </div>

                {audioMode === "file" ? (
                  audioUrl ? (
                    <div className="flex items-center justify-between rounded-lg border border-adm-border bg-adm-input px-3 py-2.5">
                      <div className="flex min-w-0 items-center gap-2">
                        <Music className="h-4 w-4 shrink-0 text-adm-text-tertiary" />
                        <span className="truncate text-sm text-adm-text">
                          {audioName || "音频已上传"}
                        </span>
                      </div>
                      <label className="shrink-0 cursor-pointer text-xs text-adm-text-secondary hover:text-adm-text">
                        重新上传
                        <input
                          type="file"
                          accept="audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/aac"
                          className="hidden"
                          onChange={(e) => {
                            handleUploadAudio(e.target.files);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    </div>
                  ) : (
                    <label className="block">
                      <input
                        type="file"
                        accept="audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/aac"
                        className="hidden"
                        onChange={(e) => {
                          handleUploadAudio(e.target.files);
                          e.target.value = "";
                        }}
                      />
                      <div className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-adm-border py-6 transition-colors hover:border-gray-400">
                        {uploadingAudio ? (
                          <Loader2 className="h-8 w-8 animate-spin text-adm-text-tertiary" />
                        ) : (
                          <>
                            <Upload className="h-7 w-7 text-adm-text-tertiary" />
                            <p className="mt-1.5 text-sm text-adm-text-tertiary">
                              点击上传音乐文件
                            </p>
                            <p className="mt-0.5 text-[11px] text-adm-text-tertiary">
                              支持 MP3/WAV/OGG/AAC，最大 20MB
                            </p>
                          </>
                        )}
                      </div>
                    </label>
                  )
                ) : (
                  <input
                    type="url"
                    value={audioUrl}
                    onChange={(e) => setAudioUrl(e.target.value)}
                    placeholder="https://example.com/song.mp3"
                    className="w-full rounded-lg border border-adm-border bg-adm-input px-3 py-2 text-sm text-adm-text placeholder:text-adm-text-tertiary focus:border-gray-400 focus:outline-none dark:focus:border-gray-500"
                  />
                )}
              </div>

              {/* Lyrics */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowLyric((v) => !v)}
                  className="flex w-full items-center justify-between rounded-lg bg-adm-input px-3 py-2 text-xs font-medium text-adm-text-secondary transition-colors hover:bg-adm-card-hover"
                >
                  <span className="flex items-center gap-1.5">
                    <Music className="h-3.5 w-3.5" />
                    编辑歌词
                    {lrc && (
                      <span className="rounded-full bg-gray-500/15 px-1.5 py-0.5 text-[10px] text-adm-text-secondary">
                        已编辑
                      </span>
                    )}
                  </span>
                  <span className="text-[10px]">{showLyric ? "收起" : "展开"}</span>
                </button>
                {showLyric && (
                  <div className="mt-2">
                    <LyricEditor
                      audioUrl={audioMode === "file" ? audioUrl : audioUrl.trim()}
                      value={lrc}
                      onChange={setLrc}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
      </div>
    </AdminModal>
  );
}
