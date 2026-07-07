const BLOCK = "animate-pulse rounded bg-black/[0.06] dark:bg-white/[0.08]";

export function PostCardSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`flex gap-3 px-4 py-4 sm:px-5 md:px-6 ${className}`}>
      {/* Avatar */}
      <div className={`h-10 w-10 shrink-0 rounded-[5px] ${BLOCK}`} />
      {/* Content column */}
      <div className="min-w-0 flex-1 space-y-2">
        {/* Name */}
        <div className={`h-4 w-24 ${BLOCK}`} />
        {/* Content line 1 */}
        <div className={`h-4 w-full ${BLOCK}`} />
        {/* Content line 2 */}
        <div className={`h-4 w-3/5 ${BLOCK}`} />
        {/* Interaction bubble */}
        <div className={`mt-3 h-8 w-full rounded-[4px] ${BLOCK}`} />
      </div>
    </div>
  );
}

export function PostListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="divide-hairline">
      {Array.from({ length: count }).map((_, i) => (
        <PostCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function CommentRowSkeleton() {
  return (
    <div className="flex gap-3 px-4 py-4 sm:px-5 md:px-6">
      <div className={`h-9 w-9 shrink-0 rounded-full ${BLOCK}`} />
      <div className="min-w-0 flex-1 space-y-2">
        <div className={`h-4 w-20 ${BLOCK}`} />
        <div className={`h-4 w-2/3 ${BLOCK}`} />
        <div className={`h-3 w-24 ${BLOCK}`} />
      </div>
    </div>
  );
}

export function CommentListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="divide-hairline">
      {Array.from({ length: count }).map((_, i) => (
        <CommentRowSkeleton key={i} />
      ))}
    </div>
  );
}
