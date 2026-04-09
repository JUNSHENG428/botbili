"use client";

import { startTransition, type KeyboardEvent, type MouseEvent } from "react";
import { useRouter } from "next/navigation";

import { GlassCard } from "@/components/design/glass-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/lib/format";
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

function getRecipePlatforms(recipe: Recipe): string[] {
  const nextPlatforms = Array.isArray(recipe.platforms) ? recipe.platforms : [];
  const legacyPlatforms = Array.isArray(recipe.platform) ? recipe.platform : [];
  const merged = nextPlatforms.length > 0 ? nextPlatforms : legacyPlatforms;

  return merged.filter(Boolean);
}

function getDifficultyLabel(difficulty: Recipe["difficulty"]): string {
  const labels: Record<Recipe["difficulty"], string> = {
    beginner: "Beginner",
    intermediate: "Intermediate",
    advanced: "Advanced",
  };

  return labels[difficulty] ?? difficulty;
}

function getDifficultyClassName(difficulty: Recipe["difficulty"]): string {
  const classNames: Record<Recipe["difficulty"], string> = {
    beginner: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
    intermediate: "border-cyan-500/20 bg-cyan-500/10 text-cyan-300",
    advanced: "border-violet-500/20 bg-violet-500/10 text-violet-300",
  };

  return classNames[difficulty] ?? "border-zinc-700 bg-zinc-800/70 text-zinc-300";
}

function getAuthorEmoji(authorType: Recipe["author_type"]): string {
  return authorType === "ai_agent" ? "🤖" : "👤";
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
  const router = useRouter();
  const href = getRecipeHref(recipe);
  const platforms = getRecipePlatforms(recipe);
  const visiblePlatforms = platforms.slice(0, 3);
  const remainingPlatforms = platforms.length - visiblePlatforms.length;
  const author = recipe.author;
  const authorLabel = author?.username ?? "unknown";
  const authorType = author?.author_type ?? recipe.author_type;
  const fallbackAvatar = getAuthorEmoji(authorType);
  const forkedFromLabel = recipe.forked_from ? recipe.forked_from.slice(0, 8) : null;

  function navigateToRecipe() {
    startTransition(() => {
      router.push(href);
    });
  }

  function handleCardKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      navigateToRecipe();
    }
  }

  function handleStarClick(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    onStarToggle?.(recipe.id, !isStarred);
  }

  return (
    <div
      role="link"
      tabIndex={0}
      aria-label={`查看 Recipe：${recipe.title}`}
      onClick={navigateToRecipe}
      onKeyDown={handleCardKeyDown}
      className={cn(
        "group cursor-pointer rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950",
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
            className={cn(
              "shrink-0 border-zinc-700 bg-zinc-950/60 text-zinc-200 hover:bg-zinc-800",
              isStarred && "border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/15",
            )}
          >
            {isStarred ? "已 Star" : "Star"}
          </Button>
        </div>
      </GlassCard>
    </div>
  );
}
