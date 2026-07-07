export default function Loading() {
  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6 h-8 w-32 animate-pulse rounded bg-adm-input" />
      <div className="mb-4 flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-8 w-16 animate-pulse rounded-lg bg-adm-input" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="aspect-square animate-pulse rounded-lg bg-adm-input" />
        ))}
      </div>
    </div>
  );
}
