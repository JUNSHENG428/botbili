import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

interface PageContainerProps extends HTMLAttributes<HTMLDivElement> {}

export function PageContainer({ className, ...props }: PageContainerProps) {
  return (
    <div
      className={cn("mx-auto w-full max-w-6xl px-4 py-8", className)}
      {...props}
    />
  );
}
