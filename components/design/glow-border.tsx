import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

interface GlowBorderProps extends HTMLAttributes<HTMLDivElement> {}

export function GlowBorder({ className, ...props }: GlowBorderProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-cyan-500/30 bg-zinc-900/70 p-6 shadow-[0_0_16px_rgba(6,182,212,0.1)] backdrop-blur",
        className,
      )}
      {...props}
    />
  );
}
