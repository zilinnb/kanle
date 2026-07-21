import type { Metadata, Viewport } from "next";
import "./globals.css";
import ThemeProvider from "@/components/ThemeProvider";
import GlobalMusicManager from "@/components/GlobalMusicManager";
import MusicFloatingCard from "@/components/MusicFloatingCard";
import LoadingBar from "@/components/LoadingBar";
import EmojiFadeController from "@/components/EmojiFadeController";
import { getApiUrl } from "@/lib/api-fetch";

const API_URL = getApiUrl();

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export async function generateMetadata(): Promise<Metadata> {
  // Fetch site settings first; fall back to owner profile, then defaults.
  let siteName = "朋友圈博客";
  let description = "一个像微信朋友圈一样的个人博客";
  let keywords = "";
  let domain = "";
  let ogImage = "";
  let faviconUrl = "";

  try {
    const [settingsRes, ownerRes] = await Promise.all([
      fetch(`${API_URL}/settings`, { next: { revalidate: 60 } }),
      fetch(`${API_URL}/users/owner`, { next: { revalidate: 60 } }),
    ]);

    if (settingsRes.ok) {
      const settings = await settingsRes.json();
      if (settings.siteName) siteName = settings.siteName;
      if (settings.description) description = settings.description;
      if (settings.keywords) keywords = settings.keywords;
      if (settings.domain) domain = settings.domain;
      if (settings.ogImage) ogImage = settings.ogImage;
      if (settings.faviconUrl) faviconUrl = settings.faviconUrl;
    }

    if (ownerRes.ok) {
      const owner = await ownerRes.json();
      // If site settings are at defaults, use owner's nickname/bio as fallback
      if (siteName === "朋友圈博客" && owner.nickname) siteName = owner.nickname;
      if (description === "一个像微信朋友圈一样的个人博客" && owner.bio) {
        description = owner.bio;
      }
    }
  } catch {
    // use defaults
  }

  const metadata: Metadata = {
    title: siteName,
    description,
  };

  if (faviconUrl) {
    const faviconFullUrl = faviconUrl.startsWith("http")
      ? faviconUrl
      : `${domain || ""}${faviconUrl}`;
    metadata.icons = {
      icon: faviconFullUrl,
      shortcut: faviconFullUrl,
      apple: faviconFullUrl,
    };
  }

  if (keywords) {
    metadata.keywords = keywords.split(",").map((k) => k.trim()).filter(Boolean);
  }

  if (domain) {
    metadata.metadataBase = new URL(domain);
  }

  if (ogImage) {
    const ogImageUrl = ogImage.startsWith("http")
      ? ogImage
      : `${domain || ""}${ogImage}`;
    metadata.openGraph = {
      title: siteName,
      description,
      images: [{ url: ogImageUrl }],
    };
  }

  return metadata;
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // 获取站点设置中的自定义字体链接；留空则使用内嵌 HarmonyOS Sans 字体（globals.css 中的 @font-face）
  let fontUrl = "";
  let rssEnabled = true;
  try {
    const settingsRes = await fetch(`${API_URL}/settings`, { next: { revalidate: 60 } });
    if (settingsRes.ok) {
      const settings = await settingsRes.json();
      if (settings.fontUrl) fontUrl = settings.fontUrl;
      if (typeof settings.rssEnabled === "boolean") rssEnabled = settings.rssEnabled;
    }
  } catch {
    // use default embedded font
  }

  return (
    <html lang="zh-CN" className="h-full antialiased" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <link
          rel="preload"
          href="/fonts/HarmonyOS_Sans_Regular.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        {rssEnabled && (
          <link rel="alternate" type="application/rss+xml" title="RSS 订阅" href="/feed" />
        )}
        {fontUrl && (
          <link rel="stylesheet" href={fontUrl} />
        )}
      </head>
      <body className="min-h-full bg-white text-wechat-text dark:bg-wechat-bg">
        <div id="initial-loading-bar" />
        <script dangerouslySetInnerHTML={{ __html: `(function(){var r=sessionStorage.getItem('__chunkReload');if(r){try{var t=parseInt(r);if(Date.now()-t<60000){sessionStorage.removeItem('__chunkReload');return}}catch(e){}}window.addEventListener('error',function(e){var m=e&&e.message||'';var t=e&&e.target&&e.target.tagName;if((m.indexOf('ChunkLoadError')>=0||m.indexOf('Loading chunk')>=0||m.indexOf('Loading CSS chunk')>=0)&&(e.target&&(e.target.src||e.target.href))){sessionStorage.setItem('__chunkReload',Date.now().toString());window.location.reload()}});window.addEventListener('unhandledrejection',function(e){var m=e&&e.reason&&(e.reason.message||e.reason)||'';if(m.indexOf('ChunkLoadError')>=0||m.indexOf('Loading chunk')>=0){sessionStorage.setItem('__chunkReload',Date.now().toString());window.location.reload()}})})();` }} />
        <LoadingBar />
        <ThemeProvider>
          <GlobalMusicManager />
          <MusicFloatingCard />
          {children}
          <EmojiFadeController />
        </ThemeProvider>
      </body>
    </html>
  );
}
