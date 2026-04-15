import { NextResponse } from "next/server";

import { buildRecipeAuthorMap } from "@/lib/recipe-authors";
import { createClientForServer, getSupabaseAdminClient } from "@/lib/supabase/server";
import type { Recipe } from "@/types/recipe";

interface SeedRecipeRow {
  id: string;
  author_id: string;
  author_type: Recipe["author_type"];
  category: string | null;
  forked_from: string | null;
  forked_from_id: string | null;
}

interface RecipeExecutionAggregateRow {
  recipe_id: string;
  status: string;
  output_external_url: string | null;
}

interface RecipeExecutionAggregate {
  outputCount: number;
  completedExecutionCount: number;
}

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
  const parsed = Number.parseInt(rawValue ?? "6", 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    return 6;
  }
  return Math.min(parsed, 12);
}

function parseMode(rawValue: string | null): "personalized" | "starter" {
  return rawValue === "starter" ? "starter" : "personalized";
}

function mergeUniqueRecipes(current: Recipe[], incoming: Recipe[], limit: number, excludedIds: Set<string>): Recipe[] {
  const seen = new Set(current.map((recipe) => recipe.id));
  const merged = [...current];

  for (const recipe of incoming) {
    if (merged.length >= limit) {
      break;
    }

    if (seen.has(recipe.id) || excludedIds.has(recipe.id)) {
      continue;
    }

    seen.add(recipe.id);
    merged.push(recipe);
  }

  return merged;
}

async function buildExecutionAggregateMap(recipeIds: string[]): Promise<Map<string, RecipeExecutionAggregate>> {
  const nextRecipeIds = [...new Set(recipeIds.filter(Boolean))];
  if (nextRecipeIds.length === 0) {
    return new Map();
  }

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("recipe_executions")
    .select("recipe_id, status, output_external_url")
    .in("recipe_id", nextRecipeIds)
    .returns<RecipeExecutionAggregateRow[]>();

  if (error) {
    throw new Error(`buildExecutionAggregateMap failed: ${error.message}`);
  }

  const aggregateMap = new Map<string, RecipeExecutionAggregate>();
  for (const recipeId of nextRecipeIds) {
    aggregateMap.set(recipeId, {
      outputCount: 0,
      completedExecutionCount: 0,
    });
  }

  for (const row of data ?? []) {
    const aggregate = aggregateMap.get(row.recipe_id);
    if (!aggregate || row.status === "cancelled") {
      continue;
    }

    if (row.status === "success" || row.status === "completed") {
      aggregate.completedExecutionCount += 1;
    }

    if (typeof row.output_external_url === "string" && row.output_external_url.trim().length > 0) {
      aggregate.outputCount += 1;
    }
  }

  return aggregateMap;
}

function attachRecipeSignals(recipe: Recipe, aggregate?: RecipeExecutionAggregate): Recipe {
  return {
    ...recipe,
    completed_execution_count: aggregate?.completedExecutionCount ?? 0,
    output_count: aggregate?.outputCount ?? 0,
  };
}

function getStarterRecencyBoost(lastExecutedAt: string | null): number {
  if (!lastExecutedAt) {
    return 0;
  }

  const timestamp = Date.parse(lastExecutedAt);
  if (Number.isNaN(timestamp)) {
    return 0;
  }

  const ageInDays = (Date.now() - timestamp) / (1000 * 60 * 60 * 24);
  if (ageInDays <= 7) {
    return 20;
  }

  if (ageInDays <= 30) {
    return 8;
  }

  return 0;
}

function calculateStarterScore(recipe: Recipe, aggregate?: RecipeExecutionAggregate): number {
  const executionCount = recipe.execution_count ?? recipe.exec_count ?? 0;
  const completedCount = aggregate?.completedExecutionCount ?? 0;
  const outputCount = aggregate?.outputCount ?? 0;

  const difficultyBoost = recipe.difficulty === "beginner" ? 32 : recipe.difficulty === "intermediate" ? 12 : 0;
  const successBoost = Number(recipe.success_rate ?? 0) * 70;
  const executionBoost = Math.min(executionCount, 120) * 0.35;
  const completionBoost = Math.min(completedCount, 60) * 0.6;
  const outputBoost = outputCount > 0 ? 35 + Math.min(outputCount, 12) * 2 : 0;
  const effectBoost = Math.min(Number(recipe.effect_score ?? 0), 120) * 0.2;
  const recencyBoost = getStarterRecencyBoost(recipe.last_executed_at);
  const lowSamplePenalty = executionCount < 3 ? 30 : executionCount < 5 ? 12 : 0;
  const noOutputPenalty = outputCount === 0 ? 18 : 0;

  return (
    difficultyBoost +
    successBoost +
    executionBoost +
    completionBoost +
    outputBoost +
    effectBoost +
    recencyBoost -
    lowSamplePenalty -
    noOutputPenalty
  );
}

async function fetchTrendingRecipes(limit: number): Promise<Recipe[]> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("recipes")
    .select("*")
    .eq("status", "published")
    .eq("visibility", "public")
    .order("effect_score", { ascending: false })
    .order("last_executed_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`fetchTrendingRecipes failed: ${error.message}`);
  }

  return (data ?? []) as Recipe[];
}

async function fetchStarterRecipes(limit: number): Promise<Recipe[]> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("recipes")
    .select("*")
    .eq("status", "published")
    .eq("visibility", "public")
    .order("effect_score", { ascending: false })
    .order("execution_count", { ascending: false })
    .limit(40);

  if (error) {
    throw new Error(`fetchStarterRecipes failed: ${error.message}`);
  }

  const recipes = (data ?? []) as Recipe[];
  const aggregateMap = await buildExecutionAggregateMap(recipes.map((recipe) => recipe.id));

  return recipes
    .map((recipe) => attachRecipeSignals(recipe, aggregateMap.get(recipe.id)))
    .sort((left, right) => {
      const leftScore = calculateStarterScore(left, aggregateMap.get(left.id));
      const rightScore = calculateStarterScore(right, aggregateMap.get(right.id));
      if (rightScore !== leftScore) {
        return rightScore - leftScore;
      }
      return (right.effect_score ?? 0) - (left.effect_score ?? 0);
    })
    .slice(0, limit);
}

/**
 * curl "http://localhost:3000/api/recipes/recommended?limit=6"
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const searchParams = new URL(request.url).searchParams;
    const limit = parseLimit(searchParams.get("limit"));
    const mode = parseMode(searchParams.get("mode"));
    const sessionClient = await createClientForServer();
    const {
      data: { user },
    } = await sessionClient.auth.getUser();

    if (mode === "starter") {
      const recipes = await fetchStarterRecipes(limit);
      const authorMap = await buildRecipeAuthorMap(recipes);
      return successResponse({
        recipes: recipes.map((recipe) => ({
          ...recipe,
          author: authorMap.get(recipe.author_id) ?? null,
        })),
      });
    }

    if (!user?.id) {
      const recipes = await fetchTrendingRecipes(limit);
      const authorMap = await buildRecipeAuthorMap(recipes);
      return successResponse({
        recipes: recipes.map((recipe) => ({
          ...recipe,
          author: authorMap.get(recipe.author_id) ?? null,
        })),
      });
    }

    const admin = getSupabaseAdminClient();
    const [executionResult, starResult] = await Promise.all([
      admin
        .from("recipe_executions")
        .select("recipe_id, status")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(40),
      admin
        .from("recipe_stars")
        .select("recipe_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(40),
    ]);

    if (executionResult.error) {
      throw new Error(`推荐读取执行历史失败: ${executionResult.error.message}`);
    }

    if (starResult.error) {
      throw new Error(`推荐读取 Star 历史失败: ${starResult.error.message}`);
    }

    const executedRecipeIds = [...new Set(
      (executionResult.data ?? [])
        .filter((row) => row.status !== "cancelled")
        .map((row) => row.recipe_id),
    )];
    const starredRecipeIds = [...new Set((starResult.data ?? []).map((row) => row.recipe_id))];
    const seedIds = [...new Set([...executedRecipeIds, ...starredRecipeIds])];
    const excludedIds = new Set(seedIds);

    if (seedIds.length === 0) {
      const recipes = await fetchTrendingRecipes(limit);
      const authorMap = await buildRecipeAuthorMap(recipes);
      return successResponse({
        recipes: recipes.map((recipe) => ({
          ...recipe,
          author: authorMap.get(recipe.author_id) ?? null,
        })),
      });
    }

    const { data: seedRecipeRows, error: seedRecipeError } = await admin
      .from("recipes")
      .select("id, author_id, author_type, category, forked_from, forked_from_id")
      .in("id", seedIds)
      .returns<SeedRecipeRow[]>();

    if (seedRecipeError) {
      throw new Error(`推荐读取种子 Recipe 失败: ${seedRecipeError.message}`);
    }

    const seeds = seedRecipeRows ?? [];
    const categories = [...new Set(seeds.map((recipe) => recipe.category).filter(Boolean))] as string[];
    const starredAuthors = [...new Set(
      seeds
        .filter((seed) => starredRecipeIds.includes(seed.id))
        .map((recipe) => recipe.author_id),
    )];
    const upstreamIds = [...new Set(
      seeds
        .map((recipe) => recipe.forked_from_id ?? recipe.forked_from)
        .filter(Boolean),
    )] as string[];

    let recommended: Recipe[] = [];

    if (categories.length > 0) {
      const { data, error } = await admin
        .from("recipes")
        .select("*")
        .in("category", categories)
        .eq("status", "published")
        .eq("visibility", "public")
        .order("effect_score", { ascending: false })
        .limit(limit * 2);

      if (error) {
        throw new Error(`推荐同类目查询失败: ${error.message}`);
      }

      recommended = mergeUniqueRecipes(recommended, (data ?? []) as Recipe[], limit, excludedIds);
    }

    if (recommended.length < limit && starredAuthors.length > 0) {
      const { data, error } = await admin
        .from("recipes")
        .select("*")
        .in("author_id", starredAuthors)
        .eq("status", "published")
        .eq("visibility", "public")
        .order("effect_score", { ascending: false })
        .limit(limit * 2);

      if (error) {
        throw new Error(`推荐作者扩散查询失败: ${error.message}`);
      }

      recommended = mergeUniqueRecipes(recommended, (data ?? []) as Recipe[], limit, excludedIds);
    }

    if (recommended.length < limit && upstreamIds.length > 0) {
      const { data, error } = await admin
        .from("recipes")
        .select("*")
        .in("id", upstreamIds)
        .eq("status", "published")
        .eq("visibility", "public")
        .order("effect_score", { ascending: false })
        .limit(limit * 2);

      if (error) {
        throw new Error(`推荐 Fork 上游查询失败: ${error.message}`);
      }

      recommended = mergeUniqueRecipes(recommended, (data ?? []) as Recipe[], limit, excludedIds);
    }

    if (recommended.length < limit) {
      const fallback = await fetchTrendingRecipes(limit * 2);
      recommended = mergeUniqueRecipes(recommended, fallback, limit, excludedIds);
    }

    const aggregateMap = await buildExecutionAggregateMap(recommended.map((recipe) => recipe.id));
    const enrichedRecipes = recommended.map((recipe) => attachRecipeSignals(recipe, aggregateMap.get(recipe.id)));
    const authorMap = await buildRecipeAuthorMap(enrichedRecipes);

    return successResponse({
      recipes: enrichedRecipes.map((recipe) => ({
        ...recipe,
        author: authorMap.get(recipe.author_id) ?? null,
      })),
    });
  } catch (error: unknown) {
    console.error("GET /api/recipes/recommended failed:", error);
    return errorResponse("获取推荐 Recipe 失败", "INTERNAL_ERROR", 500);
  }
}
