export default function FeedLoading() {
  return (
    <div className="space-y-6">
      {/* 排序 Tab 骨架 */}
      <div className="flex gap-3">
        <div className="h-9 w-16 animate-pulse rounded-lg bg-zinc-800" />
        <div className="h-9 w-16 animate-pulse rounded-lg bg-zinc-800" />
      </div>
      {/* 视频网格骨架 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <div className="aspect-video animate-pulse rounded-xl bg-zinc-800" />
            <div className="space-y-2 px-1">
              <div className="h-4 w-3/4 animate-pulse rounded bg-zinc-800" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-zinc-800" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
