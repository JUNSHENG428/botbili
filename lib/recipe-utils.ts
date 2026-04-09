import type { Recipe } from "@/types/recipe";

export function getDifficultyLabel(difficulty: Recipe["difficulty"]): string {
  const labels: Record<Recipe["difficulty"], string> = {
    beginner: "Beginner",
    intermediate: "Intermediate",
    advanced: "Advanced",
  };

  return labels[difficulty] ?? difficulty;
}

export function getDifficultyClassName(difficulty: Recipe["difficulty"]): string {
  const classNames: Record<Recipe["difficulty"], string> = {
    beginner: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
    intermediate: "border-cyan-500/20 bg-cyan-500/10 text-cyan-300",
    advanced: "border-violet-500/20 bg-violet-500/10 text-violet-300",
  };

  return classNames[difficulty] ?? "border-zinc-700 bg-zinc-800/70 text-zinc-300";
}

export function getRecipePlatforms(recipe: Recipe): string[] {
  const nextPlatforms = Array.isArray(recipe.platforms) ? recipe.platforms : [];
  const legacyPlatforms = Array.isArray(recipe.platform) ? recipe.platform : [];
  const merged = nextPlatforms.length > 0 ? nextPlatforms : legacyPlatforms;

  return merged.filter(Boolean);
}

export function getAuthorEmoji(authorType: Recipe["author_type"]): string {
  return authorType === "ai_agent" ? "🤖" : "👤";
}
