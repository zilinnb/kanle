import { notFound } from "next/navigation";
import { Metadata } from "next";
import ProfileTopBar from "@/components/profile/ProfileTopBar";
import DesktopDecorations from "@/components/DesktopDecorations";
import Sidebar from "@/components/Sidebar";
import FloatingActions from "@/components/FloatingActions";
import Footer from "@/components/Footer";
import DesktopFooter from "@/components/DesktopFooter";
import EditPostModal from "@/components/EditPostModal";
import PostDetail from "@/components/post-detail/PostDetail";
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

/** 根据动态内容生成浏览器标签标题 */
function getPostTitle(post: Post): string {
  // 音频：显示歌曲名
  if (post.music) {
    return post.music.name || "音乐动态";
  }
  // 网站：显示网站名
  if (post.linkCard) {
    return post.linkCard.siteName || post.linkCard.title || "分享的网站";
  }
  // 视频：显示视频标题
  if (post.video) {
    return post.video.title || "视频动态";
  }
  // 单纯图片（无文字）：显示"图片"
  if (post.images && post.images.length > 0 && !post.content) {
    return "图片";
  }
  // 文本：显示文本内容（去 HTML 标签后截断）
  if (post.content) {
    const text = post.content
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
    return text.length > 30 ? text.slice(0, 30) + "…" : text || "动态详情";
  }
  return "动态详情";
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const post = await getPost(id);
  if (!post) return { title: "动态详情" };
  return { title: getPostTitle(post) };
}

export default async function PostDetailPage({
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
          className="md:fixed md:top-6 md:left-[calc(50%-300px)] md:z-10 md:h-[calc(100vh-48px)] md:w-[600px] md:overflow-y-auto md:overflow-x-hidden md:rounded-2xl md:bg-wechat-white md:shadow-[0_8px_40px_-12px_rgba(0,0,0,0.12)] dark:md:shadow-[0_8px_40px_-12px_rgba(0,0,0,0.4)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {/* TopBar — 详情页无 CoverHeader，始终不透明 */}
          <ProfileTopBar initialBgAlpha={1} />

          <main className="relative flex min-h-[calc(100vh-3rem)] w-full flex-col bg-wechat-white pb-8 pt-12 md:min-h-[calc(100vh-4rem)] md:pb-12">
            {/* 入场动画：与 profile 一致的淡入淡出 */}
            <ProfileFadeIn>
              <div className="flex-1">
                <PostDetail post={post} />
              </div>
              <Footer />
            </ProfileFadeIn>
          </main>
        </div>

        {/* 桌面端右侧边栏 — 与首页/archives 一致，固定显示 */}
        <Sidebar owner={owner} />
      </div>

      <FloatingActions />
      <DesktopFooter />
      <EditPostModal />
    </div>
  );
}
