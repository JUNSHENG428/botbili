"use client";

import type { MouseEvent } from "react";
import Link from "next/link";

import { GlassCard } from "@/components/design/glass-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/lib/format";
import {
  getAuthorEmoji,
  getDifficultyClassName,
  getDifficultyLabel,
  getRecipePlatforms,
} from "@/lib/recipe-utils";
import { cn } from "@/lib/utils";
import type { Recipe } from "@/types/recipe";

import { RecipeStats } from "./RecipeStats";

interface RecipeCardAuthor {
  username: string;
  avatar_url?: string | null;
  author_type: "human" | "ai_agent";
}

export interface RecipeCardProps {
  recipe: Recipe & {
    author?: RecipeCardAuthor;
  };
  isStarred?: boolean;
  isSaved?: boolean;
  onStarToggle?: (recipeId: string, newState: boolean) => void;
  className?: string;
}

function getRecipeHref(recipe: Recipe): string {
  return `/recipes/${recipe.slug || recipe.id}`;
}

function buildDescription(recipe: Recipe): string {
  if (recipe.description?.trim()) {
    return recipe.description.trim();
  }

  if (typeof recipe.readme_json === "string" && recipe.readme_json.trim()) {
    return recipe.readme_json.trim();
  }

  if (recipe.readme_md?.trim()) {
    return recipe.readme_md.trim();
  }

  return "把一个可执行的视频生成方案整理成 Repo，供更多创作者直接 fork 和运行。";
}

export function RecipeCard({
  recipe,
  isStarred = false,
  isSaved: _isSaved = false,
  onStarToggle,
  className,
}: RecipeCardProps) {
  const href = getRecipeHref(recipe);
  const platforms = getRecipePlatforms(recipe);
  const visiblePlatforms = platforms.slice(0, 3);
  const remainingPlatforms = platforms.length - visiblePlatforms.length;
  const author = recipe.author;
  const authorLabel = author?.username ?? "unknown";
  const authorType = author?.author_type ?? recipe.author_type;
  const fallbackAvatar = getAuthorEmoji(authorType);
  const forkedFromLabel = recipe.forked_from ? recipe.forked_from.slice(0, 8) : null;
  const canToggleStar = typeof onStarToggle === "function";
  const executionCount = recipe.execution_count ?? 0;
  const successRate = recipe.success_rate ?? 0;
  const lastExecutedAt = recipe.last_executed_at;
  const outputCount = recipe.output_count ?? 0;
  const hasOutputCount = typeof recipe.output_count === "number";

  function handleStarClick(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    onStarToggle?.(recipe.id, !isStarred);
  }

  return (
    <Link
      href={href}
      aria-label={`查看 Recipe：${recipe.title}`}
      className={cn(
        "group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950",
        className,
      )}
    >
      <GlassCard className="h-full space-y-5 transition duration-200 hover:border-cyan-500/30 hover:bg-zinc-900/85">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {visiblePlatforms.map((platform) => (
              <Badge
                key={platform}
                variant="outline"
                className="border-zinc-700 bg-zinc-950/60 text-[11px] uppercase tracking-[0.18em] text-zinc-300"
              >
                {platform}
              </Badge>
            ))}
            {remainingPlatforms > 0 ? (
              <Badge variant="outline" className="border-zinc-700 bg-zinc-950/60 text-[11px] text-zinc-400">
                +{remainingPlatforms}
              </Badge>
            ) : null}
          </div>

          <Badge variant="outline" className={cn("shrink-0 border text-[11px]", getDifficultyClassName(recipe.difficulty))}>
            {getDifficultyLabel(recipe.difficulty)}
          </Badge>
        </div>

        <div className="space-y-2">
          <h3 className="line-clamp-2 text-lg font-semibold leading-7 text-zinc-50 transition group-hover:text-cyan-200">
            {recipe.title}
          </h3>
          <p className="line-clamp-2 text-sm leading-6 text-zinc-400">{buildDescription(recipe)}</p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full border border-zinc-800 bg-zinc-950 text-xs">
              {author?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={author.avatar_url}
                  alt={authorLabel}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span aria-hidden="true">{fallbackAvatar}</span>
              )}
            </div>

            <div className="min-w-0 flex-1 text-sm text-zinc-400">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium text-zinc-200">{authorLabel}</span>
                <span title={authorType === "ai_agent" ? "AI Agent 作者" : "人类作者"} aria-label={authorType}>
                  {getAuthorEmoji(authorType)}
                </span>
              </div>
              <p className="truncate text-xs text-zinc-500">
                {recipe.created_at ? formatRelativeTime(recipe.created_at) : "刚刚创建"}
              </p>
            </div>
          </div>

          {forkedFromLabel ? (
            <p className="text-xs text-zinc-500">
              forked from <span className="font-medium text-zinc-300">{forkedFromLabel}</span>
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-4">
          <RecipeStats
            starCount={recipe.star_count}
            forkCount={recipe.fork_count}
            execCount={recipe.exec_count}
            commentCount={recipe.comment_count}
            className="min-w-0 flex-1"
          />

          <Button
            type="button"
            size="sm"
            variant={isStarred ? "secondary" : "outline"}
            aria-pressed={isStarred}
            onClick={handleStarClick}
            disabled={!canToggleStar}
            className={cn(
              "shrink-0 border-zinc-700 bg-zinc-950/60 text-zinc-200 hover:bg-zinc-800",
              !canToggleStar && "cursor-not-allowed opacity-60 hover:bg-zinc-950/60",
              isStarred && "border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/15",
            )}
          >
            {isStarred ? "已 Star" : "Star"}
          </Button>
        </div>

        <div className="mt-2 flex items-center gap-3 border-t border-zinc-800 pt-2 text-xs text-zinc-500">
          {executionCount > 0 ? (
            <>
              <span>▶ {executionCount} 次执行</span>
              {successRate > 0 ? (
                <span
                  className={cn(
                    successRate >= 0.8
                      ? "text-green-500"
                      : successRate >= 0.5
                        ? "text-yellow-500"
                        : "text-red-500",
                  )}
                >
                  ✓ {Math.round(successRate * 100)}% 成功率
                </span>
              ) : null}
              {hasOutputCount ? (
                outputCount > 0 ? <span>📺 已产出 {outputCount} 条公开视频</span> : <span className="text-zinc-600">暂无公开输出</span>
              ) : null}
              {lastExecutedAt ? <span>最近 {formatRelativeTime(lastExecutedAt)}</span> : null}
            </>
          ) : (
            <span className="text-zinc-600">尚无执行记录</span>
          )}
        </div>
      </GlassCard>
    </Link>
  );
}
