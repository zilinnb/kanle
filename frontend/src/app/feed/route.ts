import { NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

function escapeXml(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function stripHtml(html: string): string {
  return html
    .replace(/<div\s+data-embed="[^"]*"[^>]*>[\s\S]*?<\/div>/gi, "")
    .replace(/<a\s+[^>]*class="[^"]*link-card[^"]*"[^>]*>[\s\S]*?<\/a>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** 截断文本，超长时加省略号 */
function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + "...";
}

/** 中文数量：1→一，2→两，其余用数字 */
function cnCount(n: number): string {
  if (n === 1) return "一";
  if (n === 2) return "两";
  return String(n);
}

/**
 * 智能生成标题：
 * 1. 有 title 用 title
 * 2. 有文字内容取前 50 字符（超长加省略号）
 * 3. 纯媒体动态按类型生成：分享了N张图片 / 分享了一个视频 / 分享了一首音乐 / 分享了一个链接
 */
function generateTitle(post: any): string {
  if (post.title) return post.title;

  const text = stripHtml(post.content || "");
  if (text) return truncate(text, 50);

  // 纯媒体动态（文章类型不适用自动标题）
  if (post.type === "article") return "无标题";

  const parts: string[] = [];

  // 图片
  const images = Array.isArray(post.images) ? post.images : [];
  if (images.length > 0) {
    parts.push(`分享了${cnCount(images.length)}张图片`);
  }

  // 视频
  if (post.video) {
    parts.push("分享了一个视频");
  }

  // 音乐
  if (post.music) {
    parts.push("分享了一首音乐");
  }

  // 链接卡片（文章不算）
  if (post.linkCard) {
    parts.push("分享了一个链接");
  }

  return parts.length > 0 ? parts.join("、") : "无标题";
}

/** 生成摘要：有文字取前 200 字符（超长加省略号），纯媒体用自动标题 */
function generateExcerpt(post: any): string {
  const fullText = stripHtml(post.content || "");
  if (post.excerpt) {
    // excerpt 可能已被截断（无省略号），若原文更长则补上
    if (fullText && fullText.length > post.excerpt.length) {
      return post.excerpt + "...";
    }
    return post.excerpt;
  }
  if (fullText) return truncate(fullText, 200);
  return generateTitle(post);
}

export async function GET() {
  try {
    // 先读站点设置：RSS 总开关关闭时直接返回 404，不再请求帖子列表
    const settingsRes = await fetch(`${API_URL}/settings`, { next: { revalidate: 60 } });

    let siteName = "朋友圈博客";
    let description = "一个像微信朋友圈一样的个人博客";
    let domain = "";
    let rssEnabled = true;
    let rssIncludeMoments = true;

    if (settingsRes.ok) {
      const settings = await settingsRes.json();
      if (settings.siteName) siteName = settings.siteName;
      if (settings.description) description = settings.description;
      if (settings.domain) domain = settings.domain;
      if (typeof settings.rssEnabled === "boolean") rssEnabled = settings.rssEnabled;
      if (typeof settings.rssIncludeMoments === "boolean") rssIncludeMoments = settings.rssIncludeMoments;
    }

    // RSS 总开关关闭：返回 404，避免订阅器持续重试
    if (!rssEnabled) {
      return new NextResponse("RSS feed is disabled", { status: 404 });
    }

    // 动态订阅关闭时只请求文章，避免拉取无用的 moment 数据
    const postsUrl = rssIncludeMoments
      ? `${API_URL}/posts?limit=50`
      : `${API_URL}/posts?type=article&limit=50`;
    const postsRes = await fetch(postsUrl, { next: { revalidate: 60 } });

    let items = "";
    if (postsRes.ok) {
      const data = await postsRes.json();
      const posts = data.data || [];
      items = posts
        .map((post: any) => {
          const title = generateTitle(post);
          const link = post.type === "article"
            ? `${domain}/articles/${post.shortId || post.id}`
            : `${domain}/moments/${post.shortId || post.id}`;
          const excerpt = generateExcerpt(post);
          const pubDate = new Date(post.createdAt).toUTCString();
          const guid = `${domain}/${post.id}`;
          const author = post.author?.nickname || siteName;

          // 构建完整内容：封面图 + 媒体 + 文字
          let content = "";
          if (post.cover) {
            const coverUrl = post.cover.startsWith("http") ? post.cover : `${domain}${post.cover}`;
            content += `<img src="${escapeXml(coverUrl)}" alt="${escapeXml(title)}" /><br/>`;
          }
          // 内联图片（兼容字符串 URL 和 Live Photo 对象 {src, video} 两种格式）
          const images = Array.isArray(post.images) ? post.images : [];
          for (const img of images) {
            const imgSrc = typeof img === "string" ? img : img?.src;
            if (!imgSrc) continue;
            const imgUrl = imgSrc.startsWith("http") ? imgSrc : `${domain}${imgSrc}`;
            content += `<img src="${escapeXml(imgUrl)}" /><br/>`;
          }
          // 文字内容（不截断，完整输出）
          const fullText = stripHtml(post.content || "");
          if (fullText) {
            content += escapeXml(fullText);
          } else {
            content += escapeXml(excerpt);
          }

          return `    <item>
      <title>${escapeXml(title)}</title>
      <link>${escapeXml(link)}</link>
      <description>${escapeXml(excerpt)}</description>
      <content:encoded><![CDATA[${content}]]></content:encoded>
      <author>${escapeXml(author)}</author>
      <pubDate>${pubDate}</pubDate>
      <guid>${escapeXml(guid)}</guid>
      <category>${post.type === "article" ? "文章" : "动态"}</category>
    </item>`;
        })
        .join("\n");
    }

    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(siteName)}</title>
    <link>${escapeXml(domain)}</link>
    <description>${escapeXml(description)}</description>
    <language>zh-CN</language>
    <generator>朋友圈博客</generator>
    <atom:link href="${escapeXml(domain)}/feed" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

    return new NextResponse(rss, {
      headers: {
        "Content-Type": "application/rss+xml; charset=utf-8",
        "Cache-Control": "s-maxage=60, stale-while-revalidate",
      },
    });
  } catch (err) {
    console.error("[feed] generation failed:", err);
    return new NextResponse("Feed generation failed", { status: 500 });
  }
}
