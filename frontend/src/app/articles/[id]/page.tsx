import { notFound } from "next/navigation";
import { Metadata } from "next";
import ProfileTopBar from "@/components/profile/ProfileTopBar";
import DesktopDecorations from "@/components/DesktopDecorations";
import Sidebar from "@/components/Sidebar";
import ArticleTOC from "@/components/ArticleTOC";
import FloatingActions from "@/components/FloatingActions";
import Footer from "@/components/Footer";
import DesktopFooter from "@/components/DesktopFooter";
import EditPostModal from "@/components/EditPostModal";
import ArticleReader from "@/components/article/ArticleReader";
import ProfileFadeIn from "@/components/profile/ProfileFadeIn";
import { owner as fallbackOwner, User, Post } from "@/lib/mock-data";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

export const revalidate = 10;

async function getPost(id: string): Promise<Post | null> {
  try {
    const res = await fetch(`${API_URL}/posts/${id}`, {
      next: { revalidate: 10 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const post = await getPost(id);
  if (!post) return { title: "文章详情" };
  return { title: post.title || "文章详情" };
}

export default async function ArticleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [post, owner] = await Promise.all([getPost(id), getOwner()]);
  if (!post) notFound();

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-wechat-white md:bg-wechat-bg">
      <DesktopDecorations />

      <div className="md:pt-6">
        <div
          id="scroll-root"
          className="md:fixed md:top-6 md:left-[calc(50%-300px)] md:z-10 md:h-[calc(100vh-24px)] md:w-[600px] md:overflow-y-auto md:overflow-x-hidden md:rounded-2xl md:bg-wechat-white md:shadow-[0_8px_40px_-12px_rgba(0,0,0,0.12)] dark:md:shadow-[0_8px_40px_-12px_rgba(0,0,0,0.4)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <ProfileTopBar surfaceColor="white" initialBgAlpha={1} />

          <main className="relative flex min-h-[calc(100vh-3rem)] w-full flex-col bg-wechat-white pb-8 pt-12 md:min-h-[calc(100vh-4rem)] md:pb-12">
            <ProfileFadeIn>
              <div className="flex-1">
                <ArticleReader post={post} />
              </div>
              <Footer />
            </ProfileFadeIn>
          </main>
        </div>

        {/* 桌面端右侧边栏 — 与首页/archives 一致，固定显示 */}
        <Sidebar owner={owner} />

        {/* 桌面端左侧章节目录 */}
        <ArticleTOC />
      </div>

      <FloatingActions liftAboveBottomBar />
      <DesktopFooter />
      <EditPostModal />
    </div>
  );
}
