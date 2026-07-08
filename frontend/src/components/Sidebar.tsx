"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { BookUser, Camera, ExternalLink, Eye, EyeOff, LayoutDashboard, Link2, Lock, LogOut, MoreVertical, UserRound } from "lucide-react";
import { User as UserType } from "@/lib/mock-data";
import { cravatarUrl } from "@/lib/avatar";
import { toAbsoluteUrl } from "@/lib/upload";
import { PublishModal, type LoggedInUser } from "@/components/TopBar";
import { SocialIcon, getSocialPlatform } from "@/components/SocialIcons";
import AdminNotifications from "@/components/AdminNotifications";

interface FriendLink {
  id: string;
  name: string;
  url: string;
  desc: string;
  email: string;
  avatar: string;
}

/** 解析友链头像：avatar 优先（邮箱→Cravatar，链接/上传→原值），为空回退 email */
function resolveFriendAvatar(link: { avatar?: string; email?: string }, size = 96): string {
  const avatar = (link.avatar || "").trim();
  if (avatar) {
    if (!avatar.startsWith("http") && avatar.includes("@")) {
      return cravatarUrl(avatar, size);
    }
    return toAbsoluteUrl(avatar);
  }
  const email = (link.email || "").trim();
  if (email) return cravatarUrl(email, size);
  return "";
}

interface SiteSettings {
  siteName: string;
  description: string;
  domain: string;
  faviconUrl: string;
  socialLinks: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

interface SidebarProps {
  owner: UserType;
}

export default function Sidebar({ owner }: SidebarProps) {
  const [friendLinks, setFriendLinks] = useState<FriendLink[]>([]);
  const [friendsLoaded, setFriendsLoaded] = useState(false);
  const [friendsPage, setFriendsPage] = useState(1);
  const [friendsHasMore, setFriendsHasMore] = useState(false);
  const [friendsLoadingMore, setFriendsLoadingMore] = useState(false);
  const friendsSentinelRef = useRef<HTMLDivElement>(null);
  const friendsLoadingRef = useRef(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [loggedIn, setLoggedIn] = useState<LoggedInUser | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [showPublish, setShowPublish] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const sidebarScrollRef = useRef<HTMLDivElement>(null);

  // 桌面端：侧边栏跟随主内容区同步滚动（1:1，丝滑体验）
  useEffect(() => {
    const checkDesktop = () => setIsDesktop(window.innerWidth >= 1024);
    checkDesktop();
    window.addEventListener("resize", checkDesktop);
    return () => window.removeEventListener("resize", checkDesktop);
  }, []);

  useEffect(() => {
    if (!isDesktop) return;
    const scrollRoot = document.getElementById("scroll-root");
    const sidebar = sidebarScrollRef.current;
    if (!scrollRoot || !sidebar) return;

    let rafId: number | null = null;
    const sync = () => {
      rafId = null;
      sidebar.scrollTop = scrollRoot.scrollTop;
    };
    const onScroll = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(sync);
    };

    scrollRoot.addEventListener("scroll", onScroll, { passive: true });
    sync();
    return () => {
      scrollRoot.removeEventListener("scroll", onScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [isDesktop]);

  // Inline login form state
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  // 三点菜单（后台管理 / 退出登录）
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  // Site info from backend /api/settings
  const [siteSettings, setSiteSettings] = useState<SiteSettings | null>(null);

  // 点击菜单外部关闭三点菜单
  useEffect(() => {
    if (!showUserMenu) return;
    const onClickAway = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener("mousedown", onClickAway);
    return () => document.removeEventListener("mousedown", onClickAway);
  }, [showUserMenu]);

  useEffect(() => {
    fetch(`${API_URL}/friends`)
      .then((res) => (res.ok ? res.json() : { data: [], pagination: { hasMore: false } }))
      .then((data: { data: FriendLink[]; pagination?: { hasMore: boolean } }) => {
        setFriendLinks(data.data || []);
        setFriendsHasMore(false);
      })
      .catch(() => {})
      .finally(() => setFriendsLoaded(true));
  }, []);

  const loadMoreFriends = useCallback(async () => {
    if (friendsLoadingRef.current || !friendsHasMore) return;
    friendsLoadingRef.current = true;
    setFriendsLoadingMore(true);
    const nextPage = friendsPage + 1;
    try {
      const res = await fetch(`${API_URL}/friends?page=${nextPage}&limit=10`);
      const data = await res.json();
      if (Array.isArray(data.data)) {
        setFriendLinks((prev) => [...prev, ...data.data]);
        setFriendsHasMore(data.pagination?.hasMore || false);
        setFriendsPage(nextPage);
      }
    } catch {
      // ignore
    } finally {
      setFriendsLoadingMore(false);
      friendsLoadingRef.current = false;
    }
  }, [friendsPage, friendsHasMore]);

  // IntersectionObserver：友链滚动到底部自动加载更多
  useEffect(() => {
    if (!friendsSentinelRef.current) return;
    const sentinel = friendsSentinelRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMoreFriends();
      },
      { rootMargin: "50px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMoreFriends]);

  useEffect(() => {
    fetch(`${API_URL}/settings`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: SiteSettings | null) => {
        if (data) setSiteSettings(data);
      })
      .catch(() => {})
      .finally(() => setSettingsLoaded(true));
  }, []);

  // Restore login from localStorage
  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    const nickname = localStorage.getItem("admin_nickname");
    const email = localStorage.getItem("admin_email") || "";
    const avatar = localStorage.getItem("admin_avatar") || "";
    const cover = localStorage.getItem("admin_cover") || "";
    const bio = localStorage.getItem("admin_bio") || "";
    const website = localStorage.getItem("admin_website") || "";
    if (token && nickname) {
      setLoggedIn({ token, nickname, email, avatar, cover, bio, website });
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_nickname");
    localStorage.removeItem("admin_email");
    localStorage.removeItem("admin_avatar");
    localStorage.removeItem("admin_cover");
    localStorage.removeItem("admin_bio");
    localStorage.removeItem("admin_website");
    setLoggedIn(null);
    window.location.reload();
  };

  const handleLogin = async () => {
    if (!account.trim() || !password.trim()) {
      setLoginError("请输入用户名和密码");
      return;
    }
    setLoginLoading(true);
    setLoginError("");
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.message || "登录失败");
        return;
      }
      localStorage.setItem("admin_token", data.token);
      localStorage.setItem("admin_nickname", data.user.nickname);
      localStorage.setItem("admin_email", data.user.email);
      localStorage.setItem("admin_avatar", data.user.avatar || "");
      localStorage.setItem("admin_cover", data.user.cover || "");
      localStorage.setItem("admin_bio", data.user.bio || "");
      localStorage.setItem("admin_website", data.user.website || "");
      setLoggedIn({
        token: data.token,
        nickname: data.user.nickname,
        email: data.user.email,
        avatar: data.user.avatar || "",
        cover: data.user.cover || "",
        bio: data.user.bio || "",
        website: data.user.website || "",
      });
      setShowLogin(false);
      setAccount("");
      setPassword("");
      setLoginError("");
      // 同步历史点赞记录的昵称为当前登录昵称，并刷新页面以获取最新数据
      if (data.user.email && data.user.nickname) {
        fetch(`${API_URL}/posts/likes/update-name`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ email: data.user.email, newName: data.user.nickname }),
        }).finally(() => window.location.reload());
      } else {
        window.location.reload();
      }
    } catch {
      setLoginError("网络错误，请稍后重试");
    } finally {
      setLoginLoading(false);
    }
  };

  // Parse social links from JSON
  let socialLinks: Array<{ type: string; url: string }> = [];
  try {
    const parsed = JSON.parse(siteSettings?.socialLinks || "[]");
    if (Array.isArray(parsed)) {
      socialLinks = parsed.filter((l: { type: string; url: string }) => l.type);
    }
  } catch {
    socialLinks = [];
  }

  return (
    <aside data-sidebar className="hidden lg:block lg:fixed lg:top-6 lg:left-[calc(50%+324px)] lg:w-[220px] xl:w-[260px]">
      <div ref={sidebarScrollRef} className="no-scrollbar space-y-4 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto lg:overscroll-contain">
        {/* Owner info card */}
        <div className="rounded-2xl bg-wechat-white p-4 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_40px_-12px_rgba(0,0,0,0.4)]">
          {/* Social links */}
          {!settingsLoaded ? (
            <div className="flex flex-wrap justify-center gap-2.5">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-9 w-9 animate-pulse rounded-xl bg-wechat-bubble dark:bg-white/5" />
              ))}
            </div>
          ) : socialLinks.length > 0 ? (
            <div className="flex flex-wrap justify-center gap-2.5">
              {socialLinks.map((link, idx) => {
                const platform = getSocialPlatform(link.type);
                const hasUrl = !!link.url;
                const href = !hasUrl
                  ? undefined
                  : link.type === "email"
                    ? `mailto:${link.url}`
                    : link.url;
                return (
                  <a
                    key={idx}
                    href={href}
                    target={hasUrl ? "_blank" : undefined}
                    rel="noopener noreferrer"
                    title={platform?.label || link.type}
                    className={`social-icon-link flex h-9 w-9 items-center justify-center rounded-xl bg-wechat-bubble transition-all ${
                      hasUrl
                        ? "hover:scale-110 hover:bg-wechat-hover dark:bg-white/5 dark:hover:bg-white/10 cursor-pointer"
                        : "opacity-60 cursor-default dark:bg-white/5"
                    }`}
                    style={{
                      "--social-color": platform?.color || "#576b95",
                      "--social-color-dark": platform?.darkColor || platform?.color || "#576b95",
                    } as CSSProperties}
                  >
                    <SocialIcon type={link.type} className="h-[18px] w-[18px]" />
                  </a>
                );
              })}
            </div>
          ) : null}

          {/* Auth buttons: login / publish / logout */}
          <div className={socialLinks.length > 0 ? "mt-3 border-t border-black/5 pt-3 dark:border-white/5" : ""}>
            {loggedIn ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPublish(true)}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-wechat-nickname/10 px-3 py-2 text-xs font-medium text-wechat-nickname transition-colors hover:bg-wechat-nickname/20"
                >
                  <Camera className="h-3.5 w-3.5" />
                  发表动态
                </button>
                {/* 三点菜单：后台管理 + 退出登录 */}
                <div ref={userMenuRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setShowUserMenu((v) => !v)}
                    className="flex items-center justify-center rounded-lg bg-wechat-hover px-3 py-2 text-wechat-time transition-colors hover:bg-gray-300 dark:bg-white/5 dark:hover:bg-white/10"
                    title="更多"
                    aria-label="更多操作"
                  >
                    <MoreVertical className="h-3.5 w-3.5" />
                  </button>
                  {showUserMenu && (
                    <div className="animate-dropdown-in absolute right-0 top-full z-50 mt-1.5 w-36 overflow-hidden rounded-xl border border-wechat-border bg-wechat-white shadow-xl dark:border-white/10 dark:bg-[#2c2c30]">
                      <Link
                        href="/admin"
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setShowUserMenu(false)}
                        className="flex items-center gap-2 px-3.5 py-2.5 text-xs text-wechat-text transition-colors hover:bg-wechat-hover dark:hover:bg-white/10"
                      >
                        <LayoutDashboard className="h-3.5 w-3.5" />
                        后台管理
                      </Link>
                      <div className="h-px bg-wechat-border dark:bg-white/10" />
                      <button
                        type="button"
                        onClick={() => {
                          setShowUserMenu(false);
                          handleLogout();
                        }}
                        className="flex w-full items-center gap-2 px-3.5 py-2.5 text-xs text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-500/10"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        退出登录
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : showLogin ? (
              <div className="space-y-2.5">
                <div className="relative">
                  <UserRound className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-wechat-time" />
                  <input
                    type="text"
                    value={account}
                    onChange={(e) => setAccount(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                    placeholder="用户名或邮箱"
                    className="w-full rounded-lg border border-wechat-border bg-wechat-bubble py-2 pl-8 pr-3 text-[13px] text-wechat-text transition-colors placeholder:text-wechat-time focus:border-wechat-nickname focus:bg-wechat-white focus:outline-none"
                  />
                </div>
                <div className="relative">
                  <Lock className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-wechat-time" />
                  <input
                    type={showPwd ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                    placeholder="密码"
                    className="w-full rounded-lg border border-wechat-border bg-wechat-bubble py-2 pl-8 pr-8 text-[13px] text-wechat-text transition-colors placeholder:text-wechat-time focus:border-wechat-nickname focus:bg-wechat-white focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((p) => !p)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-wechat-time hover:text-wechat-text"
                  >
                    {showPwd ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
                {loginError && <p className="text-xs text-red-500">{loginError}</p>}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleLogin}
                    disabled={loginLoading}
                    className="flex-1 rounded-lg bg-black py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-85 disabled:opacity-50 dark:bg-white dark:text-black"
                  >
                    {loginLoading ? "登录中..." : "登录"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowLogin(false);
                      setLoginError("");
                      setAccount("");
                      setPassword("");
                    }}
                    className="rounded-lg bg-wechat-hover px-3 py-2 text-[13px] font-medium text-wechat-time transition-colors hover:bg-gray-300 dark:bg-white/10 dark:hover:bg-white/20"
                  >
                    取消
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowLogin(true)}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-wechat-nickname/10 px-3 py-2 text-xs font-medium text-wechat-nickname transition-colors hover:bg-wechat-nickname/20"
              >
                <UserRound className="h-3.5 w-3.5" />
                登录
              </button>
            )}
          </div>
        </div>

        {/* Notifications card — 仅登录博主可见 */}
        {loggedIn && <AdminNotifications variant="sidebar" />}

        {/* Friend links card */}
        <div className="rounded-2xl bg-wechat-white p-4 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_40px_-12px_rgba(0,0,0,0.4)]">
          <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-wechat-text">
            <BookUser className="h-4 w-4 text-wechat-nickname" />
            友情链接
          </h3>
          {!friendsLoaded ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center gap-2.5 px-2 py-1.5">
                  <div className="h-7 w-7 shrink-0 animate-pulse rounded-[5px] bg-wechat-bubble dark:bg-white/5" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-1/2 animate-pulse rounded bg-wechat-bubble dark:bg-white/5" />
                    <div className="h-2.5 w-3/4 animate-pulse rounded bg-wechat-bubble dark:bg-white/5" />
                  </div>
                </div>
              ))}
            </div>
          ) : friendLinks.length === 0 ? (
            <div className="flex flex-col items-center py-4 text-wechat-time">
              <Link2 className="mb-1 h-5 w-5" />
              <p className="text-xs">暂无友情链接</p>
            </div>
          ) : (
            <ul className="space-y-1">
              {friendLinks.map((link) => (
                <li key={link.id}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-wechat-hover"
                  >
                    <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-[5px] bg-wechat-bubble">
                      {resolveFriendAvatar(link, 56) ? (
                        <Image
                          src={resolveFriendAvatar(link, 56)}
                          alt={link.name}
                          fill
                          className="object-cover"
                          sizes="28px"
                          unoptimized
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <BookUser className="h-3.5 w-3.5 text-wechat-time" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-wechat-nickname">
                        {link.name}
                      </p>
                      {link.desc && (
                        <p className="truncate text-xs text-wechat-time">
                          {link.desc}
                        </p>
                      )}
                    </div>
                    <ExternalLink className="ml-1 h-3 w-3 shrink-0 text-wechat-time transition-colors group-hover:text-wechat-text" />
                  </a>
                </li>
              ))}
              {friendsLoadingMore &&
                [...Array(2)].map((_, i) => (
                  <li key={`fsk-${i}`} className="flex items-center gap-2.5 px-2 py-1.5">
                    <div className="h-7 w-7 shrink-0 animate-pulse rounded-[5px] bg-wechat-bubble dark:bg-white/5" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-1/2 animate-pulse rounded bg-wechat-bubble dark:bg-white/5" />
                      <div className="h-2.5 w-3/4 animate-pulse rounded bg-wechat-bubble dark:bg-white/5" />
                    </div>
                  </li>
                ))}
              <div ref={friendsSentinelRef} className="h-1" />
            </ul>
          )}
        </div>
      </div>

      {/* Publish Modal */}
      {showPublish && loggedIn && (
        <PublishModal
          token={loggedIn.token}
          onClose={() => setShowPublish(false)}
          onPublished={() => {
            setShowPublish(false);
            window.dispatchEvent(new CustomEvent("post-published"));
          }}
        />
      )}
    </aside>
  );
}
