import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {}

export function GlassCard({ className, ...props }: GlassCardProps) {
  return (
    <div
      className={cn("rounded-2xl border border-zinc-800/80 bg-zinc-900/70 p-6 backdrop-blur", className)}
      {...props}
    />
  );
}
