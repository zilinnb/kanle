/**
 * MusicFree 插件 → 内部 MusicSource 适配器
 *
 * 把一个 LoadedMusicFreePlugin 包装为 MusicSource 接口实例。
 * 内部调用插件的 14 个可选方法，做错误兜底和数据规范化。
 *
 * 适配映射：
 *   MusicSource.search       → plugin.search
 *   MusicSource.getStreamUrl → plugin.getMediaSource（含重试 1 次）
 *   MusicSource.getLyric     → plugin.getLyric
 *   MusicSource.getInfo      → plugin.getMusicInfo
 *   MusicSource.importPlaylist → plugin.importMusicSheet
 *
 * 兜底逻辑参考 MusicFreeDesktop/src/shared/plugin-manager/main/plugin-methods.ts：
 * - 所有方法 try/catch，失败返回安全默认值
 * - 对返回的每条 IMusicItem 注入 platform = plugin.platform
 * - getMediaSource 失败时重试 1 次（间隔 150ms）
 *   throw Error("NOT RETRY") 可跳过重试
 */
import type {
  MusicItem,
  MusicSource,
  SearchResult,
  LyricResult,
  MusicInfoResult,
  MediaSourceResult,
  Quality,
} from "./types";
import type {
  IPluginDefine,
  IMusicItem,
  LoadedMusicFreePlugin,
  SearchType,
} from "./mf-types";

/** 重试间隔（毫秒，与官方一致） */
const MEDIA_SOURCE_RETRY_INTERVAL = 150;

/** 把 MusicFree IMusicItem 转为内部 MusicItem（注入 platform） */
function resetMediaItem(item: any, platform: string): MusicItem {
  if (!item || typeof item !== "object") {
    return { id: "", platform };
  }
  // 浅拷贝 + 注入 platform
  return { ...item, platform, id: String(item.id ?? "") };
}

/** 安全调用插件方法，失败时返回 fallback */
async function safeCall<T>(
  fn: (() => Promise<T>) | undefined,
  fallback: T,
  label: string
): Promise<T> {
  if (typeof fn !== "function") return fallback;
  try {
    return await fn();
  } catch (err: any) {
    console.error(`[mf-adapter] ${label} failed:`, err?.message || err);
    return fallback;
  }
}

/** 把 SearchType 字符串规范化（默认 "music"） */
function normalizeSearchType(type?: string): SearchType {
  const t = String(type || "music").toLowerCase();
  if (t === "music" || t === "album" || t === "artist" || t === "sheet" || t === "lyric") {
    return t as SearchType;
  }
  return "music";
}

/**
 * 把一个 MusicFree 插件包装为 MusicSource
 */
export function adaptPlugin(plugin: LoadedMusicFreePlugin): MusicSource {
  const inst: IPluginDefine = plugin.instance;
  const platform = plugin.platform;

  return {
    code: platform,
    name: platform,
    primaryKey: inst.primaryKey || ["id"],

    async search(keyword, page, type?): Promise<SearchResult> {
      if (typeof inst.search !== "function") {
        return { isEnd: true, data: [] };
      }
      // 检查 supportedSearchType：若插件声明了，且不支持当前 type，直接返回空
      if (
        inst.supportedSearchType &&
        Array.isArray(inst.supportedSearchType) &&
        inst.supportedSearchType.length > 0
      ) {
        const t = normalizeSearchType(type);
        if (!inst.supportedSearchType.includes(t)) {
          return { isEnd: true, data: [] };
        }
      }

      const result = await safeCall(
        () => inst.search!(keyword, page, normalizeSearchType(type)),
        { isEnd: true, data: [] },
        `search(${platform})`
      );

      const list: any[] = result?.data || [];
      const data = list
        .map((item) => resetMediaItem(item, platform))
        .filter((m) => m.id);

      return {
        isEnd: result?.isEnd ?? true,
        data,
      };
    },

    async getStreamUrl(item: MusicItem, quality: Quality): Promise<MediaSourceResult> {
      if (typeof inst.getMediaSource !== "function") {
        return { url: "" };
      }

      // 注入 platform 后传给插件
      const musicInfo: IMusicItem = {
        ...item,
        platform,
        id: String(item.id ?? ""),
      };

      // 第一次尝试
      let lastErr: any = null;
      try {
        const result = await inst.getMediaSource(musicInfo, quality);
        if (result?.url) {
          return {
            url: result.url,
            headers: result.headers,
            userAgent: result.userAgent,
          };
        }
      } catch (err: any) {
        // throw Error("NOT RETRY") 可跳过重试
        if (err?.message === "NOT RETRY") {
          return { url: "" };
        }
        lastErr = err;
      }

      // 重试 1 次（间隔 150ms，与官方一致）
      await new Promise((resolve) =>
        setTimeout(resolve, MEDIA_SOURCE_RETRY_INTERVAL)
      );
      try {
        const result = await inst.getMediaSource(musicInfo, quality);
        if (result?.url) {
          return {
            url: result.url,
            headers: result.headers,
            userAgent: result.userAgent,
          };
        }
      } catch (err: any) {
        if (err?.message === "NOT RETRY") {
          return { url: "" };
        }
        lastErr = err;
      }

      if (lastErr) {
        console.error(
          `[mf-adapter] getMediaSource(${platform}) failed after retry:`,
          lastErr?.message || lastErr
        );
      }
      return { url: "" };
    },

    async getLyric(item: MusicItem): Promise<LyricResult> {
      if (typeof inst.getLyric !== "function") {
        // 若 musicItem 本身已有 rawLrc，直接用
        if (item.rawLrc) return { rawLrc: item.rawLrc };
        return { rawLrc: "" };
      }
      const musicInfo: IMusicItem = {
        ...item,
        platform,
        id: String(item.id ?? ""),
      };
      const result = await safeCall(
        () => inst.getLyric!(musicInfo),
        { rawLrc: "" },
        `getLyric(${platform})`
      );
      return {
        rawLrc: result?.rawLrc || result?.lrc || "",
        translation: result?.translation,
      };
    },

    async getInfo(item: MusicItem): Promise<MusicInfoResult> {
      // 搜索结果已带 artwork/title/artist 时直接用
      if (item.artwork && item.title) {
        return {
          title: item.title,
          artist: item.artist,
          artwork: item.artwork,
          album: item.album,
        };
      }
      if (typeof inst.getMusicInfo !== "function") {
        return {
          title: item.title,
          artist: item.artist,
          artwork: item.artwork,
          album: item.album,
        };
      }
      const musicInfo: IMusicItem = {
        ...item,
        platform,
        id: String(item.id ?? ""),
      };
      const result = await safeCall(
        () => inst.getMusicInfo!(musicInfo),
        {},
        `getMusicInfo(${platform})`
      );
      // 与原数据合并（插件返回的是 Partial<IMusicItem>）
      return {
        title: result?.title || item.title,
        artist: result?.artist || item.artist,
        artwork: result?.artwork || item.artwork,
        album: result?.album || item.album,
      };
    },

    async importPlaylist(urlOrId: string): Promise<MusicItem[]> {
      if (typeof inst.importMusicSheet !== "function") {
        return [];
      }
      const result = await safeCall(
        () => inst.importMusicSheet!(String(urlOrId || "")),
        [],
        `importMusicSheet(${platform})`
      );
      const list: any[] = Array.isArray(result) ? result : [];
      return list
        .map((item) => resetMediaItem(item, platform))
        .filter((m) => m.id);
    },
  };
}
