import { NextResponse } from "next/server";

import { verifyCsrfOrBearer } from "@/lib/csrf";
import { resolveUser } from "@/lib/executions/resolveUser";
import { calculateRecipeTrendingScore } from "@/lib/recipes";
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

interface ProfileRow {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

interface CreatorRow {
  id: string;
  owner_id: string;
  slug: string | null;
  name: string;
  avatar_url: string | null;
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
  const authorIds = [...new Set(recipes.map((recipe) => recipe.author_id))];
  const authorMap = new Map<string, RecipeAuthorSummary>();

  if (authorIds.length === 0) {
    return authorMap;
  }

  const admin = getSupabaseAdminClient();

  const [{ data: profileRows, error: profileError }, { data: creatorRows, error: creatorError }] = await Promise.all([
    admin.from("profiles").select("id, username, display_name, avatar_url").in("id", authorIds),
    admin.from("creators").select("id, owner_id, slug, name, avatar_url").in("owner_id", authorIds),
  ]);

  if (profileError) {
    throw new Error(`加载作者资料失败: ${profileError.message}`);
  }

  if (creatorError) {
    throw new Error(`加载创作者资料失败: ${creatorError.message}`);
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

  for (const recipe of recipes) {
    if (authorMap.has(recipe.author_id)) {
      continue;
    }

    const profile = profileMap.get(recipe.author_id);
    const creator = creatorMap.get(recipe.author_id);

    const username =
      profile?.username?.trim() ||
      creator?.slug?.trim() ||
      profile?.display_name?.trim()?.toLowerCase().replace(/\s+/g, "-") ||
      `user-${recipe.author_id.slice(0, 8)}`;

    authorMap.set(recipe.author_id, {
      id: recipe.author_id,
      username,
      display_name: profile?.display_name ?? creator?.name ?? null,
      avatar_url: profile?.avatar_url ?? creator?.avatar_url ?? null,
      author_type: recipe.author_type,
    });
  }

  return authorMap;
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

      if (platforms.length > 0) {
        trendingQuery = trendingQuery.contains("platforms", platforms);
      }

      const { data, error } = await trendingQuery;

      if (error) {
        throw new Error(`加载 Recipe 列表失败: ${error.message}`);
      }

      // 排序：featured 置顶，然后是 trending score
      const sortedRecipes = ((data ?? []) as Recipe[]).sort((left, right) => {
        const featuredDiff = Number(right.is_featured ?? 0) - Number(left.is_featured ?? 0);
        if (featuredDiff !== 0) return featuredDiff;
        return calculateRecipeTrendingScore(right) - calculateRecipeTrendingScore(left);
      });

      total = sortedRecipes.length;
      pagedRecipes = sortedRecipes.slice(start, start + limit);
    } else {
      const sortColumns: Record<Exclude<RecipeSort, "trending">, { column: keyof Recipe; ascending: boolean }> = {
        newest: { column: "created_at", ascending: false },
        most_starred: { column: "star_count", ascending: false },
        most_forked: { column: "fork_count", ascending: false },
        most_executed: { column: "exec_count", ascending: false },
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

    return successResponse({ recipe: data as Recipe }, 201);
  } catch (error: unknown) {
    console.error("POST /api/recipes failed:", error);
    return errorResponse("创建 Recipe 失败", "INTERNAL_ERROR", 500);
  }
}
