import { create } from "zustand";

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
  loaded: boolean;
  fetchSettings: () => Promise<void>;
}

const DEFAULT_SITE_NAME = "朋友圈博客";

/** 从 localStorage 读取缓存的 siteName/faviconUrl，避免页面初次渲染时闪烁 */
function loadCachedDisplay(): { siteName: string; faviconUrl: string } {
  if (typeof window === "undefined") {
    return { siteName: DEFAULT_SITE_NAME, faviconUrl: "" };
  }
  try {
    const cached = localStorage.getItem("site_settings_display_cache");
    if (cached) {
      const parsed = JSON.parse(cached);
      return {
        siteName: parsed.siteName || DEFAULT_SITE_NAME,
        faviconUrl: parsed.faviconUrl || "",
      };
    }
  } catch {
    // ignore
  }
  return { siteName: DEFAULT_SITE_NAME, faviconUrl: "" };
}

/** 将 siteName/faviconUrl 缓存到 localStorage，供下次页面加载时使用 */
function cacheDisplay(siteName: string, faviconUrl: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      "site_settings_display_cache",
      JSON.stringify({ siteName, faviconUrl })
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
        loaded: true,
      });
      cacheDisplay(finalSiteName, finalFaviconUrl);
    } catch {
      set({ loaded: true });
    }
  },
}));
