"use client";

import { cn } from "@/lib/utils";

interface RecipeStatsProps {
  starCount: number;
  forkCount: number;
  execCount: number;
  commentCount: number;
  className?: string;
}

function formatCompactCount(value: number): string {
  if (value >= 10000) {
    return `${(value / 10000).toFixed(1).replace(".0", "")}w`;
  }

  if (value >= 1000) {
    return `${(value / 1000).toFixed(1).replace(".0", "")}k`;
  }

  return `${value}`;
}

export function RecipeStats({
  starCount,
  forkCount,
  execCount,
  commentCount,
  className,
}: RecipeStatsProps) {
  return (
    <div className={cn("flex items-center gap-3 text-xs text-zinc-400 sm:gap-4", className)}>
      <span className="tabular-nums">⭐ {formatCompactCount(starCount)}</span>
      <span className="tabular-nums">🍴 {formatCompactCount(forkCount)}</span>
      <span className="tabular-nums">▶️ {formatCompactCount(execCount)}</span>
      <span className="tabular-nums">💬 {formatCompactCount(commentCount)}</span>
    </div>
  );
}
