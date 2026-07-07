/**
 * 内部统一音源类型定义
 *
 * 这是 routes/music.ts 调用的接口；由 mf-adapter.ts 把 MusicFree 插件
 * 适配成此接口。
 *
 * 与原 lx-music 版本的差异：
 * - getStreamUrl 返回 MediaSourceResult（含 headers），不再是纯字符串
 *   原因：MusicFree 插件的 getMediaSource 返回 { url, headers? } 用于防盗链
 * - Quality 枚举与 MusicFree 一致：low/standard/high/super
 */

export type Quality = "low" | "standard" | "high" | "super";

export interface MusicItem {
  id: string;
  /** 平台代码（= MusicFree 插件的 platform 字段） */
  platform?: string;
  /** 歌曲标题 */
  title?: string;
  artist?: string;
  album?: string;
  artwork?: string;
  /** 直链 URL（部分插件 search 时即返回） */
  url?: string;
  /** 歌词文本 */
  rawLrc?: string;
  /** 歌词 URL */
  lrc?: string;
  /** 时长（秒） */
  duration?: number;
  /**
   * 插件特定字段（songmid/hash/bvid/copyrightId 等）。
   * 通过索引签名自由扩展，透传给后端 getStreamUrl/getLyric。
   */
  [key: string]: any;
}

export interface SearchResult {
  isEnd: boolean;
  data: MusicItem[];
}

export interface LyricResult {
  rawLrc: string;
  translation?: string;
}

export interface MusicInfoResult {
  title?: string;
  artist?: string;
  artwork?: string;
  album?: string;
}

/** getMediaSource 返回结构：URL + 可选请求头（防盗链） */
export interface MediaSourceResult {
  url: string;
  headers?: Record<string, string>;
  userAgent?: string;
}

/**
 * 音源接口：每个平台（即每个 MusicFree 插件）实现此接口
 */
export interface MusicSource {
  /** 平台代码（= MusicFree 插件的 platform 字段） */
  code: string;
  /** 平台名称（同 platform） */
  name: string;
  /** 主键字段，如 ["id"] 或 ["id","songmid"] */
  primaryKey: string[];
  /** 搜索 */
  search(query: string, page: number, type?: string): Promise<SearchResult>;
  /** 获取播放地址（含请求头） */
  getStreamUrl(item: MusicItem, quality: Quality): Promise<MediaSourceResult>;
  /** 获取歌词 */
  getLyric(item: MusicItem): Promise<LyricResult>;
  /** 获取歌曲信息（封面等） */
  getInfo(item: MusicItem): Promise<MusicInfoResult>;
  /** 导入歌单 */
  importPlaylist(urlOrId: string): Promise<MusicItem[]>;
}
