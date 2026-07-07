import { create } from "zustand";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

/**
 * 动态音乐的可播放 URL。
 * - MusicFree 插件源（QQ音乐等）：直链带时间戳会过期，改用 /api/music/stream
 *   代理端点，每次播放由后端实时调插件 getMediaSource 拿新 URL。
 * - 上传 / 旧数据：用存储的 url（上传不过期，旧 netease 直链由后端代理处理）。
 *
 * extra 字段展开成顶级 query 参数（值转字符串），
 * 避免 JSON 数字类型（如 albumid:36062）导致插件返回试听片段而非完整音频。
 */
export function resolvePostMusicUrl(music: {
  url?: string;
  source?: string;
  platform?: string;
  musicId?: string;
  songmid?: string;
  extra?: Record<string, any>;
}): string {
  // MusicFree 插件源 → 代理端点（实时解析，永不过期）
  if (music.source === "musicfree" && music.platform && music.musicId) {
    const params = new URLSearchParams();
    params.set("platform", music.platform);
    params.set("id", String(music.musicId));
    const extra: Record<string, any> = { ...(music.extra || {}) };
    if (music.songmid && !extra.songmid) extra.songmid = music.songmid;
    for (const [k, v] of Object.entries(extra)) {
      if (v != null && v !== "") params.set(k, String(v));
    }
    return `${API_URL}/music/stream?${params.toString()}`;
  }
  // 上传 / 其他：解析存储的 url 为绝对路径
  const rawUrl = music.url || "";
  if (!rawUrl) return "";
  if (rawUrl.startsWith("http")) return rawUrl;
  return `${API_URL.replace("/api", "")}${rawUrl}`;
}

/** 动态音乐信息——点击动态音乐卡片后，由顶栏播放器接管播放 */
export interface PostMusicInfo {
  postId: string;
  /** 可直接用于 <audio> src 的 URL（已处理网易云代理） */
  url: string;
  name: string;
  artist: string;
  cover: string;
  /** 网易云歌曲 ID，用于顶栏异步获取歌词 */
  neteaseId: string;
  /** Musicfree 插件 platform（新动态） */
  platform?: string;
  /** Musicfree 歌曲 ID（新动态） */
  musicId?: string;
  /** @deprecated 已并入 extra，保留以兼容旧数据 */
  songmid?: string;
  /**
   * 插件特定字段对象（songmid/hash/bvid 等），透传给后端 /api/music/lyric。
   * 对齐洛水 IMusicItem 全字段方案。
   */
  extra?: Record<string, any>;
  /** LRC 歌词文本（上传歌曲透传，顶栏直接解析） */
  lrc?: string;
}

/** 歌单曲目类型 */
export interface PlaylistTrack {
  id: string;
  name: string;
  artist: string;
  cover: string;
  mp3url: string;
  lyric: string;
  platform?: string;
  /** 插件特定字段（songmid/hash/bvid ...），透传给后端获取歌词/播放地址 */
  extra?: Record<string, any>;
}

/** 解析后的歌词行 */
export interface LyricLine {
  timeMs: number;
  text: string;
}

interface MusicPlayerState {
  /** 当前接管顶栏的动态 ID；同一时间只有一个 */
  activePostId: string | null;
  /** 当前接管的动态音乐详情；为 null 时顶栏回到歌单模式 */
  activePostMusic: PostMusicInfo | null;
  /** 背景音乐当前曲目（歌单模式）；activePostMusic 为 null 时使用 */
  bgMusic: PostMusicInfo | null;
  /** 全局播放状态（由顶栏 audio 事件驱动） */
  isPlaying: boolean;
  /** 音频加载中（loadstart→true, canplay/play/error→false） */
  isLoading: boolean;
  /** 当前歌词文本（由 audio timeupdate 驱动） */
  currentLyric: string;

  // ===== 新增：歌单与播放状态 =====
  /** 歌单列表 */
  playlist: PlaylistTrack[];
  /** 当前播放索引 */
  currentIndex: number;
  /** 当前音乐 URL（已 toAbsolute 处理） */
  musicUrl: string;
  /** 当前音乐名称 */
  musicName: string;
  /** 当前音乐 ID */
  musicId: string;
  /** 解析后的歌词数组 */
  lyric: LyricLine[] | null;
  /** 当前歌词行索引 */
  currentLyricIndex: number;
  /** 是否显示歌词面板 */
  showLyricPanel: boolean;
  /** 静音状态 */
  muted: boolean;
  /** 音频错误 */
  audioError: boolean;
  /** 音乐数据是否已从 API 加载完成 */
  musicLoaded: boolean;
  /** 切歌过渡中 */
  switching: boolean;

  // ===== Actions =====
  /** 切换为指定动态的音乐（顶栏接管，停止歌单） */
  setActive: (postId: string, music: PostMusicInfo) => void;
  /** 关闭动态接管，顶栏回到歌单模式 */
  clear: () => void;
  /** 设置背景音乐曲目（歌单模式） */
  setBgMusic: (music: PostMusicInfo | null) => void;
  /** 更新播放状态（供顶栏 audio 事件调用） */
  setPlaying: (playing: boolean) => void;
  /** 更新加载状态（供顶栏 audio 事件调用） */
  setLoading: (loading: boolean) => void;
  /** 更新当前歌词（供 audio timeupdate 调用） */
  setCurrentLyric: (lyric: string) => void;
  /** 从 API 响应初始化音乐数据（只执行一次，由 musicLoaded 守卫） */
  initMusic: (data: {
    mp3url: string;
    name: string;
    id: string;
    lyric: LyricLine[] | null;
    playlist: PlaylistTrack[];
    currentIndex: number;
  }) => void;
  /** 切换歌单曲目（设置 currentIndex/musicUrl/musicName/musicId，清空 lyric） */
  switchToTrack: (index: number) => void;
  /** 设置解析后的歌词 */
  setLyric: (lyric: LyricLine[] | null) => void;
  /** 设置当前歌词行索引 */
  setCurrentLyricIndex: (index: number) => void;
  /** 控制歌词面板显示 */
  setShowLyricPanel: (show: boolean) => void;
  /** 设置静音状态 */
  setMuted: (muted: boolean) => void;
  /** 设置音频错误 */
  setAudioError: (error: boolean) => void;
  /** 设置切歌过渡 */
  setSwitching: (switching: boolean) => void;
}

export const useMusicPlayer = create<MusicPlayerState>((set, get) => ({
  activePostId: null,
  activePostMusic: null,
  bgMusic: null,
  isPlaying: false,
  isLoading: false,
  currentLyric: "",

  playlist: [],
  currentIndex: 0,
  musicUrl: "",
  musicName: "",
  musicId: "",
  lyric: null,
  currentLyricIndex: -1,
  showLyricPanel: false,
  muted: false,
  audioError: false,
  musicLoaded: false,
  switching: false,

  setActive: (postId, music) =>
    set({ activePostId: postId, activePostMusic: music, switching: true, currentLyric: "", currentLyricIndex: -1 }),
  clear: () =>
    set({
      activePostId: null,
      activePostMusic: null,
      isPlaying: false,
      isLoading: false,
      switching: false,
      currentLyric: "",
      currentLyricIndex: -1,
    }),
  setBgMusic: (music) => set({ bgMusic: music, currentLyric: "" }),
  setPlaying: (playing) => set({ isPlaying: playing }),
  setLoading: (loading) => set({ isLoading: loading }),
  setCurrentLyric: (lyric) => set({ currentLyric: lyric }),

  initMusic: (data) => {
    if (get().musicLoaded) return;
    set({
      musicUrl: data.mp3url,
      musicName: data.name,
      musicId: data.id,
      lyric: data.lyric,
      playlist: data.playlist,
      currentIndex: data.currentIndex,
      musicLoaded: true,
    });
  },
  switchToTrack: (index) => {
    const { playlist } = get();
    const track = playlist[index];
    if (!track) return;
    set({
      currentIndex: index,
      musicUrl: track.mp3url,
      musicName: track.name,
      musicId: track.id,
      lyric: null,
      currentLyric: "",
      currentLyricIndex: -1,
      audioError: false,
    });
  },
  setLyric: (lyric) => set({ lyric }),
  setCurrentLyricIndex: (index) => set({ currentLyricIndex: index }),
  setShowLyricPanel: (show) => set({ showLyricPanel: show }),
  setMuted: (muted) => set({ muted }),
  setAudioError: (error) => set({ audioError: error }),
  setSwitching: (switching) => set({ switching }),
}));
