import DesktopDecorations from "@/components/DesktopDecorations";
import { PostCardSkeleton } from "@/components/Skeleton";

const BLOCK = "animate-pulse rounded bg-black/[0.06] dark:bg-white/[0.08]";

export default function Loading() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-wechat-white md:bg-wechat-bg">
      <DesktopDecorations />

      <div className="md:pt-6">
        {/* 主内容卡片（中间） */}
        <div
          id="scroll-root"
          className="md:fixed md:top-6 md:left-[calc(50%-300px)] md:z-10 md:h-[calc(100vh-48px)] md:w-[600px] md:overflow-y-auto md:rounded-2xl md:bg-wechat-white md:shadow-[0_8px_40px_-12px_rgba(0,0,0,0.12)] dark:md:shadow-[0_8px_40px_-12px_rgba(0,0,0,0.4)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <main className="relative w-full bg-wechat-white pb-8 md:pb-12">
            {/* TopBar 骨架：fixed 与真实结构一致 */}
            <header
              data-topbar
              className="fixed left-1/2 z-50 w-full max-w-[600px] -translate-x-1/2 top-0 md:top-6 pointer-events-none"
            >
              <div className="flex h-12 w-full items-center justify-between px-4 sm:px-5 md:px-6 md:rounded-t-2xl">
                {/* 左：音乐播放器骨架 */}
                <div className="flex items-center gap-1.5 rounded-full bg-white/15 px-1 pr-2">
                  <div className={`h-7 w-7 shrink-0 rounded-full ${BLOCK}`} />
                  <div className={`h-2.5 w-14 ${BLOCK}`} />
                </div>
                {/* 右：友链 + 登录按钮骨架（移动端） */}
                <div className="flex shrink-0 items-center gap-1.5 md:hidden">
                  <div className={`h-8 w-8 rounded-full ${BLOCK}`} />
                  <div className={`h-8 w-8 rounded-full ${BLOCK}`} />
                </div>
              </div>
            </header>

            {/* Cover header 骨架 */}
            <div className="relative h-[335px] w-full sm:h-[300px] md:h-[340px]">
              <div className={`absolute inset-0 ${BLOCK} md:rounded-t-2xl`} />
              {/* 底部渐变 */}
              <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/10 to-transparent" />
              {/* 昵称 + 头像（右下角，与真实一致） */}
              <div className="absolute bottom-0 left-0 right-0 mx-auto max-w-[600px] px-4 sm:px-5 md:px-6">
                <div className="flex items-end justify-end gap-3 pb-1">
                  <div className={`h-5 w-24 ${BLOCK}`} />
                  <div className={`h-[56px] w-[56px] shrink-0 translate-y-[42%] rounded-[5px] sm:h-[60px] sm:w-[60px] md:h-[64px] md:w-[64px] ${BLOCK}`} />
                </div>
              </div>
            </div>

            {/* Bio 骨架 */}
            <div className="mx-auto flex max-w-[600px] justify-end px-4 pb-2 pt-6 sm:px-5 sm:pt-7 md:px-6 md:pb-3 md:pt-8">
              <div className={`h-3 w-32 ${BLOCK}`} />
            </div>

            {/* Post list 骨架 */}
            <div className="divide-hairline">
              {Array.from({ length: 4 }).map((_, i) => (
                <PostCardSkeleton key={i} />
              ))}
            </div>
          </main>
        </div>

        {/* 桌面右侧 Sidebar 骨架（友链 + 登录） */}
        <aside className="hidden lg:block lg:fixed lg:top-6 lg:left-[calc(50%+324px)] lg:w-[220px] xl:w-[260px]">
          <div className="space-y-4">
            {/* 登录卡片骨架 */}
            <div className="rounded-2xl bg-wechat-white p-4 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_40px_-12px_rgba(0,0,0,0.4)]">
              <div className="flex flex-wrap justify-center gap-2.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className={`h-9 w-9 rounded-xl ${BLOCK}`} />
                ))}
              </div>
              <div className="mt-3 border-t border-black/5 pt-3 dark:border-white/5">
                <div className={`h-8 w-full rounded-lg ${BLOCK}`} />
              </div>
            </div>
            {/* 友链卡片骨架 */}
            <div className="rounded-2xl bg-wechat-white p-4 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_40px_-12px_rgba(0,0,0,0.4)]">
              <div className={`mb-3 h-4 w-20 rounded ${BLOCK}`} />
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-2.5 px-2 py-1.5">
                    <div className={`h-7 w-7 shrink-0 rounded-[5px] ${BLOCK}`} />
                    <div className="flex-1 space-y-1.5">
                      <div className={`h-3 w-1/2 rounded ${BLOCK}`} />
                      <div className={`h-2.5 w-3/4 rounded ${BLOCK}`} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* 桌面左侧 ArticleListSidebar 骨架 */}
        <aside className="hidden lg:block lg:fixed lg:top-6 lg:right-[calc(50%+324px)] lg:w-[220px] xl:w-[260px]">
          <div className="rounded-2xl bg-wechat-white p-4 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_40px_-12px_rgba(0,0,0,0.4)]">
            <div className="mb-3 flex items-center gap-1.5">
              <div className={`h-4 w-4 rounded ${BLOCK}`} />
              <div className={`h-3 w-16 rounded ${BLOCK}`} />
            </div>
            <div className="space-y-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-2 rounded-lg p-1.5">
                  <div className={`h-12 w-16 shrink-0 rounded-md ${BLOCK}`} />
                  <div className="min-w-0 flex-1 space-y-1.5 pt-0.5">
                    <div className={`h-3 w-full rounded ${BLOCK}`} />
                    <div className={`h-3 w-2/3 rounded ${BLOCK}`} />
                    <div className={`h-2.5 w-12 rounded ${BLOCK}`} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
