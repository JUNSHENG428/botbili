import { GlassCard } from "@/components/design/glass-card";
import { cn } from "@/lib/utils";

interface RecipeCardSkeletonProps {
  className?: string;
}

export function RecipeCardSkeleton({ className }: RecipeCardSkeletonProps) {
  return (
    <GlassCard className={cn("animate-pulse space-y-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <div className="h-5 w-14 rounded-full bg-zinc-800" />
          <div className="h-5 w-16 rounded-full bg-zinc-800" />
          <div className="h-5 w-12 rounded-full bg-zinc-800" />
        </div>
        <div className="h-5 w-20 rounded-full bg-zinc-800" />
      </div>

      <div className="space-y-2">
        <div className="h-6 w-5/6 rounded bg-zinc-800" />
        <div className="h-6 w-2/3 rounded bg-zinc-800" />
        <div className="h-4 w-full rounded bg-zinc-900" />
        <div className="h-4 w-4/5 rounded bg-zinc-900" />
      </div>

      <div className="flex items-center gap-3">
        <div className="h-6 w-6 rounded-full bg-zinc-800" />
        <div className="space-y-2">
          <div className="h-4 w-28 rounded bg-zinc-800" />
          <div className="h-3 w-20 rounded bg-zinc-900" />
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="flex gap-3">
          <div className="h-4 w-10 rounded bg-zinc-800" />
          <div className="h-4 w-10 rounded bg-zinc-800" />
          <div className="h-4 w-10 rounded bg-zinc-800" />
          <div className="h-4 w-10 rounded bg-zinc-800" />
        </div>
        <div className="h-8 w-16 rounded-lg bg-zinc-800" />
      </div>
    </GlassCard>
  );
}
