import type { Metadata } from "next";
import CoverHeader from "@/components/CoverHeader";
import DesktopDecorations from "@/components/DesktopDecorations";
import ProfileTopBar from "@/components/profile/ProfileTopBar";
import Sidebar from "@/components/Sidebar";
import FloatingActions from "@/components/FloatingActions";
import Footer from "@/components/Footer";
import DesktopFooter from "@/components/DesktopFooter";
import EditPostModal from "@/components/EditPostModal";
import ProfileTimeline from "@/components/profile/ProfileTimeline";
import ProfileFadeIn from "@/components/profile/ProfileFadeIn";
import ProfileScrollRestoration from "@/components/profile/ProfileScrollRestoration";
import { owner as fallbackOwner, User } from "@/lib/mock-data";
import { getApiUrl } from "@/lib/api-fetch";

const API_URL = getApiUrl();
const PAGE_SIZE = 10;

export const revalidate = 10;

export async function generateMetadata(): Promise<Metadata> {
  try {
    const res = await fetch(`${API_URL}/users/owner`, { next: { revalidate: 10 } });
    const owner: User = res.ok ? await res.json() : fallbackOwner;
    return {
      title: `${owner.nickname} 的归档`,
    };
  } catch {
    return {
      title: "归档",
    };
  }
}

async function getOwner(): Promise<User> {
  try {
    const res = await fetch(`${API_URL}/users/owner`, { next: { revalidate: 10 } });
    if (!res.ok) return fallbackOwner;
    return await res.json();
  } catch {
    return fallbackOwner;
  }
}

async function getOwnerPosts(ownerId: string) {
  try {
    const res = await fetch(
      `${API_URL}/posts?userId=${ownerId}&page=1&limit=${PAGE_SIZE}`,
      { next: { revalidate: 10 } }
    );
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

export default async function ProfilePage() {
  const owner = await getOwner();
  const [postsData, settings] = await Promise.all([
    getOwnerPosts(owner.id),
    getSettings(),
  ]);
  const coverUrls = getCoverList(settings, owner.cover);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-wechat-white md:bg-wechat-bg">
      <DesktopDecorations />

      <div className="md:pt-6">
        <div
          id="scroll-root"
          className="md:fixed md:top-6 md:left-[calc(50%-300px)] md:z-10 md:h-[calc(100vh-48px)] md:w-[600px] md:overflow-y-auto md:rounded-2xl md:bg-wechat-white md:shadow-[0_8px_40px_-12px_rgba(0,0,0,0.12)] dark:md:shadow-[0_8px_40px_-12px_rgba(0,0,0,0.4)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <ProfileTopBar coverHeight={300} />
          <main className="relative w-full bg-wechat-white pb-8 md:pb-12">
            <ProfileFadeIn>
              <CoverHeader user={owner} coverUrls={coverUrls} />

              <ProfileTimeline
                initialPosts={postsData.data}
                initialHasMore={postsData.hasMore}
                initialPage={1}
                ownerId={owner.id}
              />
              <Footer />
            </ProfileFadeIn>
          </main>
        </div>

        <Sidebar owner={owner} />
      </div>

      <FloatingActions />
      <DesktopFooter />
      <EditPostModal />
      <ProfileScrollRestoration storageKey="archives-scroll-y" waitForFadeIn={false} />
    </div>
  );
}
