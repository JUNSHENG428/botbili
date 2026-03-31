import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface SectionHeadingProps {
  children: ReactNode;
  subtitle?: string;
  className?: string;
}

export function SectionHeading({ children, subtitle, className }: SectionHeadingProps) {
  return (
    <div className={cn("space-y-2 text-center", className)}>
      <h2 className="text-2xl font-bold text-zinc-100 sm:text-3xl">{children}</h2>
      {subtitle ? <p className="mx-auto max-w-xl text-sm text-zinc-400">{subtitle}</p> : null}
    </div>
  );
}
