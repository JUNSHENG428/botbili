"use client";

import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

interface GhostButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {}

export function GhostButton({ className, type = "button", ...props }: GhostButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center rounded-md border border-zinc-700 px-4 py-2 text-sm text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-800/60 disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}
