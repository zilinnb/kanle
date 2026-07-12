"use client";

import { useEffect, useRef } from "react";
import { getGlobalAudio } from "@/lib/global-audio";
import { useMusicPlayer, type LyricLine, type PlaylistTrack } from "@/lib/music-player-store";
import { useSiteSettings } from "@/lib/site-settings-store";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
const AUDIO_BASE = API_URL.replace("/api", "");

function toAbsolute(url: string): string {
  if (!url || typeof url !== "string") return "";
  return url.startsWith("http") ? url : `${AUDIO_BASE}${url}`;
}

function parseLyric(lrc: string): LyricLine[] | null {
  if (!lrc) return null;
  const lines = lrc.split("\n");
  const parsed: LyricLine[] = [];
  const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/g;
  for (const line of lines) {
    const times: number[] = [];
    let match;
    while ((match = timeRegex.exec(line)) !== null) {
      const min = Number(match[1]);
      const sec = Number(match[2]);
      const msRaw = match[3];
      const ms = msRaw.length === 2 ? Number(msRaw) * 10 : Number(msRaw);
      times.push(min * 60 * 1000 + sec * 1000 + ms);
    }
    if (times.length === 0) continue;
    const text = line.replace(/\[\d{2}:\d{2}\.\d{2,3}\]/g, "").trim();
    for (const timeMs of times) {
      parsed.push({ timeMs, text });
    }
  }
  if (parsed.length === 0) return null;
  parsed.sort((a, b) => a.timeMs - b.timeMs);
  return parsed;
}

async function fetchLyric(
  platform: string,
  id: string,
  extra?: Record<string, any>,
  signal?: AbortSignal
): Promise<string | null> {
  if (!platform || !id) return null;
  const params = new URLSearchParams({ platform, id });
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (v != null && v !== "") params.set(k, String(v));
    }
  }
  try {
    const res = await fetch(`${API_URL}/music/lyric?${params.toString()}`, { signal });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.rawLrc || null;
  } catch {
    return null;
  }
}

/**
 * 全局音乐管理器：在 layout.tsx 中挂载，无形组件（返回 null）。
 * 职责：
 * 1. 首次 fetch /api/music → store（只执行一次）
 * 2. 绑定 audio 事件 → store（全局唯一一份）
 * 3. onEnded 切歌逻辑
 * 4. 歌词 fetch（监听 activePostMusic / playlist[currentIndex] 变化）
 */
export default function GlobalMusicManager() {
  const initRef = useRef(false);
  const lyricAbortRef = useRef<AbortController | null>(null);

  // ===== 1. 首次 fetch /api/music =====
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    // 并行获取音乐数据和站点设置（确保 musicAutoplay 可用）
    Promise.all([
      fetch(`${API_URL}/music`).then((res) => (res.ok ? res.json() : {})),
      useSiteSettings.getState().fetchSettings(),
    ])
      .then(([data]: [{
        mp3url?: string;
        name?: string;
        id?: string;
        lyric?: string;
        playlist?: PlaylistTrack[];
        currentIndex?: number;
      }, void]) => {
        if (!data.mp3url) {
          // 后端未配置音乐：标记已加载（避免顶栏一直显示骨架），停止切歌过渡
          useMusicPlayer.setState({ musicLoaded: true, switching: false });
          return;
        }
        const playlist: PlaylistTrack[] = Array.isArray(data.playlist) && data.playlist.length > 0
          ? data.playlist.map((t) => ({ ...t, mp3url: toAbsolute(t.mp3url) }))
          : [];
        const musicUrl = toAbsolute(data.mp3url);
        useMusicPlayer.getState().initMusic({
          mp3url: musicUrl,
          name: data.name || "",
          id: data.id || "",
          lyric: data.lyric ? parseLyric(data.lyric) : null,
          playlist,
          currentIndex: data.currentIndex || 0,
        });

        // 自动播放：站点设置开启时尝试播放（浏览器可能阻止，静默失败）
        if (useSiteSettings.getState().musicAutoplay) {
          const audio = getGlobalAudio();
          if (audio) {
            audio.src = musicUrl;
            audio.play().catch(() => {
              // 浏览器阻止自动播放，用户需手动点击播放
            });
          }
        }
      })
      .catch(() => {
        // fetch 失败（网络错误/后端不可达）：标记已加载，避免骨架永久占位
        useMusicPlayer.setState({ musicLoaded: true, switching: false });
      });
  }, []);

  // ===== 2. 绑定 audio 事件 → store =====
  useEffect(() => {
    const audio = getGlobalAudio();
    if (!audio) return;

    const onLoadStart = () => {
      const st = useMusicPlayer.getState();
      st.setSwitching(true);
      st.setLoading(true);
      st.setAudioError(false);
    };
    const onCanPlay = () => {
      const st = useMusicPlayer.getState();
      st.setSwitching(false);
      st.setLoading(false);
    };
    const onPlay = () => {
      const st = useMusicPlayer.getState();
      st.setPlaying(true);
      st.setLoading(false);
      st.setSwitching(false);
      st.setAudioError(false);
    };
    const onPause = () => {
      useMusicPlayer.getState().setPlaying(false);
    };
    const onEnded = () => {
      const st = useMusicPlayer.getState();
      // 动态音乐播完：回到歌单模式（不自动播放，但恢复 audio.src 以便用户点播放时放歌单曲目）
      if (st.activePostMusic) {
        st.clear();
        const pl = st.playlist;
        const idx = st.currentIndex;
        if (pl[idx]) {
          st.switchToTrack(idx);
          audio.src = pl[idx].mp3url;
          audio.load();
        }
        st.setPlaying(false);
        return;
      }
      // 歌单模式：自动下一首
      const pl = st.playlist;
      if (pl.length > 0) {
        const next = (st.currentIndex + 1) % pl.length;
        const track = pl[next];
        if (track) {
          st.switchToTrack(next);
          audio.src = track.mp3url;
          audio.play().catch(() => st.setAudioError(true));
        }
      } else {
        st.setPlaying(false);
      }
    };
    const onError = () => {
      const st = useMusicPlayer.getState();
      st.setSwitching(false);
      st.setLoading(false);
      st.setAudioError(true);
      st.setPlaying(false);
    };
    const onWaiting = () => useMusicPlayer.getState().setLoading(true);
    const onPlaying = () => useMusicPlayer.getState().setLoading(false);
    const onTimeUpdate = () => {
      const st = useMusicPlayer.getState();
      const lc = st.lyric;
      if (!lc || lc.length === 0) {
        if (st.currentLyric !== "") st.setCurrentLyric("");
        if (st.currentLyricIndex !== -1) st.setCurrentLyricIndex(-1);
        return;
      }
      const ms = audio.currentTime * 1000;
      let line = "";
      let idx = -1;
      for (let i = lc.length - 1; i >= 0; i--) {
        if (lc[i].timeMs <= ms) {
          line = lc[i].text;
          idx = i;
          break;
        }
      }
      if (st.currentLyric !== line) st.setCurrentLyric(line);
      if (st.currentLyricIndex !== idx) st.setCurrentLyricIndex(idx);
    };

    audio.addEventListener("loadstart", onLoadStart);
    audio.addEventListener("canplay", onCanPlay);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("timeupdate", onTimeUpdate);
    return () => {
      audio.removeEventListener("loadstart", onLoadStart);
      audio.removeEventListener("canplay", onCanPlay);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("timeupdate", onTimeUpdate);
    };
  }, []);

  // ===== 3. 歌词 fetch：监听 activePostMusic 和 playlist[currentIndex] 变化 =====
  const activePostMusic = useMusicPlayer((s) => s.activePostMusic);
  const playlist = useMusicPlayer((s) => s.playlist);
  const currentIndex = useMusicPlayer((s) => s.currentIndex);

  useEffect(() => {
    // 确定当前需要获取歌词的曲目
    let track: {
      lrc?: string;
      platform?: string;
      musicId?: string;
      neteaseId?: string;
      extra?: Record<string, any>;
      postId?: string;
      id?: string;
      lyric?: string;
    } | null = null;

    if (activePostMusic) {
      track = activePostMusic;
    } else if (playlist.length > 0 && currentIndex >= 0 && playlist[currentIndex]) {
      track = playlist[currentIndex];
    }

    const st = useMusicPlayer.getState();
    st.setLyric(null);
    st.setCurrentLyric("");
    st.setCurrentLyricIndex(-1);

    if (!track) return;

    // 优先用 lrc 字段（上传歌曲/歌单预置歌词），直接解析
    if (track.lrc) {
      st.setLyric(parseLyric(track.lrc));
      return;
    }
    // 歌单模式：track.lyric 是原始 LRC 文本
    if ((track as PlaylistTrack).lyric) {
      st.setLyric(parseLyric((track as PlaylistTrack).lyric));
      return;
    }

    // 异步获取歌词
    const platform = track.platform || "netease";
    const songId = track.musicId || track.neteaseId || track.id;
    const trackPostId = track.postId;
    if (!songId) return;

    if (lyricAbortRef.current) lyricAbortRef.current.abort();
    const ac = new AbortController();
    lyricAbortRef.current = ac;

    fetchLyric(platform, songId, track.extra, ac.signal).then((lrc) => {
      if (!lrc) return;
      const state = useMusicPlayer.getState();
      // 确保仍是同一首曲目才写入
      if (activePostMusic) {
        if (state.activePostMusic?.postId === trackPostId) {
          state.setLyric(parseLyric(lrc));
        }
      } else {
        // 歌单模式：检查索引未变
        if (state.currentIndex === currentIndex && !state.activePostMusic) {
          state.setLyric(parseLyric(lrc));
        }
      }
    });
  }, [activePostMusic, playlist, currentIndex]);

  return null;
}
