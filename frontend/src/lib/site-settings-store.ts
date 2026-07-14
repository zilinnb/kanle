import { create } from "zustand";
import { cdnUrl } from "./upload";

interface SiteSettingsState {
  /** 动态内容折叠字数阈值，0 表示不折叠 */
  postCollapseLength: number;
  /** 夜间模式自动调度开关 */
  darkModeEnabled: boolean;
  /** 夜间模式开始时间 HH:MM */
  darkModeStartTime: string;
  /** 夜间模式结束时间 HH:MM */
  darkModeEndTime: string;
  /** 网站名称 */
  siteName: string;
  /** 网站 favicon URL */
  faviconUrl: string;
  /** 网站域名 */
  domain: string;
  /** 备案号 */
  beian: string;
  /** 备案号点击跳转链接 */
  beianUrl: string;
  /** 网站背景图轮播列表（URL 数组），每次访问随机展示一张 */
  backgroundImages: string[];
  /** 广告是否在归档页显示 */
  adOnArchives: boolean;
  /** 默认文章封面（博主个人资料背景图），文章未设置封面时使用 */
  defaultCover: string;
  /** 进入网站是否自动播放歌单音乐 */
  musicAutoplay: boolean;
  /** 图片 CDN 代理地址（空则用原图）。格式：https://cdn.example.com/src= （直接拼接原图地址） */
  cdnProxyUrl: string;
  loaded: boolean;
  fetchSettings: () => Promise<void>;
  /** 强制重新拉取设置（忽略 loaded 缓存），用于管理员保存后立即生效 */
  refreshSettings: () => Promise<void>;
}

const DEFAULT_SITE_NAME = "朋友圈博客";

/** 从 localStorage 读取缓存的 siteName/faviconUrl/cdnProxyUrl，避免页面初次渲染时闪烁 */
function loadCachedDisplay(): { siteName: string; faviconUrl: string; cdnProxyUrl: string } {
  if (typeof window === "undefined") {
    return { siteName: DEFAULT_SITE_NAME, faviconUrl: "", cdnProxyUrl: "" };
  }
  try {
    const cached = localStorage.getItem("site_settings_display_cache");
    if (cached) {
      const parsed = JSON.parse(cached);
      return {
        siteName: parsed.siteName || DEFAULT_SITE_NAME,
        faviconUrl: parsed.faviconUrl || "",
        cdnProxyUrl: parsed.cdnProxyUrl || "",
      };
    }
  } catch {
    // ignore
  }
  return { siteName: DEFAULT_SITE_NAME, faviconUrl: "", cdnProxyUrl: "" };
}

/** 将 siteName/faviconUrl/cdnProxyUrl 缓存到 localStorage，供下次页面加载时使用 */
function cacheDisplay(siteName: string, faviconUrl: string, cdnProxyUrl: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      "site_settings_display_cache",
      JSON.stringify({ siteName, faviconUrl, cdnProxyUrl })
    );
  } catch {
    // ignore
  }
}

const cachedDisplay = loadCachedDisplay();

export const useSiteSettings = create<SiteSettingsState>((set, get) => ({
  postCollapseLength: 150,
  darkModeEnabled: false,
  darkModeStartTime: "18:00",
  darkModeEndTime: "06:00",
  siteName: cachedDisplay.siteName,
  faviconUrl: cachedDisplay.faviconUrl,
  cdnProxyUrl: cachedDisplay.cdnProxyUrl,
  domain: "",
  beian: "",
  beianUrl: "",
  backgroundImages: [],
  adOnArchives: false,
  defaultCover: "",
  musicAutoplay: false,
  loaded: false,
  fetchSettings: async () => {
    if (get().loaded) return;
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api";
      const res = await fetch(`${API_URL}/settings`, { cache: "no-store" });
      const data = await res.json();
      let bgImages: string[] = [];
      if (Array.isArray(data.backgroundImages)) {
        bgImages = data.backgroundImages;
      } else if (typeof data.backgroundImages === "string") {
        try {
          const parsed = JSON.parse(data.backgroundImages);
          if (Array.isArray(parsed)) bgImages = parsed.filter((u) => typeof u === "string");
        } catch {
          bgImages = [];
        }
      }
      const finalSiteName = data.siteName ?? DEFAULT_SITE_NAME;
      const finalFaviconUrl = data.faviconUrl ?? "";
      set({
        postCollapseLength: data.postCollapseLength ?? 150,
        darkModeEnabled: data.darkModeEnabled ?? false,
        darkModeStartTime: data.darkModeStartTime ?? "18:00",
        darkModeEndTime: data.darkModeEndTime ?? "06:00",
        siteName: finalSiteName,
        faviconUrl: finalFaviconUrl,
        domain: data.domain ?? "",
        beian: data.beian ?? "",
        beianUrl: data.beianUrl ?? "",
        backgroundImages: bgImages,
        adOnArchives: data.adOnArchives ?? false,
        defaultCover: data.defaultCover ?? "",
        musicAutoplay: data.musicAutoplay ?? false,
        cdnProxyUrl: data.cdnProxyUrl ?? "",
        loaded: true,
      });
      cacheDisplay(finalSiteName, finalFaviconUrl, data.cdnProxyUrl ?? cachedDisplay.cdnProxyUrl);
    } catch {
      set({ loaded: true });
    }
  },
  refreshSettings: async () => {
    set({ loaded: false });
    await get().fetchSettings();
  },
}));

/**
 * 返回一个绑定了当前 cdnProxyUrl 的图片 URL 转换函数。
 * 用法：const cdn = useCdnUrl(); <img src={cdn(url)} />
 * cdnProxyUrl 为空时等价于 toAbsoluteUrl + toHttps（用原图）。
 */
export function useCdnUrl(): (url: string) => string {
  const cdnProxyUrl = useSiteSettings((s) => s.cdnProxyUrl);
  return (url: string) => cdnUrl(url, cdnProxyUrl);
}

/**
 * 非 hook 版本的图片 URL 转换：同步读取 store 中的 cdnProxyUrl 并应用 CDN。
 * 适用于工具函数（如 normalizeImages）、事件处理等非 React 渲染上下文。
 * 组件渲染中优先使用 useCdnUrl() 以订阅 store 更新自动重渲染。
 */
export function getImageUrl(url: string): string {
  const cdnProxyUrl = useSiteSettings.getState().cdnProxyUrl;
  return cdnUrl(url, cdnProxyUrl);
}

