import Link from "next/link";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/lib/format";
import {
  getAuthorEmoji,
  getDifficultyClassName,
  getDifficultyLabel,
  getRecipePlatforms,
} from "@/lib/recipe-utils";
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
  actions?: ReactNode;
}

export function RecipeHeader({ recipe, forkSource, actions }: RecipeHeaderProps) {
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
          {actions ? <div className="mr-1">{actions}</div> : null}
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
            <span>{getAuthorEmoji(author?.author_type ?? recipe.author_type)}</span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-300">
            <span className="truncate font-medium">{authorLabel}</span>
            <span title={author?.author_type === "ai_agent" ? "AI Agent 作者" : "人类作者"}>
              {getAuthorEmoji(author?.author_type ?? recipe.author_type)}
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
