export default function ExploreLoading() {
  return (
    <div className="space-y-10 py-6">
      <div className="h-8 w-32 animate-pulse rounded bg-zinc-800" />
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-8 w-20 animate-pulse rounded-full bg-zinc-800"
          />
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/50"
          />
        ))}
      </div>
    </div>
  );
}
