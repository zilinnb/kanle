import { CommentRowSkeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="divide-hairline rounded-xl bg-white dark:bg-adm-card">
      {Array.from({ length: 5 }).map((_, i) => (
        <CommentRowSkeleton key={i} />
      ))}
    </div>
  );
}
