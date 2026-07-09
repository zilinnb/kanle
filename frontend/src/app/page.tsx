import CoverHeader from "@/components/CoverHeader";
import DesktopDecorations from "@/components/DesktopDecorations";
import PostList from "@/components/PostList";
import TopBar from "@/components/TopBar";
import Sidebar from "@/components/Sidebar";
import ArticleListSidebar from "@/components/ArticleListSidebar";
import FloatingActions from "@/components/FloatingActions";
import Footer from "@/components/Footer";
import DesktopFooter from "@/components/DesktopFooter";
import AdminNotifications from "@/components/AdminNotifications";
import EditPostModal from "@/components/EditPostModal";
import ProfileScrollRestoration from "@/components/profile/ProfileScrollRestoration";
import { owner as fallbackOwner, User } from "@/lib/mock-data";
import { getApiUrl } from "@/lib/api-fetch";

const API_URL = getApiUrl();
const PAGE_SIZE = 10;

// ISR：10 秒重新验证（后端写操作后会触发按需重验证，10秒仅作安全网）
export const revalidate = 10;

async function getOwner(): Promise<User> {
  try {
    const res = await fetch(`${API_URL}/users/owner`, { next: { revalidate: 10 } });
    if (!res.ok) return fallbackOwner;
    return await res.json();
  } catch {
    return fallbackOwner;
  }
}

async function getPosts() {
  try {
    const res = await fetch(`${API_URL}/posts?page=1&limit=${PAGE_SIZE}`, { next: { revalidate: 10 } });
    if (!res.ok) return { data: [], hasMore: false };
    const json = await res.json();
    return { data: json.data || [], hasMore: json.pagination?.hasMore ?? false };
  } catch {
    return { data: [], hasMore: false };
  }
}

async function getSettings() {
  try {
    const res = await fetch(`${API_URL}/settings`, { next: { revalidate: 10 } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** 从网站设置中解析背景图轮播列表；为空则回退到用户封面 */
function getCoverList(settings: any, fallback: string): string[] {
  const raw = settings?.backgroundImages;
  if (!raw) return [fallback];
  try {
    const images = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (Array.isArray(images) && images.length > 0) {
      return images;
    }
  } catch {
    // ignore parse errors
  }
  return [fallback];
}

export default async function Home() {
  const [owner, postsData, settings] = await Promise.all([getOwner(), getPosts(), getSettings()]);
  const coverUrls = getCoverList(settings, owner.cover);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-wechat-white md:bg-wechat-bg">
      <DesktopDecorations />

      <div className="md:pt-6">
        <div
          id="scroll-root"
          className="md:fixed md:top-6 md:left-[calc(50%-300px)] md:z-10 md:h-[calc(100vh-48px)] md:w-[600px] md:overflow-y-auto md:rounded-2xl md:bg-wechat-white md:shadow-[0_8px_40px_-12px_rgba(0,0,0,0.12)] dark:md:shadow-[0_8px_40px_-12px_rgba(0,0,0,0.4)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <main className="relative w-full bg-wechat-white pb-8 md:pb-12">
            <TopBar coverHeight={300} />
            <CoverHeader user={owner} avatarHref="/archives" coverUrls={coverUrls} />

            <div className="md:hidden">
              <AdminNotifications />
            </div>

            <PostList
              initialPosts={postsData.data}
              initialHasMore={postsData.hasMore}
              initialPage={1}
            />
            <Footer />
          </main>
        </div>

        {/* Desktop right sidebar — fixed to the right of main so it stays
            in view as the body scrolls natively. */}
        <Sidebar owner={owner} />

        {/* Desktop left sidebar — article list with covers */}
        <ArticleListSidebar />
      </div>

      {/* Floating actions: theme toggle + back to top (bottom-right) */}
      <FloatingActions />

      {/* Desktop footer: copyright + beian (fixed bottom-left) */}
      <DesktopFooter />

      {/* Edit post modal (triggered from PostCard ActionMenu for logged-in admin) */}
      <EditPostModal />
      <ProfileScrollRestoration storageKey="home-scroll-y" waitForFadeIn={false} />
    </div>
  );
}
