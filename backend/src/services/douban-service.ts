/**
 * 豆瓣数据抓取服务
 * 通过抓取豆瓣用户收藏页面获取电影/图书/音乐数据
 * 内存缓存 30 分钟，避免频繁请求被豆瓣封禁
 */
import axios from "axios";
import * as cheerio from "cheerio";

export interface DoubanItem {
  title: string;
  cover: string;
  link: string;
  rating: number;
  date: string;
  intro: string;
  comment: string;
}

export interface DoubanCollection {
  movies: DoubanItem[];
  books: DoubanItem[];
  music: DoubanItem[];
  syncedAt: string;
  doubanId: string;
}

interface CacheEntry {
  data: DoubanCollection;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 30 * 60 * 1000;

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
  Referer: "https://www.douban.com/",
};

type CollectionType = "movie" | "book" | "music";

async function scrapeCollection(
  type: CollectionType,
  doubanId: string
): Promise<DoubanItem[]> {
  const url = `https://${type}.douban.com/people/${doubanId}/collect`;
  const resp = await axios.get(url, {
    headers: HEADERS,
    timeout: 15000,
    maxRedirects: 3,
    validateStatus: () => true,
  });

  if (resp.status !== 200) return [];

  const $ = cheerio.load(resp.data);
  const items: DoubanItem[] = [];

  $(".item").each((_, el) => {
    const $el = $(el);
    const title = $el.find(".title a").text().trim();
    if (!title) return;

    const link =
      $el.find(".title a").attr("href") ||
      $el.find(".nbg").attr("href") ||
      "";
    const cover = $el.find("img").attr("src") || "";
    const date = $el.find(".date").text().trim();
    const intro = $el.find(".intro").text().trim();
    const comment = $el.find(".comment").text().trim();

    let rating = 0;
    const ratingEl = $el.find("[class*='rating']");
    const ratingClass = ratingEl.attr("class") || "";
    const match = ratingClass.match(/rating(\d)-t/);
    if (match) rating = parseInt(match[1], 10);

    items.push({ title, cover, link, rating, date, intro, comment });
  });

  return items;
}

export async function getDoubanData(
  doubanId: string,
  forceRefresh = false
): Promise<DoubanCollection> {
  if (!doubanId) {
    return {
      movies: [],
      books: [],
      music: [],
      syncedAt: "",
      doubanId: "",
    };
  }

  const cached = cache.get(doubanId);
  if (!forceRefresh && cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const [movies, books, music] = await Promise.allSettled([
    scrapeCollection("movie", doubanId),
    scrapeCollection("book", doubanId),
    scrapeCollection("music", doubanId),
  ]);

  const data: DoubanCollection = {
    movies: movies.status === "fulfilled" ? movies.value : [],
    books: books.status === "fulfilled" ? books.value : [],
    music: music.status === "fulfilled" ? music.value : [],
    syncedAt: new Date().toISOString(),
    doubanId,
  };

  cache.set(doubanId, { data, expiresAt: Date.now() + CACHE_TTL });
  return data;
}
