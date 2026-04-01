export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 py-8">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-zinc-800" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/50"
          />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/50" />
    </div>
  );
}
