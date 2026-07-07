/**
 * MusicFree 插件协议类型定义
 *
 * 来源：
 * - https://github.com/maotoumao/MusicFreePluginTemplate/blob/master/types/plugin.d.ts
 * - https://github.com/maotoumao/musicfree-skills (plugin-protocol.md / media-types.md)
 *
 * 与 lx-music 的差异：
 * - 模块格式为 CommonJS（module.exports = {...}），不是 lx-music 的 IIFE
 * - 不用 env.request 发请求，全部直接 require("axios")
 * - 音质枚举为 low/standard/high/super（非 128k/320k/flac）
 * - 搜索返回 { isEnd, data }，isEnd 缺省为 true
 * - getMediaSource 返回 { url, headers?, userAgent? }（非纯字符串）
 */

/** 音质枚举（与 lx-music 不同，使用语义化命名） */
export type Quality = "low" | "standard" | "high" | "super";

/** 搜索类型 */
export type SearchType = "music" | "album" | "artist" | "sheet" | "lyric";

/** MusicFree IMediaBase：所有媒体类型的基类 */
export interface IMediaBase {
  platform: string;
  id: string;
}

/** MusicFree IMusicItem：音乐类型 */
export interface IMusicItem extends IMediaBase {
  platform: string;
  id: string;
  artist?: string;
  title?: string;
  duration?: number;
  album?: string;
  artwork?: string;
  url?: string;
  lrc?: string;
  rawLrc?: string;
  /** 插件可任意扩展字段（songmid/hash/bvid/copyrightId ...） */
  [k: string]: any;
}

/** MusicFree IAlbumItem / IMusicSheetItem（结构相同，语义不同） */
export interface IAlbumItem extends IMediaBase {
  platform: string;
  id: string;
  artwork?: string;
  title: string;
  description?: string;
  worksNum?: number;
  playCount?: number;
  musicList?: IMusicItem[];
  createAt?: number;
  artist?: string;
  [k: string]: any;
}

export interface IMusicSheetItem extends IAlbumItem {}

/** MusicFree IArtistItem */
export interface IArtistItem extends IMediaBase {
  platform: string;
  id: string;
  name: string;
  fans?: number;
  description?: string;
  avatar?: string;
  worksNum?: number;
  musicList?: IMusicItem[];
  albumList?: IAlbumItem[];
  [k: string]: any;
}

/** MusicFree IMusicSheetGroupItem：榜单/标签分组 */
export interface IMusicSheetGroupItem {
  title?: string;
  data: IMusicSheetItem[];
}

/** MusicFree IComment */
export interface IComment {
  id?: string;
  nickName: string;
  avatar?: string;
  comment: string;
  like?: number;
  createAt?: number;
  location?: string;
  replies?: Omit<IComment, "replies">[];
}

/** 分页返回结构 */
export interface IPagedResult<T> {
  isEnd?: boolean;
  data: T[];
}

/** getMediaSource 返回结构 */
export interface IMediaSourceResult {
  url: string;
  headers?: Record<string, string>;
  userAgent?: string;
}

/** getAlbumInfo / getMusicSheetInfo 返回结构 */
export interface IAlbumInfoResult {
  isEnd?: boolean;
  musicList: IMusicItem[];
  albumItem?: Partial<IAlbumItem>;
}

export interface IMusicSheetInfoResult {
  isEnd?: boolean;
  musicList: IMusicItem[];
  sheetItem?: Partial<IMusicSheetItem>;
}

/** getArtistWorks 返回结构 */
export interface IArtistWorksResult {
  isEnd?: boolean;
  data: IMusicItem[] | IAlbumItem[];
}

/** getRecommendSheetTags 返回结构 */
export interface IRecommendSheetTagsResult {
  pinned?: Array<{ id: string; title: string }>;
  data?: IMusicSheetGroupItem[];
}

/**
 * MusicFree 插件定义（IPlugin.IPluginDefine）
 * 全部方法可选，缺哪个框架就用默认行为。
 */
export interface IPluginDefine {
  /** 插件名（主键的一部分） */
  platform: string;
  /** 插件版本号，形如 "0.3.0" */
  version?: string;
  /** 已废弃：匹配的 app 版本约束 */
  appVersion?: string;
  /** 作者 */
  author?: string;
  /** 远程更新 URL */
  srcUrl?: string;
  /** 唯一标识一首歌的字段集合，如 ["id","songmid"] */
  primaryKey?: string[];
  /** 插件描述 */
  description?: string;
  /** 缓存策略 */
  cacheControl?: "cache" | "no-cache" | "no-store";
  /** 导入歌单/单曲时的提示文本 */
  hints?: {
    importMusicSheet?: string[];
    importMusicItem?: string[];
  };
  /** 声明支持的搜索类型 */
  supportedSearchType?: SearchType[];
  /** 已废弃 */
  defaultSearchType?: SearchType;
  /** 用户可配置变量（运行时支持，类型声明里没有） */
  userVariables?: any[];

  // 14 个可选方法
  search?(query: string, page: number, type: SearchType): Promise<IPagedResult<any>>;
  getMediaSource?(musicItem: IMusicItem, quality: Quality): Promise<IMediaSourceResult>;
  getMusicInfo?(musicItem: IMusicItem): Promise<Partial<IMusicItem>>;
  getLyric?(musicItem: IMusicItem): Promise<{ rawLrc?: string; lrc?: string; translation?: string }>;
  getAlbumInfo?(albumItem: IAlbumItem, page: number): Promise<IAlbumInfoResult>;
  getMusicSheetInfo?(sheetItem: IMusicSheetItem, page: number): Promise<IMusicSheetInfoResult>;
  getArtistWorks?(artistItem: IArtistItem, page: number, type: "music" | "album"): Promise<IArtistWorksResult>;
  importMusicSheet?(urlLike: string): Promise<IMusicItem[]>;
  importMusicItem?(urlLike: string): Promise<IMusicItem>;
  getTopLists?(): Promise<IMusicSheetGroupItem[]>;
  getTopListDetail?(topListItem: IMusicSheetItem, page: number): Promise<{ isEnd?: boolean; musicList: IMusicItem[]; topListItem?: Partial<IMusicSheetItem> }>;
  getRecommendSheetTags?(): Promise<IRecommendSheetTagsResult>;
  getRecommendSheetsByTag?(tag: { id: string; title: string }, page: number): Promise<IPagedResult<IMusicSheetItem>>;
  getMusicComments?(musicItem: IMusicItem, page: number): Promise<IPagedResult<IComment>>;
}

/**
 * 已加载的 MusicFree 插件实例
 */
export interface LoadedMusicFreePlugin {
  /** 插件 platform 字段（主键） */
  platform: string;
  /** 插件实例（IPluginDefine） */
  instance: IPluginDefine;
  /** 原始代码（用于持久化/重载） */
  rawCode: string;
  /** 代码 hash（sha256，用于去重） */
  hash: string;
  /** 文件名（不含路径） */
  fileName: string;
  /** 来源 URL（如有） */
  srcUrl?: string;
  /** 安装时间 */
  installedAt: number;
}

/** 插件订阅 JSON 格式 */
export interface IPluginSubscription {
  plugins: Array<{
    name: string;
    url: string;
    version?: string;
  }>;
}
