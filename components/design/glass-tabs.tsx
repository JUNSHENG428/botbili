"use client";

import { cn } from "@/lib/utils";

interface TabItem {
  value: string;
  label: string;
}

interface GlassTabsProps {
  tabs: TabItem[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function GlassTabs({ tabs, value, onChange, className }: GlassTabsProps) {
  return (
    <div className={cn("flex gap-1 rounded-lg border border-zinc-800 bg-zinc-950/50 p-1", className)}>
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          onClick={() => onChange(tab.value)}
          className={cn(
            "flex-1 rounded-md px-3 py-1.5 text-xs transition",
            value === tab.value
              ? "bg-zinc-800 text-zinc-100"
              : "text-zinc-500 hover:text-zinc-300",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
