import { NextResponse } from "next/server";

import { calculateRecipeScore } from "@/lib/recipe-stats";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { Recipe } from "@/types/recipe";

type LeaderboardType =
  | "effect_score"
  | "execution_count"
  | "success_rate"
  | "trending"
  | "contributor";

interface RecipeLeaderboardRow extends Pick<
  Recipe,
  | "id"
  | "slug"
  | "title"
  | "author_id"
  | "author_type"
  | "execution_count"
  | "success_rate"
  | "effect_score"
  | "last_executed_at"
> {
  star_count: number;
  fork_count: number;
}

interface ExecutionActivityRow {
  recipe_id: string;
  status: string;
  created_at: string;
  output_external_url: string | null;
}

interface StarActivityRow {
  recipe_id: string;
  created_at: string;
}

interface ForkActivityRow {
  original_recipe_id: string;
  created_at: string;
}

interface ReputationRow {
  user_id: string;
  total_points: number;
  recipe_points: number;
  execution_points: number;
  review_points: number;
  level: string;
}

interface ReputationLogRow {
  user_id: string;
  points: number;
  created_at: string;
}

interface ProfileRow {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

interface CreatorRow {
  owner_id: string;
  slug: string | null;
  name: string;
  avatar_url: string | null;
}

interface ContributorSummary {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  level: string;
}

interface RecipeSummary {
  id: string;
  slug: string;
  title: string;
  author: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface LeaderboardItem {
  rank: number;
  delta: number | "new";
  primary_value: number;
  primary_label: string;
  execution_count?: number;
  success_rate?: number;
  secondary_text?: string;
  recipe?: RecipeSummary;
  contributor?: ContributorSummary & {
    total_points: number;
    recipe_points: number;
    execution_points: number;
    review_points: number;
  };
}

const VALID_TYPES: LeaderboardType[] = [
  "effect_score",
  "execution_count",
  "success_rate",
  "trending",
  "contributor",
];

function successResponse<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ success: true, data }, { status });
}

function errorResponse(message: string, code: string, status: number): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
      },
    },
    { status },
  );
}

function parseLimit(rawValue: string | null): number {
  const parsed = Number.parseInt(rawValue ?? "20", 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    return 20;
  }

  return Math.min(parsed, 50);
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function calculateTrendingScore(input: {
  recentExecutions: number;
  recentStars: number;
  recentForks: number;
  successRate: number;
}): number {
  return round(
    input.recentExecutions * 2.0 + input.recentStars * 3.0 + input.recentForks * 5.0 + input.successRate * 5.0,
    2,
  );
}

function buildRankMap(ids: string[], scoreMap: Map<string, number>): Map<string, number> {
  const sorted = [...ids].sort((left, right) => {
    const diff = (scoreMap.get(right) ?? 0) - (scoreMap.get(left) ?? 0);
    if (diff !== 0) {
      return diff;
    }
    return left.localeCompare(right);
  });

  return new Map(sorted.map((id, index) => [id, index + 1]));
}

function computeRankChange(
  id: string,
  currentRankMap: Map<string, number>,
  previousRankMap: Map<string, number>,
): number | "new" {
  const currentRank = currentRankMap.get(id);
  const previousRank = previousRankMap.get(id);

  if (!currentRank) {
    return "new";
  }

  if (!previousRank) {
    return "new";
  }

  return previousRank - currentRank;
}

async function buildRecipeAuthorMap(authorIds: string[]): Promise<Map<string, RecipeSummary["author"]>> {
  if (authorIds.length === 0) {
    return new Map();
  }

  const admin = getSupabaseAdminClient();
  const [{ data: profileRows, error: profileError }, { data: creatorRows, error: creatorError }] =
    await Promise.all([
      admin.from("profiles").select("id, username, display_name, avatar_url").in("id", authorIds),
      admin.from("creators").select("owner_id, slug, name, avatar_url").in("owner_id", authorIds),
    ]);

  if (profileError) {
    throw new Error(`buildRecipeAuthorMap profile lookup failed: ${profileError.message}`);
  }

  if (creatorError) {
    throw new Error(`buildRecipeAuthorMap creator lookup failed: ${creatorError.message}`);
  }

  const profileMap = new Map<string, ProfileRow>();
  for (const row of (profileRows ?? []) as ProfileRow[]) {
    profileMap.set(row.id, row);
  }

  const creatorMap = new Map<string, CreatorRow>();
  for (const row of (creatorRows ?? []) as CreatorRow[]) {
    if (!creatorMap.has(row.owner_id)) {
      creatorMap.set(row.owner_id, row);
    }
  }

  const result = new Map<string, RecipeSummary["author"]>();
  for (const authorId of authorIds) {
    const profile = profileMap.get(authorId);
    const creator = creatorMap.get(authorId);
    result.set(authorId, {
      id: authorId,
      username:
        profile?.username?.trim() ||
        creator?.slug?.trim() ||
        profile?.display_name?.trim()?.toLowerCase().replace(/\s+/g, "-") ||
        `user-${authorId.slice(0, 8)}`,
      display_name: profile?.display_name ?? creator?.name ?? null,
      avatar_url: profile?.avatar_url ?? creator?.avatar_url ?? null,
    });
  }

  return result;
}

async function buildContributorMap(userIds: string[], levels: Map<string, string>): Promise<Map<string, ContributorSummary>> {
  if (userIds.length === 0) {
    return new Map();
  }

  const admin = getSupabaseAdminClient();
  const [{ data: profileRows, error: profileError }, { data: creatorRows, error: creatorError }] =
    await Promise.all([
      admin.from("profiles").select("id, username, display_name, avatar_url").in("id", userIds),
      admin.from("creators").select("owner_id, slug, name, avatar_url").in("owner_id", userIds),
    ]);

  if (profileError) {
    throw new Error(`buildContributorMap profile lookup failed: ${profileError.message}`);
  }

  if (creatorError) {
    throw new Error(`buildContributorMap creator lookup failed: ${creatorError.message}`);
  }

  const profileMap = new Map<string, ProfileRow>();
  for (const row of (profileRows ?? []) as ProfileRow[]) {
    profileMap.set(row.id, row);
  }

  const creatorMap = new Map<string, CreatorRow>();
  for (const row of (creatorRows ?? []) as CreatorRow[]) {
    if (!creatorMap.has(row.owner_id)) {
      creatorMap.set(row.owner_id, row);
    }
  }

  const result = new Map<string, ContributorSummary>();
  for (const userId of userIds) {
    const profile = profileMap.get(userId);
    const creator = creatorMap.get(userId);
    result.set(userId, {
      id: userId,
      username:
        profile?.username?.trim() ||
        creator?.slug?.trim() ||
        profile?.display_name?.trim()?.toLowerCase().replace(/\s+/g, "-") ||
        `user-${userId.slice(0, 8)}`,
      display_name: profile?.display_name ?? creator?.name ?? null,
      avatar_url: profile?.avatar_url ?? creator?.avatar_url ?? null,
      level: levels.get(userId) ?? "newcomer",
    });
  }

  return result;
}

async function buildRecipeLeaderboard(type: Exclude<LeaderboardType, "contributor">, limit: number): Promise<LeaderboardItem[]> {
  const admin = getSupabaseAdminClient();
  const now = Date.now();
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now - 14 * 24 * 60 * 60 * 1000);

  const { data: recipeRows, error: recipeError } = await admin
    .from("recipes")
    .select("id, slug, title, author_id, author_type, star_count, fork_count, execution_count, success_rate, effect_score, last_executed_at")
    .eq("status", "published")
    .eq("visibility", "public")
    .returns<RecipeLeaderboardRow[]>();

  if (recipeError) {
    throw new Error(`recipe leaderboard lookup failed: ${recipeError.message}`);
  }

  const recipes = recipeRows ?? [];
  const recipeIds = recipes.map((recipe) => recipe.id);
  if (recipeIds.length === 0) {
    return [];
  }

  const [executionResult, starResult, forkResult, outputResult] = await Promise.all([
    admin
      .from("recipe_executions")
      .select("recipe_id, status, created_at, output_external_url")
      .in("recipe_id", recipeIds)
      .gte("created_at", fourteenDaysAgo.toISOString())
      .returns<ExecutionActivityRow[]>(),
    admin
      .from("recipe_stars")
      .select("recipe_id, created_at")
      .in("recipe_id", recipeIds)
      .gte("created_at", fourteenDaysAgo.toISOString())
      .returns<StarActivityRow[]>(),
    admin
      .from("recipe_forks")
      .select("original_recipe_id, created_at")
      .in("original_recipe_id", recipeIds)
      .gte("created_at", fourteenDaysAgo.toISOString())
      .returns<ForkActivityRow[]>(),
    admin
      .from("recipe_executions")
      .select("recipe_id")
      .in("recipe_id", recipeIds)
      .in("status", ["success", "completed"])
      .not("output_external_url", "is", null)
      .returns<Array<{ recipe_id: string }>>(),
  ]);

  if (executionResult.error) {
    throw new Error(`execution activity lookup failed: ${executionResult.error.message}`);
  }

  if (starResult.error) {
    throw new Error(`star activity lookup failed: ${starResult.error.message}`);
  }

  if (forkResult.error) {
    throw new Error(`fork activity lookup failed: ${forkResult.error.message}`);
  }

  if (outputResult.error) {
    throw new Error(`output activity lookup failed: ${outputResult.error.message}`);
  }

  const executionRecent7 = new Map<string, number>();
  const executionPrev7 = new Map<string, number>();
  const completedRecent7 = new Map<string, number>();
  const completedPrev7 = new Map<string, number>();
  const outputRecent7 = new Map<string, number>();

  for (const row of executionResult.data ?? []) {
    if (row.status === "cancelled") {
      continue;
    }

    const timestamp = new Date(row.created_at).getTime();
    const targetExecMap = timestamp >= sevenDaysAgo.getTime() ? executionRecent7 : executionPrev7;
    targetExecMap.set(row.recipe_id, (targetExecMap.get(row.recipe_id) ?? 0) + 1);

    if (row.status === "success" || row.status === "completed") {
      const targetCompletedMap = timestamp >= sevenDaysAgo.getTime() ? completedRecent7 : completedPrev7;
      targetCompletedMap.set(row.recipe_id, (targetCompletedMap.get(row.recipe_id) ?? 0) + 1);
    }

    if (timestamp >= sevenDaysAgo.getTime() && typeof row.output_external_url === "string" && row.output_external_url.trim().length > 0) {
      outputRecent7.set(row.recipe_id, (outputRecent7.get(row.recipe_id) ?? 0) + 1);
    }
  }

  const starRecent7 = new Map<string, number>();
  const starPrev7 = new Map<string, number>();
  for (const row of starResult.data ?? []) {
    const timestamp = new Date(row.created_at).getTime();
    const targetMap = timestamp >= sevenDaysAgo.getTime() ? starRecent7 : starPrev7;
    targetMap.set(row.recipe_id, (targetMap.get(row.recipe_id) ?? 0) + 1);
  }

  const forkRecent7 = new Map<string, number>();
  const forkPrev7 = new Map<string, number>();
  for (const row of forkResult.data ?? []) {
    const timestamp = new Date(row.created_at).getTime();
    const targetMap = timestamp >= sevenDaysAgo.getTime() ? forkRecent7 : forkPrev7;
    targetMap.set(row.original_recipe_id, (targetMap.get(row.original_recipe_id) ?? 0) + 1);
  }

  const outputCountMap = new Map<string, number>();
  for (const row of outputResult.data ?? []) {
    outputCountMap.set(row.recipe_id, (outputCountMap.get(row.recipe_id) ?? 0) + 1);
  }

  const currentScoreMap = new Map<string, number>();
  const previousScoreMap = new Map<string, number>();

  for (const recipe of recipes) {
    const currentExecutionCount = recipe.execution_count ?? 0;
    const currentSuccessRate = Number(recipe.success_rate ?? 0);
    const currentOutputCount = outputCountMap.get(recipe.id) ?? 0;
    const currentEffectScore = calculateRecipeScore({
      starCount: recipe.star_count ?? 0,
      forkCount: recipe.fork_count ?? 0,
      executionCount: currentExecutionCount,
      successRate: currentSuccessRate,
      outputCount: currentOutputCount,
      recentExecutionCount: executionRecent7.get(recipe.id) ?? 0,
      recentOutputCount: outputRecent7.get(recipe.id) ?? 0,
    });
    const currentTrendingScore = calculateTrendingScore({
      recentExecutions: executionRecent7.get(recipe.id) ?? 0,
      recentStars: starRecent7.get(recipe.id) ?? 0,
      recentForks: forkRecent7.get(recipe.id) ?? 0,
      successRate: currentSuccessRate,
    });

    const previousExecutionCount = Math.max(0, currentExecutionCount - (executionRecent7.get(recipe.id) ?? 0));
    const currentCompletedCount = Math.round(currentSuccessRate * currentExecutionCount);
    const previousCompletedCount = Math.max(0, currentCompletedCount - (completedRecent7.get(recipe.id) ?? 0));
    const previousSuccessRate =
      previousExecutionCount > 0 ? round(previousCompletedCount / previousExecutionCount, 3) : 0;
    const previousStarCount = Math.max(0, recipe.star_count - (starRecent7.get(recipe.id) ?? 0));
    const previousForkCount = Math.max(0, recipe.fork_count - (forkRecent7.get(recipe.id) ?? 0));
    const previousOutputCount = Math.max(0, currentOutputCount - (outputRecent7.get(recipe.id) ?? 0));
    const previousEffectScore = calculateRecipeScore({
      starCount: previousStarCount,
      forkCount: previousForkCount,
      executionCount: previousExecutionCount,
      successRate: previousSuccessRate,
      outputCount: previousOutputCount,
      recentExecutionCount: executionPrev7.get(recipe.id) ?? 0,
      recentOutputCount: 0,
    });
    const previousTrendingScore = calculateTrendingScore({
      recentExecutions: executionPrev7.get(recipe.id) ?? 0,
      recentStars: starPrev7.get(recipe.id) ?? 0,
      recentForks: forkPrev7.get(recipe.id) ?? 0,
      successRate: previousSuccessRate,
    });

    switch (type) {
      case "effect_score":
        currentScoreMap.set(recipe.id, currentEffectScore);
        previousScoreMap.set(recipe.id, previousEffectScore);
        break;
      case "execution_count":
        currentScoreMap.set(recipe.id, currentExecutionCount);
        previousScoreMap.set(recipe.id, previousExecutionCount);
        break;
      case "success_rate":
        if (currentExecutionCount >= 10) {
          currentScoreMap.set(recipe.id, currentSuccessRate);
        }
        if (previousExecutionCount >= 10) {
          previousScoreMap.set(recipe.id, previousSuccessRate);
        }
        break;
      case "trending":
        currentScoreMap.set(recipe.id, currentTrendingScore);
        previousScoreMap.set(recipe.id, previousTrendingScore);
        break;
    }
  }

  const currentIds = recipes
    .filter((recipe) => (currentScoreMap.get(recipe.id) ?? 0) > 0 || type === "execution_count")
    .map((recipe) => recipe.id);
  const currentRankMap = buildRankMap(currentIds, currentScoreMap);
  const previousRankMap = buildRankMap([...previousScoreMap.keys()], previousScoreMap);
  const authorMap = await buildRecipeAuthorMap([...new Set(recipes.map((recipe) => recipe.author_id))]);

  const sorted = recipes
    .filter((recipe) => currentRankMap.has(recipe.id))
    .sort((left, right) => {
      const diff = (currentScoreMap.get(right.id) ?? 0) - (currentScoreMap.get(left.id) ?? 0);
      if (diff !== 0) {
        return diff;
      }
      return left.id.localeCompare(right.id);
    })
    .slice(0, limit);

  return sorted.map((recipe, index) => {
    const delta = computeRankChange(recipe.id, currentRankMap, previousRankMap);
    const primaryValue = currentScoreMap.get(recipe.id) ?? 0;
    const recentExecutionCount = executionRecent7.get(recipe.id) ?? 0;
    const recentStarCount = starRecent7.get(recipe.id) ?? 0;
    const recentForkCount = forkRecent7.get(recipe.id) ?? 0;
    const outputCount = outputCountMap.get(recipe.id) ?? 0;
    const primaryLabel =
      type === "effect_score"
        ? "效果分"
        : type === "execution_count"
          ? "执行次数"
          : type === "success_rate"
            ? "成功率"
            : "7 日热度";

    return {
      rank: index + 1,
      delta,
      primary_value: type === "success_rate" ? round(primaryValue * 100, 1) : round(primaryValue, 2),
      primary_label: primaryLabel,
      execution_count: recipe.execution_count ?? 0,
      success_rate: Number(recipe.success_rate ?? 0),
      secondary_text:
        type === "effect_score"
          ? outputCount > 0
            ? `本周被执行 ${recentExecutionCount} 次 · 已产出 ${outputCount} 条公开视频`
            : `本周被执行 ${recentExecutionCount} 次 · 暂无公开输出`
          : type === "execution_count"
            ? outputCount > 0
              ? `成功率 ${Math.round(Number(recipe.success_rate ?? 0) * 100)}% · 已产出 ${outputCount} 条公开视频`
              : `成功率 ${Math.round(Number(recipe.success_rate ?? 0) * 100)}% · 暂无公开输出`
            : type === "success_rate"
              ? `至少 ${recipe.execution_count ?? 0} 次执行 · 最近 7 天 ${recentExecutionCount} 次`
              : `最近 7 天 +${recentStarCount} Star · +${recentForkCount} Fork · ${recentExecutionCount} 次执行`,
      recipe: {
        id: recipe.id,
        slug: recipe.slug,
        title: recipe.title,
        author: authorMap.get(recipe.author_id) ?? {
          id: recipe.author_id,
          username: `user-${recipe.author_id.slice(0, 8)}`,
          display_name: null,
          avatar_url: null,
        },
      },
    } satisfies LeaderboardItem;
  });
}

async function buildContributorLeaderboard(limit: number): Promise<LeaderboardItem[]> {
  const admin = getSupabaseAdminClient();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [reputationResult, reputationLogResult, recipeResult] = await Promise.all([
    admin
      .from("user_reputation")
      .select("user_id, total_points, recipe_points, execution_points, review_points, level")
      .returns<ReputationRow[]>(),
    admin
      .from("reputation_log")
      .select("user_id, points, created_at")
      .gte("created_at", sevenDaysAgo)
      .returns<ReputationLogRow[]>(),
    admin
      .from("recipes")
      .select("author_id, execution_count")
      .eq("status", "published")
      .eq("visibility", "public")
      .returns<Array<{ author_id: string; execution_count: number | null }>>(),
  ]);

  if (reputationResult.error) {
    throw new Error(`contributor leaderboard lookup failed: ${reputationResult.error.message}`);
  }

  if (reputationLogResult.error) {
    throw new Error(`reputation log lookup failed: ${reputationLogResult.error.message}`);
  }

  if (recipeResult.error) {
    throw new Error(`contributor recipe lookup failed: ${recipeResult.error.message}`);
  }

  const rows = (reputationResult.data ?? []).filter((row) => row.total_points > 0);
  const recentPoints = new Map<string, number>();
  for (const row of reputationLogResult.data ?? []) {
    recentPoints.set(row.user_id, (recentPoints.get(row.user_id) ?? 0) + row.points);
  }

  const executionTotals = new Map<string, number>();
  for (const row of recipeResult.data ?? []) {
    executionTotals.set(row.author_id, (executionTotals.get(row.author_id) ?? 0) + (row.execution_count ?? 0));
  }

  const currentScoreMap = new Map(rows.map((row) => [row.user_id, row.total_points]));
  const previousScoreMap = new Map(
    rows.map((row) => [row.user_id, Math.max(0, row.total_points - (recentPoints.get(row.user_id) ?? 0))]),
  );
  const currentRankMap = buildRankMap(rows.map((row) => row.user_id), currentScoreMap);
  const previousRankMap = buildRankMap(rows.map((row) => row.user_id), previousScoreMap);
  const levels = new Map(rows.map((row) => [row.user_id, row.level]));
  const contributorMap = await buildContributorMap(rows.map((row) => row.user_id), levels);

  const sorted = [...rows]
    .sort((left, right) => {
      const diff = right.total_points - left.total_points;
      if (diff !== 0) {
        return diff;
      }
      return left.user_id.localeCompare(right.user_id);
    })
    .slice(0, limit);

  return sorted.map((row, index) => ({
    rank: index + 1,
    delta: computeRankChange(row.user_id, currentRankMap, previousRankMap),
    primary_value: row.total_points,
    primary_label: "积分",
    secondary_text: `Recipe ${row.recipe_points} · 执行 ${row.execution_points}`,
    contributor: {
      ...(contributorMap.get(row.user_id) ?? {
        id: row.user_id,
        username: `user-${row.user_id.slice(0, 8)}`,
        display_name: null,
        avatar_url: null,
        level: row.level,
      }),
      total_points: row.total_points,
      recipe_points: row.recipe_points,
      execution_points: row.execution_points,
      review_points: row.review_points,
    },
    execution_count: executionTotals.get(row.user_id) ?? 0,
  }));
}

/**
 * curl "http://localhost:3000/api/leaderboard?type=effect_score&limit=20"
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const type = (searchParams.get("type") ?? "effect_score") as LeaderboardType;
    const limit = parseLimit(searchParams.get("limit"));

    if (!VALID_TYPES.includes(type)) {
      return errorResponse("不支持的排行榜类型", "INVALID_LEADERBOARD_TYPE", 400);
    }

    const items =
      type === "contributor"
        ? await buildContributorLeaderboard(limit)
        : await buildRecipeLeaderboard(type, limit);

    return successResponse({
      type,
      items,
    });
  } catch (error: unknown) {
    console.error("GET /api/leaderboard failed:", error);
    return errorResponse("获取排行榜失败", "INTERNAL_ERROR", 500);
  }
}
