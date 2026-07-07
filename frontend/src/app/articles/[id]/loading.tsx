import ProfileTopBar from "@/components/profile/ProfileTopBar";

const BLOCK = "animate-pulse rounded bg-black/[0.06] dark:bg-white/[0.08]";

export default function Loading() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-wechat-white md:bg-wechat-bg">
      <div className="md:pt-6">
        <div
          id="scroll-root"
          className="md:fixed md:top-6 md:left-[calc(50%-300px)] md:z-10 md:h-[calc(100vh-24px)] md:w-[600px] md:overflow-y-auto md:overflow-x-hidden md:rounded-2xl md:bg-wechat-white md:shadow-[0_8px_40px_-12px_rgba(0,0,0,0.12)] dark:md:shadow-[0_8px_40px_-12px_rgba(0,0,0,0.4)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <ProfileTopBar scrollFade />

          <main className="relative flex min-h-[calc(100vh-3rem)] w-full flex-col bg-wechat-white pb-8 pt-12 md:min-h-[calc(100vh-4rem)] md:pb-12">
            {/* ArticleReader 骨架 */}
            <div className="px-4 pb-20 pt-4 md:px-6">
              {/* 分类标签占位 */}
              <div className={`mb-3 h-5 w-14 ${BLOCK}`} />

              {/* 标题占位 */}
              <div className={`h-7 w-3/4 ${BLOCK} md:h-8`} />
              <div className={`mt-2 h-7 w-1/2 ${BLOCK} md:h-8`} />

              {/* 作者信息行占位 */}
              <div className="mt-3 flex items-center gap-1.5">
                <div className={`h-4 w-10 ${BLOCK}`} />
                <div className={`h-3 w-16 ${BLOCK}`} />
                <div className={`h-3 w-20 ${BLOCK}`} />
                <div className={`h-3 w-14 ${BLOCK}`} />
              </div>

              {/* 正文段落占位 */}
              <div className="mt-5 space-y-3">
                <div className={`h-4 w-full ${BLOCK}`} />
                <div className={`h-4 w-full ${BLOCK}`} />
                <div className={`h-4 w-5/6 ${BLOCK}`} />
                <div className={`h-4 w-full ${BLOCK}`} />
                <div className={`h-4 w-2/3 ${BLOCK}`} />
                <div className="h-2" />
                <div className={`h-4 w-full ${BLOCK}`} />
                <div className={`h-4 w-4/5 ${BLOCK}`} />
                <div className={`h-4 w-full ${BLOCK}`} />
                <div className={`h-4 w-3/4 ${BLOCK}`} />
              </div>

              {/* 阅读量占位 — 右对齐 */}
              <div className="mt-4 flex justify-end">
                <div className={`h-3 w-16 ${BLOCK}`} />
              </div>

              {/* 留言标题占位 */}
              <div className="mt-6">
                <div className={`h-5 w-20 ${BLOCK}`} />
              </div>

              {/* 灰色输入框占位 */}
              <div className={`mt-3 h-12 w-full rounded-md ${BLOCK}`} />
            </div>

            {/* 底部固定栏占位 */}
            <div className="fixed bottom-0 left-0 right-0 z-30 bg-wechat-white/95 backdrop-blur md:left-[calc(50%-300px)] md:right-auto md:w-[600px] md:rounded-b-2xl">
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className={`h-8 w-8 rounded-full md:h-9 md:w-9 ${BLOCK}`} />
                  <div className={`h-4 w-16 ${BLOCK}`} />
                </div>
                <div className="flex items-center gap-3">
                  <div className={`h-4 w-10 ${BLOCK}`} />
                  <div className={`h-4 w-10 ${BLOCK}`} />
                  <div className={`h-4 w-14 ${BLOCK}`} />
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
