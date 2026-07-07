import { PostCardSkeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="divide-hairline rounded-xl bg-white dark:bg-adm-card">
      {Array.from({ length: 4 }).map((_, i) => (
        <PostCardSkeleton key={i} />
      ))}
    </div>
  );
}
