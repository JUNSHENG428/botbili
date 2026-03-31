import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

interface AuroraBackgroundProps extends HTMLAttributes<HTMLDivElement> {}

export function AuroraBackground({ className, children, ...props }: AuroraBackgroundProps) {
  return (
    <div className={cn("relative overflow-hidden", className)} {...props}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-30"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 30%, rgba(6,182,212,0.25), transparent 70%), radial-gradient(ellipse 60% 50% at 70% 60%, rgba(139,92,246,0.15), transparent 60%)",
        }}
      />
      {children}
    </div>
  );
}
