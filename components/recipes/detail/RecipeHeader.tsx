import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Recipe } from "@/types/recipe";

import { RecipeStats } from "../RecipeStats";

interface RecipeAuthor {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  author_type: "human" | "ai_agent";
}

interface ForkSourceSummary {
  id: string;
  slug: string;
  author?: RecipeAuthor;
}

interface RecipeHeaderProps {
  recipe: Recipe & { author?: RecipeAuthor };
  forkSource?: ForkSourceSummary | null;
}

function getDifficultyClassName(difficulty: Recipe["difficulty"]): string {
  const classNames: Record<Recipe["difficulty"], string> = {
    beginner: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
    intermediate: "border-cyan-500/20 bg-cyan-500/10 text-cyan-300",
    advanced: "border-violet-500/20 bg-violet-500/10 text-violet-300",
  };

  return classNames[difficulty] ?? "border-zinc-700 bg-zinc-800/70 text-zinc-300";
}

function getDifficultyLabel(difficulty: Recipe["difficulty"]): string {
  const labels: Record<Recipe["difficulty"], string> = {
    beginner: "Beginner",
    intermediate: "Intermediate",
    advanced: "Advanced",
  };

  return labels[difficulty] ?? difficulty;
}

function getRecipePlatforms(recipe: Recipe): string[] {
  const nextPlatforms = Array.isArray(recipe.platforms) ? recipe.platforms : [];
  const legacyPlatforms = Array.isArray(recipe.platform) ? recipe.platform : [];
  return nextPlatforms.length > 0 ? nextPlatforms : legacyPlatforms;
}

export function RecipeHeader({ recipe, forkSource }: RecipeHeaderProps) {
  const author = recipe.author;
  const authorLabel = author?.display_name || author?.username || "未知作者";
  const platforms = getRecipePlatforms(recipe);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          {forkSource ? (
            <p className="text-sm text-zinc-500">
              forked from{" "}
              <Link
                href={`/recipes/${forkSource.slug || forkSource.id}`}
                className="font-medium text-cyan-300 hover:text-cyan-200"
              >
                {(forkSource.author?.username || "unknown")}/{forkSource.slug}
              </Link>
            </p>
          ) : null}

          <h1 className="text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">{recipe.title}</h1>

          {recipe.description ? (
            <p className="max-w-3xl text-base leading-7 text-zinc-400">{recipe.description}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className={cn("border text-xs", getDifficultyClassName(recipe.difficulty))}>
            {getDifficultyLabel(recipe.difficulty)}
          </Badge>
          {platforms.map((platform) => (
            <Badge key={platform} variant="outline" className="border-zinc-700 bg-zinc-950/70 text-zinc-300">
              {platform}
            </Badge>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-4">
        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-zinc-800 bg-zinc-950 text-sm text-zinc-300">
          {author?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={author.avatar_url} alt={authorLabel} className="h-full w-full object-cover" />
          ) : (
            <span>{author?.author_type === "ai_agent" ? "🤖" : "👤"}</span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-300">
            <span className="truncate font-medium">{authorLabel}</span>
            <span title={author?.author_type === "ai_agent" ? "AI Agent 作者" : "人类作者"}>
              {author?.author_type === "ai_agent" ? "🤖" : "👤"}
            </span>
            <span className="text-zinc-600">·</span>
            <span className="text-zinc-500">{recipe.created_at ? formatRelativeTime(recipe.created_at) : "刚刚发布"}</span>
          </div>
          {author?.username ? <p className="truncate text-xs text-zinc-500">@{author.username}</p> : null}
        </div>

        <RecipeStats
          starCount={recipe.star_count}
          forkCount={recipe.fork_count}
          execCount={recipe.exec_count}
          commentCount={recipe.comment_count}
          className="text-sm"
        />
      </div>
    </div>
  );
}
