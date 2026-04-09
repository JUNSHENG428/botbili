"use client";

import { Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Option {
  label: string;
  value: string;
}

interface RecipeFiltersProps {
  query: string;
  sort: string;
  category: string;
  difficulty: string;
  platforms: string[];
  onQueryChange: (value: string) => void;
  onSortChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onDifficultyChange: (value: string) => void;
  onPlatformToggle: (value: string) => void;
}

const SORT_OPTIONS: Option[] = [
  { label: "Trending", value: "trending" },
  { label: "最新发布", value: "newest" },
  { label: "最多 Star", value: "most_starred" },
  { label: "最多 Fork", value: "most_forked" },
  { label: "最多执行", value: "most_executed" },
];

const CATEGORY_OPTIONS: Option[] = [
  { label: "全部分类", value: "" },
  { label: "科技", value: "科技" },
  { label: "生活", value: "生活" },
  { label: "教育", value: "教育" },
  { label: "娱乐", value: "娱乐" },
  { label: "商业", value: "商业" },
  { label: "其他", value: "其他" },
];

const DIFFICULTY_OPTIONS: Option[] = [
  { label: "全部难度", value: "" },
  { label: "Beginner", value: "beginner" },
  { label: "Intermediate", value: "intermediate" },
  { label: "Advanced", value: "advanced" },
];

const PLATFORM_OPTIONS: Option[] = [
  { label: "Bilibili", value: "bilibili" },
  { label: "抖音", value: "douyin" },
  { label: "视频号", value: "wechat" },
  { label: "YouTube", value: "youtube" },
];

export function RecipeFilters({
  query,
  sort,
  category,
  difficulty,
  platforms,
  onQueryChange,
  onSortChange,
  onCategoryChange,
  onDifficultyChange,
  onPlatformToggle,
}: RecipeFiltersProps) {
  return (
    <div className="space-y-4 rounded-2xl border border-zinc-800/80 bg-zinc-900/70 p-4 backdrop-blur sm:p-5">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        <Input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="搜索标题、简介或 README 关键词"
          className="h-11 border-zinc-800 bg-zinc-950/70 pl-10 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-cyan-400"
        />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <label className="space-y-2 text-sm">
          <span className="text-zinc-400">排序</span>
          <select
            value={sort}
            onChange={(event) => onSortChange(event.target.value)}
            className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950/80 px-3 text-sm text-zinc-100 outline-none transition focus:border-cyan-500/40"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2 text-sm">
          <span className="text-zinc-400">分类</span>
          <select
            value={category}
            onChange={(event) => onCategoryChange(event.target.value)}
            className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950/80 px-3 text-sm text-zinc-100 outline-none transition focus:border-cyan-500/40"
          >
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2 text-sm">
          <span className="text-zinc-400">难度</span>
          <select
            value={difficulty}
            onChange={(event) => onDifficultyChange(event.target.value)}
            className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950/80 px-3 text-sm text-zinc-100 outline-none transition focus:border-cyan-500/40"
          >
            {DIFFICULTY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="space-y-2">
        <p className="text-sm text-zinc-400">发布平台</p>
        <div className="flex flex-wrap gap-2">
          {PLATFORM_OPTIONS.map((option) => {
            const active = platforms.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onPlatformToggle(option.value)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm transition",
                  active
                    ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-200"
                    : "border-zinc-800 bg-zinc-950/70 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200",
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        {platforms.length > 0 ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {platforms.map((platform) => (
              <Badge key={platform} variant="outline" className="border-zinc-700 bg-zinc-950/70 text-zinc-300">
                {PLATFORM_OPTIONS.find((option) => option.value === platform)?.label ?? platform}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
