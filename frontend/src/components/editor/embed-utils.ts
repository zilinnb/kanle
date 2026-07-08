import { toAbsoluteUrl } from "@/lib/upload";
import type { LinkCard, PostMusic, PostVideo, PostDouban } from "@/lib/mock-data";

export interface ArticleEmbedData {
  id: string;
  shortId?: string;
  title: string;
  cover: string;
  excerpt: string;
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function encodePayload(obj: unknown): string {
  return btoa(encodeURIComponent(JSON.stringify(obj)));
}

export function decodePayload<T = unknown>(str: string): T | null {
  try {
    return JSON.parse(decodeURIComponent(atob(str))) as T;
  } catch {
    return null;
  }
}

export function buildLinkCardHtml(card: LinkCard): string {
  const url = escapeHtml(card.url);
  const title = escapeHtml(card.title || card.url);
  const desc = card.description ? escapeHtml(card.description) : "";
  const image = card.image ? escapeHtml(toAbsoluteUrl(card.image)) : "";
  let html = `<a href="${url}" target="_blank" rel="noopener noreferrer" class="link-card" contenteditable="false">`;
  if (image) {
    html += `<span class="link-card-image"><img src="${image}" alt="" /></span>`;
  }
  html += `<span class="link-card-body"><span class="link-card-title">${title}</span>`;
  if (desc) {
    html += `<span class="link-card-desc">${desc}</span>`;
  }
  html += `</span></a>`;
  return html;
}

export function buildMusicEmbedHtml(music: PostMusic): string {
  const payload = encodePayload(music);
  const cover = music.cover ? escapeHtml(toAbsoluteUrl(music.cover)) : "";
  const title = escapeHtml(music.name || "未知歌曲");
  const artist = escapeHtml(music.artist || "未知艺术家");
  return `<div data-embed="music" data-payload="${payload}" contenteditable="false" class="embed-block embed-music">` +
    `<span class="embed-cover">${cover ? `<img src="${cover}" alt="" />` : ""}</span>` +
    `<span class="embed-info"><span class="embed-title">${title}</span>` +
    `<span class="embed-subtitle">${artist}</span></span>` +
    `</div>`;
}

export function buildVideoEmbedHtml(video: PostVideo): string {
  const payload = encodePayload(video);
  const cover = video.cover ? escapeHtml(toAbsoluteUrl(video.cover)) : "";
  const title = escapeHtml(video.title || "视频");
  return `<div data-embed="video" data-payload="${payload}" contenteditable="false" class="embed-block embed-video">` +
    `<span class="embed-cover">${cover ? `<img src="${cover}" alt="" />` : ""}</span>` +
    `<span class="embed-info"><span class="embed-title">${title}</span></span>` +
    `</div>`;
}

export function buildDoubanEmbedHtml(item: PostDouban): string {
  const payload = encodePayload(item);
  const cover = item.cover ? escapeHtml(toAbsoluteUrl(item.cover)) : "";
  const title = escapeHtml(item.title || "豆瓣条目");
  const statusLabel = item.statusLabel ? escapeHtml(item.statusLabel) : "";
  return `<div data-embed="douban" data-payload="${payload}" contenteditable="false" class="embed-block embed-douban">` +
    `<span class="embed-cover">${cover ? `<img src="${cover}" alt="" />` : ""}</span>` +
    `<span class="embed-info"><span class="embed-title">${title}</span>` +
    (statusLabel ? `<span class="embed-subtitle">${statusLabel}</span>` : "") +
    `</span></div>`;
}

export function buildArticleEmbedHtml(article: ArticleEmbedData): string {
  const payload = encodePayload(article);
  const cover = article.cover ? escapeHtml(toAbsoluteUrl(article.cover)) : "";
  const title = escapeHtml(article.title || "文章");
  const excerpt = article.excerpt ? escapeHtml(article.excerpt) : "";
  return `<div data-embed="article" data-payload="${payload}" contenteditable="false" class="embed-block embed-article">` +
    `<span class="embed-cover">${cover ? `<img src="${cover}" alt="" />` : ""}</span>` +
    `<span class="embed-info"><span class="embed-title">${title}</span>` +
    (excerpt ? `<span class="embed-subtitle">${excerpt}</span>` : "") +
    `</span></div>`;
}
