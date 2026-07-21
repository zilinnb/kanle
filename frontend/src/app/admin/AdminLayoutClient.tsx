"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard, FileText, BookText, User, LogOut, MessageCircle, PenLine, Settings2, BookUser, Music, Megaphone, PanelLeftClose, ChevronDown, Home, Images, Cloud, ShieldBan, Film, Menu, Rss } from "lucide-react";
import Image from "next/image";
import EditPostModal from "@/components/EditPostModal";
import ThemeToggleButton from "@/components/admin/ThemeToggleButton";
import AdminMusicPlayer from "@/components/admin/AdminMusicPlayer";
import { useExitAnimation } from "@/lib/use-exit-animation";
import { useSiteSettings } from "@/lib/site-settings-store";
import { useMusicPlayer } from "@/lib/music-player-store";
import { toAbsoluteUrl } from "@/lib/upload";

export default function AdminLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const mobileNav = useExitAnimation(() => setMobileNavOpen(false), 250);
  const siteName = useSiteSettings((s) => s.siteName);
  const faviconUrl = useSiteSettings((s) => s.faviconUrl);
  const fetchSettings = useSiteSettings((s) => s.fetchSettings);
  const activePostMusic = useMusicPlayer((s) => s.activePostMusic);
  const bgMusic = useMusicPlayer((s) => s.bgMusic);
  const hasMusic = !!(activePostMusic || bgMusic);

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    if (!token) {
      router.replace("/");
    }
    setLoading(false);
    if (token) fetchSettings();
  }, [router, fetchSettings]);

  // 侧栏收缩状态持久化
  useEffect(() => {
    const saved = localStorage.getItem("admin_sidebar_collapsed");
    if (saved === "true") setCollapsed(true);
    const savedGroups = localStorage.getItem("admin_sidebar_groups");
    if (savedGroups) {
      try { setCollapsedGroups(JSON.parse(savedGroups)); } catch { /* ignore */ }
    }
  }, []);
  useEffect(() => {
    localStorage.setItem("admin_sidebar_collapsed", String(collapsed));
  }, [collapsed]);
  useEffect(() => {
    localStorage.setItem("admin_sidebar_groups", JSON.stringify(collapsedGroups));
  }, [collapsedGroups]);

  const toggleGroup = (label: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  // 路由变化时关闭移动端抽屉
  useEffect(() => {
    if (mobileNavOpen) mobileNav.handleClose();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-adm-bg">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-adm-border border-t-adm-text" />
          <p className="text-sm text-adm-text-secondary">加载中...</p>
        </div>
      </div>
    );
  }

  // 分组导航：仪表盘独立 + 内容管理组 + 设置组
  const navGroups = [
    {
      label: null as string | null,
      items: [{ href: "/admin", label: "仪表盘", icon: LayoutDashboard }],
    },
    {
      label: "内容管理",
      items: [
        { href: "/admin/posts", label: "动态管理", icon: FileText },
        { href: "/admin/articles", label: "文章管理", icon: BookText },
        { href: "/admin/ads", label: "广告管理", icon: Megaphone },
        { href: "/admin/comments", label: "评论管理", icon: MessageCircle },
        { href: "/admin/blacklist", label: "黑名单", icon: ShieldBan },
        { href: "/admin/media", label: "媒体库", icon: Images },
        { href: "/admin/douban", label: "豆瓣书影", icon: Film },
      ],
    },
    {
      label: "设置",
      items: [
        { href: "/admin/users", label: "个人资料", icon: User },
        { href: "/admin/friends", label: "友情链接", icon: BookUser },
        { href: "/admin/rss", label: "友圈", icon: Rss },
        { href: "/admin/plugins", label: "音乐管理", icon: Music },
        { href: "/admin/storage", label: "云端存储", icon: Cloud },
        { href: "/admin/settings", label: "网站设置", icon: Settings2 },
      ],
    },
  ];
  // 扁平列表（移动端底部导航 + 页面标题检测用）
  const nav = navGroups.flatMap((g) => g.items);

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_nickname");
    localStorage.removeItem("admin_email");
    localStorage.removeItem("admin_avatar");
    localStorage.removeItem("admin_cover");
    localStorage.removeItem("admin_bio");
    localStorage.removeItem("admin_website");
    router.replace("/");
  };

  // 当前页面标题
  const currentNav = nav.find((n) => pathname === n.href || (n.href !== "/admin" && pathname.startsWith(n.href)));
  const currentPageTitle = currentNav?.label || "管理后台";

  return (
    <div className="min-h-screen bg-adm-bg">
      {/* Desktop sidebar — WordPress 风格：收缩时整列隐藏 */}
      <aside className={`fixed left-0 top-0 z-30 hidden h-screen flex-col bg-adm-card transition-all duration-300 md:flex ${collapsed ? "w-0 overflow-hidden" : "w-60 border-r border-adm-border"}`}>
        <div className="flex h-full w-60 flex-col">
        <div className="flex items-center gap-2.5 px-5 py-4">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl ${faviconUrl ? "border border-adm-border bg-adm-card" : "bg-adm-primary shadow-lg"}`}>
            {faviconUrl ? (
              <Image
                src={toAbsoluteUrl(faviconUrl)}
                alt={siteName}
                width={20}
                height={20}
                className="h-5 w-5 object-contain"
                unoptimized
              />
            ) : (
              <PenLine className="h-5 w-5 text-adm-primary-text" />
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-adm-text">{siteName}</p>
            <p className="text-xs text-adm-text-tertiary">管理后台</p>
          </div>
        </div>

        <nav className="mt-1 flex-1 overflow-y-auto px-3">
          {navGroups.map((group, gi) => {
            const isGroupCollapsed = group.label ? !!collapsedGroups[group.label] : false;
            const showItems = !group.label || !isGroupCollapsed;
            return (
              <div key={gi} className={gi > 0 ? "mt-3" : ""}>
                {group.label && (
                  <button
                    onClick={() => toggleGroup(group.label!)}
                    className="mb-1 flex w-full items-center gap-2 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-adm-text-tertiary transition-colors hover:text-adm-text-secondary"
                  >
                    <ChevronDown className={`h-3 w-3 shrink-0 transition-transform duration-200 ${isGroupCollapsed ? "-rotate-90" : ""}`} />
                    {group.label}
                  </button>
                )}
                {showItems && (
                  <div className="space-y-1">
                    {group.items.map((item) => {
                      const active = pathname === item.href;
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all ${
                            active
                              ? "bg-adm-primary font-medium text-adm-primary-text"
                              : "text-adm-text-secondary hover:bg-adm-card-hover hover:text-adm-text"
                          }`}
                        >
                          <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? "text-adm-primary-text" : "text-adm-text-tertiary"}`} />
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
        </div>
      </aside>

      {/* Desktop top bar */}
      <header className={`sticky top-0 z-20 hidden h-14 items-center justify-between border-b border-adm-border bg-adm-card/80 px-6 backdrop-blur-xl transition-all duration-300 md:flex ${collapsed ? "md:ml-0" : "md:ml-60"}`}>
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-adm-text-secondary transition-colors hover:bg-adm-card-hover hover:text-adm-text"
            aria-label={collapsed ? "展开侧栏" : "收起侧栏"}
            title={collapsed ? "展开侧栏" : "收起侧栏"}
          >
            <PanelLeftClose className={`h-5 w-5 transition-transform duration-300 ${collapsed ? "rotate-180" : ""}`} />
          </button>
          <h1 className="shrink-0 text-sm font-semibold text-adm-text">{currentPageTitle}</h1>
          {hasMusic && (
            <div className="ml-2 flex min-w-0 items-center gap-2 rounded-lg bg-adm-input/60 px-2.5 py-1">
              <AdminMusicPlayer />
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/"
            target="_blank"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-adm-text-secondary transition-colors hover:bg-adm-card-hover hover:text-adm-text"
            title="前往首页"
          >
            <Home className="h-5 w-5" />
          </Link>
          <ThemeToggleButton />
          <button
            onClick={handleLogout}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-adm-danger transition-colors hover:bg-adm-danger-bg"
            title="退出登录"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Mobile header */}
      <header className="sticky top-0 z-30 border-b border-adm-border bg-adm-card/90 backdrop-blur-xl md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <button
              onClick={() => setMobileNavOpen(true)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-adm-text-secondary transition-colors hover:bg-adm-card-hover hover:text-adm-text"
              aria-label="打开菜单"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg ${faviconUrl ? "border border-adm-border bg-adm-card" : "bg-adm-primary"}`}>
              {faviconUrl ? (
                <Image
                  src={toAbsoluteUrl(faviconUrl)}
                  alt={siteName}
                  width={16}
                  height={16}
                  className="h-4 w-4 object-contain"
                  unoptimized
                />
              ) : (
                <PenLine className="h-4 w-4 text-adm-primary-text" />
              )}
            </div>
            {hasMusic ? (
              <AdminMusicPlayer />
            ) : (
              <span className="truncate text-sm font-semibold text-adm-text">{currentPageTitle}</span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Link
              href="/"
              target="_blank"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-adm-text-secondary transition-colors hover:bg-adm-card-hover"
              title="前往首页"
            >
              <Home className="h-4 w-4" />
            </Link>
            <ThemeToggleButton />
            <button
              onClick={handleLogout}
              className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm text-adm-danger hover:bg-adm-danger-bg"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile slide-out drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className={`absolute inset-0 bg-black/50 ${mobileNav.closing ? "animate-overlay-out" : "animate-overlay-in"}`}
            onClick={mobileNav.handleClose}
          />
          <aside
            className={`absolute left-0 top-0 flex h-full w-72 flex-col bg-adm-card shadow-2xl ${
              mobileNav.closing ? "animate-slide-out-left" : "animate-slide-in-left"
            }`}
          >
            <div className="flex items-center gap-2.5 border-b border-adm-border px-5 py-4">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl ${faviconUrl ? "border border-adm-border bg-adm-card" : "bg-adm-primary shadow-lg"}`}>
                {faviconUrl ? (
                  <Image
                    src={toAbsoluteUrl(faviconUrl)}
                    alt={siteName}
                    width={20}
                    height={20}
                    className="h-5 w-5 object-contain"
                    unoptimized
                  />
                ) : (
                  <PenLine className="h-5 w-5 text-adm-primary-text" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-adm-text">{siteName}</p>
                <p className="text-xs text-adm-text-tertiary">管理后台</p>
              </div>
              <button
                onClick={mobileNav.handleClose}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-adm-text-tertiary transition-colors hover:bg-adm-card-hover hover:text-adm-text"
                aria-label="关闭菜单"
              >
                <PanelLeftClose className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 py-2">
              {navGroups.map((group, gi) => {
                const isGroupCollapsed = group.label ? !!collapsedGroups[group.label] : false;
                const showItems = !group.label || !isGroupCollapsed;
                return (
                  <div key={gi} className={gi > 0 ? "mt-3" : ""}>
                    {group.label && (
                      <button
                        onClick={() => toggleGroup(group.label!)}
                        className="mb-1 flex w-full items-center gap-2 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-adm-text-tertiary transition-colors hover:text-adm-text-secondary"
                      >
                        <ChevronDown className={`h-3 w-3 shrink-0 transition-transform duration-200 ${isGroupCollapsed ? "-rotate-90" : ""}`} />
                        {group.label}
                      </button>
                    )}
                    {showItems && (
                      <div className="space-y-1">
                        {group.items.map((item) => {
                          const active = pathname === item.href;
                          const Icon = item.icon;
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all ${
                                active
                                  ? "bg-adm-primary font-medium text-adm-primary-text"
                                  : "text-adm-text-secondary hover:bg-adm-card-hover hover:text-adm-text"
                              }`}
                            >
                              <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? "text-adm-primary-text" : "text-adm-text-tertiary"}`} />
                              {item.label}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main content — 边距随侧栏状态变化 */}
      <main className={`px-4 py-4 pb-6 transition-all duration-300 md:py-5 md:pb-6 md:px-6 ${collapsed ? "md:ml-0" : "md:ml-60"}`}>
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>

      {/* Edit post modal (triggered from PostCard ActionMenu for admin) */}
      <EditPostModal />
    </div>
  );
}
