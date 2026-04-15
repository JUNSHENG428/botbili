import { after, NextResponse } from "next/server";

import { verifyCsrfOrBearer } from "@/lib/csrf";
import { resolveUser } from "@/lib/executions/resolveUser";
import { calculateRecipeTrendingScore } from "@/lib/recipes";
import { calculateRecipeScore } from "@/lib/recipe-stats";
import { buildRecipeAuthorMap } from "@/lib/recipe-authors";
import { awardPoints } from "@/lib/reputation";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { Recipe } from "@/types/recipe";

type RecipeSort = "trending" | "newest" | "most_starred" | "most_forked" | "most_executed";
type RecipeVisibility = "public" | "unlisted" | "private";
type RecipeAuthorType = "human" | "ai_agent";
type RecipeDifficulty = "beginner" | "intermediate" | "advanced";

interface RecipeAuthorSummary {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  author_type: RecipeAuthorType;
}

interface RecipeListItem extends Recipe {
  author: RecipeAuthorSummary;
}

interface RecipeExecutionSignalRow {
  recipe_id: string;
  status: string;
  created_at: string;
  output_external_url: string | null;
}

interface RecipeExecutionAggregate {
  completedExecutionCount: number;
  outputCount: number;
  recentExecutionCount: number;
}

const VALID_SORTS: RecipeSort[] = ["trending", "newest", "most_starred", "most_forked", "most_executed"];
const VALID_DIFFICULTIES: RecipeDifficulty[] = ["beginner", "intermediate", "advanced"];
const VALID_VISIBILITIES: RecipeVisibility[] = ["public", "unlisted", "private"];
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

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

function parsePositiveInteger(rawValue: string | null, fallback: number, max?: number): number | null {
  if (rawValue === null || rawValue === "") {
    return fallback;
  }

  const value = Number.parseInt(rawValue, 10);
  if (Number.isNaN(value) || value < 1) {
    return null;
  }

  if (typeof max === "number") {
    return Math.min(value, max);
  }

  return value;
}

function normalizePlatforms(searchParams: URLSearchParams): string[] {
  const rawValues = searchParams
    .getAll("platforms")
    .flatMap((value) => value.split(","))
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return [...new Set(rawValues)];
}

function getRecipePlatforms(recipe: Recipe): string[] {
  const nextPlatforms = Array.isArray(recipe.platforms) ? recipe.platforms : [];
  const legacyPlatforms = Array.isArray(recipe.platform) ? recipe.platform : [];
  const merged = nextPlatforms.length > 0 ? nextPlatforms : legacyPlatforms;

  return merged.map((value) => value.toLowerCase());
}

function slugifyTitle(title: string): string {
  const normalized = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "recipe";
}

async function generateUniqueSlug(title: string): Promise<string> {
  const admin = getSupabaseAdminClient();
  const base = slugifyTitle(title);

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const suffix = Math.random().toString(36).slice(2, 6);
    const slug = `${base}-${suffix}`;
    const { data, error } = await admin
      .from("recipes")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (error) {
      throw new Error(`slug lookup failed: ${error.message}`);
    }

    if (!data) {
      return slug;
    }
  }

  throw new Error("生成唯一 slug 失败");
}

async function buildAuthorMap(recipes: Recipe[]): Promise<Map<string, RecipeAuthorSummary>> {
  return buildRecipeAuthorMap(recipes);
}

async function buildExecutionAggregateMap(recipeIds: string[]): Promise<Map<string, RecipeExecutionAggregate>> {
  const nextRecipeIds = [...new Set(recipeIds.filter(Boolean))];
  if (nextRecipeIds.length === 0) {
    return new Map();
  }

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("recipe_executions")
    .select("recipe_id, status, created_at, output_external_url")
    .in("recipe_id", nextRecipeIds)
    .returns<RecipeExecutionSignalRow[]>();

  if (error) {
    throw new Error(`recipe execution aggregate lookup failed: ${error.message}`);
  }

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const aggregateMap = new Map<string, RecipeExecutionAggregate>();

  for (const recipeId of nextRecipeIds) {
    aggregateMap.set(recipeId, {
      completedExecutionCount: 0,
      outputCount: 0,
      recentExecutionCount: 0,
    });
  }

  for (const row of data ?? []) {
    if (row.status === "cancelled") {
      continue;
    }

    const aggregate = aggregateMap.get(row.recipe_id);
    if (!aggregate) {
      continue;
    }

    if (row.status === "success" || row.status === "completed") {
      aggregate.completedExecutionCount += 1;
    }

    if (typeof row.output_external_url === "string" && row.output_external_url.trim().length > 0) {
      aggregate.outputCount += 1;
    }

    const timestamp = new Date(row.created_at).getTime();
    if (Number.isFinite(timestamp) && timestamp >= sevenDaysAgo) {
      aggregate.recentExecutionCount += 1;
    }
  }

  return aggregateMap;
}

function enrichRecipe(recipe: Recipe, aggregate?: RecipeExecutionAggregate): Recipe {
  const outputCount = aggregate?.outputCount ?? recipe.output_count ?? 0;
  const recentExecutionCount = aggregate?.recentExecutionCount ?? recipe.recent_execution_count ?? 0;

  return {
    ...recipe,
    completed_execution_count: aggregate?.completedExecutionCount ?? recipe.completed_execution_count ?? 0,
    output_count: outputCount,
    recent_execution_count: recentExecutionCount,
    effect_score: calculateRecipeScore({
      starCount: recipe.star_count ?? 0,
      forkCount: recipe.fork_count ?? 0,
      executionCount: recipe.execution_count ?? recipe.exec_count ?? 0,
      successRate: Number(recipe.success_rate ?? 0),
      outputCount,
      recentExecutionCount,
    }),
  };
}

/**
 * curl "http://localhost:3000/api/recipes?sort=trending&limit=20"
 * curl -X POST "http://localhost:3000/api/recipes" \
 *   -H "Content-Type: application/json" \
 *   -H "Origin: http://localhost:3000" \
 *   -d '{"title":"AI 行业热点日报","description":"适合新手的公开视频 Recipe"}'
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);

    const sort = (searchParams.get("sort") ?? "trending") as RecipeSort;
    const q = searchParams.get("q")?.trim().toLowerCase() ?? "";
    const category = searchParams.get("category")?.trim() ?? "";
    const difficulty = searchParams.get("difficulty")?.trim() ?? "";
    const tag = searchParams.get("tag")?.trim() ?? "";
    const forkedFrom = searchParams.get("forked_from")?.trim() ?? "";
    const page = parsePositiveInteger(searchParams.get("page"), DEFAULT_PAGE);
    const limit = parsePositiveInteger(searchParams.get("limit"), DEFAULT_LIMIT, MAX_LIMIT);
    const platforms = normalizePlatforms(searchParams);

    if (!VALID_SORTS.includes(sort)) {
      return errorResponse("不支持的排序方式", "INVALID_SORT", 400);
    }

    if (page === null) {
      return errorResponse("page 必须是大于 0 的整数", "INVALID_PAGE", 400);
    }

    if (limit === null) {
      return errorResponse("limit 必须是大于 0 的整数", "INVALID_LIMIT", 400);
    }

    if (difficulty && !VALID_DIFFICULTIES.includes(difficulty as RecipeDifficulty)) {
      return errorResponse("不支持的难度类型", "INVALID_DIFFICULTY", 400);
    }

    const admin = getSupabaseAdminClient();
    const start = (page - 1) * limit;
    const end = start + limit - 1;
    let pagedRecipes: Recipe[];
    let total: number;

    if (sort === "trending") {
      // 后续可改为预计算 trending_score 列；当前先限制候选集，避免无上限内存排序。
      let trendingQuery = admin
        .from("recipes")
        .select("*")
        .eq("status", "published")
        .eq("visibility", "public")
        .limit(200);

      if (category) {
        trendingQuery = trendingQuery.eq("category", category);
      }

      if (difficulty) {
        trendingQuery = trendingQuery.eq("difficulty", difficulty);
      }

      if (q) {
        trendingQuery = trendingQuery.ilike("title", `%${q}%`);
      }

      if (tag) {
        trendingQuery = trendingQuery.contains("tags", [tag]);
      }

      if (forkedFrom) {
        trendingQuery = trendingQuery.or(`forked_from_id.eq.${forkedFrom},forked_from.eq.${forkedFrom}`);
      }

      if (platforms.length > 0) {
        trendingQuery = trendingQuery.contains("platforms", platforms);
      }

      const { data, error } = await trendingQuery;

      if (error) {
        throw new Error(`加载 Recipe 列表失败: ${error.message}`);
      }

      const candidateRecipes = (data ?? []) as Recipe[];
      const aggregateMap = await buildExecutionAggregateMap(candidateRecipes.map((recipe) => recipe.id));

      // 排序：featured 置顶，然后是 trending score
      const sortedRecipes = candidateRecipes.sort((left, right) => {
        const featuredDiff = Number(right.is_featured ?? 0) - Number(left.is_featured ?? 0);
        if (featuredDiff !== 0) return featuredDiff;

        const leftAggregate = aggregateMap.get(left.id);
        const rightAggregate = aggregateMap.get(right.id);
        const leftScore = calculateRecipeScore({
          starCount: left.star_count ?? 0,
          forkCount: left.fork_count ?? 0,
          executionCount: left.execution_count ?? left.exec_count ?? 0,
          successRate: Number(left.success_rate ?? 0),
          outputCount: leftAggregate?.outputCount ?? 0,
          recentExecutionCount: leftAggregate?.recentExecutionCount ?? 0,
        });
        const rightScore = calculateRecipeScore({
          starCount: right.star_count ?? 0,
          forkCount: right.fork_count ?? 0,
          executionCount: right.execution_count ?? right.exec_count ?? 0,
          successRate: Number(right.success_rate ?? 0),
          outputCount: rightAggregate?.outputCount ?? 0,
          recentExecutionCount: rightAggregate?.recentExecutionCount ?? 0,
        });

        if (rightScore !== leftScore) {
          return rightScore - leftScore;
        }

        const outputDiff = (rightAggregate?.outputCount ?? 0) - (leftAggregate?.outputCount ?? 0);
        if (outputDiff !== 0) {
          return outputDiff;
        }

        return calculateRecipeTrendingScore(right) - calculateRecipeTrendingScore(left);
      });

      total = sortedRecipes.length;
      pagedRecipes = sortedRecipes
        .slice(start, start + limit)
        .map((recipe) => enrichRecipe(recipe, aggregateMap.get(recipe.id)));
    } else {
      const sortColumns: Record<Exclude<RecipeSort, "trending">, { column: keyof Recipe; ascending: boolean }> = {
        newest: { column: "created_at", ascending: false },
        most_starred: { column: "star_count", ascending: false },
        most_forked: { column: "fork_count", ascending: false },
        most_executed: { column: "execution_count", ascending: false },
      };
      const sortColumn = sortColumns[sort];

      let query = admin
        .from("recipes")
        .select("*", { count: "exact" })
        .eq("status", "published")
        .eq("visibility", "public");

      if (category) {
        query = query.eq("category", category);
      }

      if (difficulty) {
        query = query.eq("difficulty", difficulty);
      }

      if (q) {
        query = query.ilike("title", `%${q}%`);
      }

      if (tag) {
        query = query.contains("tags", [tag]);
      }

      if (forkedFrom) {
        query = query.or(`forked_from_id.eq.${forkedFrom},forked_from.eq.${forkedFrom}`);
      }

      if (platforms.length > 0) {
        query = query.contains("platforms", platforms);
      }

      const { data, error, count } = await query
        .order("is_featured", { ascending: false })
        .order(sortColumn.column, { ascending: sortColumn.ascending })
        .range(start, end);

      if (error) {
        throw new Error(`加载 Recipe 列表失败: ${error.message}`);
      }

      pagedRecipes = (data ?? []) as Recipe[];
      total = count ?? pagedRecipes.length;
    }

    if (sort !== "trending") {
      const aggregateMap = await buildExecutionAggregateMap(pagedRecipes.map((recipe) => recipe.id));
      pagedRecipes = pagedRecipes.map((recipe) => enrichRecipe(recipe, aggregateMap.get(recipe.id)));
    }

    const authorMap = await buildAuthorMap(pagedRecipes);

    const recipeItems: RecipeListItem[] = pagedRecipes.map((recipe) => ({
      ...recipe,
      platforms: getRecipePlatforms(recipe),
      author: authorMap.get(recipe.author_id) ?? {
        id: recipe.author_id,
        username: `user-${recipe.author_id.slice(0, 8)}`,
        display_name: null,
        avatar_url: null,
        author_type: recipe.author_type,
      },
    }));

    return successResponse({
      recipes: recipeItems,
      total,
      page,
      limit,
      hasMore: start + limit < total,
    });
  } catch (error: unknown) {
    console.error("GET /api/recipes failed:", error);
    return errorResponse("获取 Recipe 列表失败", "INTERNAL_ERROR", 500);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  // P14: api-key-auth
  if (!verifyCsrfOrBearer(request)) {
    return errorResponse("请求来源校验失败", "CSRF_INVALID", 403);
  }

  try {
    const resolved = await resolveUser(request.headers.get("Authorization"));
    if (!resolved) return errorResponse("请先登录或提供有效 API Key", "UNAUTHORIZED", 401);
    const userId = resolved.userId;

    let body: {
      title?: string;
      description?: string;
      visibility?: RecipeVisibility;
    };

    try {
      body = (await request.json()) as {
        title?: string;
        description?: string;
        visibility?: RecipeVisibility;
      };
    } catch {
      return errorResponse("请求体不是合法 JSON", "INVALID_JSON", 400);
    }

    const title = body.title?.trim();
    if (!title) {
      return errorResponse("title 为必填项", "TITLE_REQUIRED", 400);
    }

    if (title.length > 200) {
      return errorResponse("title 不能超过 200 个字符", "TITLE_TOO_LONG", 400);
    }

    const description = typeof body.description === "string" ? body.description.trim() : null;
    if (description && description.length > 500) {
      return errorResponse("description 不能超过 500 个字符", "DESCRIPTION_TOO_LONG", 400);
    }

    if (body.visibility && !VALID_VISIBILITIES.includes(body.visibility)) {
      return errorResponse("visibility 不合法", "INVALID_VISIBILITY", 400);
    }

    const slug = await generateUniqueSlug(title);
    const admin = getSupabaseAdminClient();
    
    // author_type 判断：API Key 鉴权时（creatorId !== null）设为 "ai_agent"，否则检查 header
    const authorType: RecipeAuthorType =
      resolved.creatorId !== null || request.headers.get("x-botbili-client") === "agent"
        ? "ai_agent"
        : "human";

    const insertPayload = {
      author_id: userId,
      author_type: authorType,
      slug,
      title,
      description,
      visibility: body.visibility ?? "public",
      status: "draft",
      readme_md: null,
      readme_json: null,
      tags: [],
      difficulty: "beginner",
      platform: [],
      platforms: [],
      language: "zh-CN",
      cover_url: null,
      script_template: null,
      storyboard: null,
      matrix_config: null,
      tools_required: [],
    };

    const { data, error } = await admin
      .from("recipes")
      .insert(insertPayload)
      .select("*")
      .single();

    if (error) {
      throw new Error(`创建 Recipe 失败: ${error.message}`);
    }

    after(async () => {
      try {
        await awardPoints(userId, 10, "recipe_created", data.id);
      } catch (awardError) {
        console.error("POST /api/recipes awardPoints failed:", awardError);
      }
    });

    return successResponse({ recipe: data as Recipe }, 201);
  } catch (error: unknown) {
    console.error("POST /api/recipes failed:", error);
    return errorResponse("创建 Recipe 失败", "INTERNAL_ERROR", 500);
  }
}
