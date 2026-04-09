import { NextResponse } from "next/server";

import { verifyCsrfOrigin } from "@/lib/csrf";
import { createClientForServer, getSupabaseAdminClient } from "@/lib/supabase/server";
import type { Recipe } from "@/types/recipe";

type RecipeVisibility = "public" | "unlisted" | "private";
type RecipeDifficulty = "beginner" | "intermediate" | "advanced";

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface RecipeAuthorSummary {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  author_type: Recipe["author_type"];
}

interface RecipeExecutionOutput {
  id: string;
  output_external_url: string | null;
  output_thumbnail_url: string | null;
  output_platform: string | null;
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

const VALID_STATUSES = ["draft", "published", "archived"] as const;
const VALID_VISIBILITIES: RecipeVisibility[] = ["public", "unlisted", "private"];
const VALID_DIFFICULTIES: RecipeDifficulty[] = ["beginner", "intermediate", "advanced"];

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

function getRecipePlatforms(recipe: Recipe): string[] {
  const nextPlatforms = Array.isArray(recipe.platforms) ? recipe.platforms : [];
  const legacyPlatforms = Array.isArray(recipe.platform) ? recipe.platform : [];
  return nextPlatforms.length > 0 ? nextPlatforms : legacyPlatforms;
}

async function resolveRecipe(identifier: string): Promise<Recipe | null> {
  const admin = getSupabaseAdminClient();

  const { data: byId, error: byIdError } = await admin
    .from("recipes")
    .select("*")
    .eq("id", identifier)
    .maybeSingle();

  if (byIdError) {
    throw new Error(`按 id 查询 Recipe 失败: ${byIdError.message}`);
  }

  if (byId) {
    return byId as Recipe;
  }

  const { data: bySlug, error: bySlugError } = await admin
    .from("recipes")
    .select("*")
    .eq("slug", identifier)
    .maybeSingle();

  if (bySlugError) {
    throw new Error(`按 slug 查询 Recipe 失败: ${bySlugError.message}`);
  }

  return (bySlug as Recipe | null) ?? null;
}

async function buildAuthor(recipe: Recipe): Promise<RecipeAuthorSummary> {
  const admin = getSupabaseAdminClient();
  const [{ data: profile, error: profileError }, { data: creator, error: creatorError }] = await Promise.all([
    admin
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .eq("id", recipe.author_id)
      .maybeSingle(),
    admin
      .from("creators")
      .select("owner_id, slug, name, avatar_url")
      .eq("owner_id", recipe.author_id)
      .limit(1)
      .maybeSingle(),
  ]);

  if (profileError) {
    throw new Error(`加载作者 profile 失败: ${profileError.message}`);
  }

  if (creatorError) {
    throw new Error(`加载作者 creator 失败: ${creatorError.message}`);
  }

  const profileRow = profile as ProfileRow | null;
  const creatorRow = creator as CreatorRow | null;

  return {
    id: recipe.author_id,
    username:
      profileRow?.username?.trim() ||
      creatorRow?.slug?.trim() ||
      profileRow?.display_name?.trim()?.toLowerCase().replace(/\s+/g, "-") ||
      `user-${recipe.author_id.slice(0, 8)}`,
    display_name: profileRow?.display_name ?? creatorRow?.name ?? null,
    avatar_url: profileRow?.avatar_url ?? creatorRow?.avatar_url ?? null,
    author_type: recipe.author_type,
  };
}

async function getViewerState(recipeId: string, userId?: string): Promise<{ starred: boolean; saved: boolean }> {
  if (!userId) {
    return { starred: false, saved: false };
  }

  const admin = getSupabaseAdminClient();
  const [{ data: starRow, error: starError }, { data: saveRow, error: saveError }] = await Promise.all([
    admin
      .from("recipe_stars")
      .select("id")
      .eq("recipe_id", recipeId)
      .eq("user_id", userId)
      .maybeSingle(),
    admin
      .from("recipe_saves")
      .select("id")
      .eq("recipe_id", recipeId)
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  if (starError) {
    throw new Error(`读取 star 状态失败: ${starError.message}`);
  }

  if (saveError) {
    throw new Error(`读取 save 状态失败: ${saveError.message}`);
  }

  return {
    starred: Boolean(starRow),
    saved: Boolean(saveRow),
  };
}

async function getRecentExecutions(recipeId: string): Promise<RecipeExecutionOutput[]> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("recipe_executions")
    .select("id, output_external_url, output_thumbnail_url, output_platform, created_at")
    .eq("recipe_id", recipeId)
    .eq("status", "success")
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    throw new Error(`读取执行记录失败: ${error.message}`);
  }

  return (data ?? []) as RecipeExecutionOutput[];
}

function canViewRecipe(recipe: Recipe, viewerUserId?: string): boolean {
  if (viewerUserId && recipe.author_id === viewerUserId) {
    return true;
  }

  return recipe.status === "published" && recipe.visibility !== "private";
}

function normalizePatchValue(value: unknown): unknown {
  if (value === undefined) {
    return undefined;
  }

  return value;
}

/**
 * curl "http://localhost:3000/api/recipes/RECIPE_ID"
 * curl -X PATCH "http://localhost:3000/api/recipes/RECIPE_ID" \
 *   -H "Content-Type: application/json" \
 *   -H "Origin: http://localhost:3000" \
 *   -d '{"status":"published","visibility":"public"}'
 */
export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    if (!id) {
      return errorResponse("Recipe 标识不能为空", "INVALID_RECIPE_ID", 400);
    }

    const supabase = await createClientForServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const recipe = await resolveRecipe(id);
    if (!recipe || !canViewRecipe(recipe, user?.id)) {
      return errorResponse("Recipe 不存在", "RECIPE_NOT_FOUND", 404);
    }

    const [author, viewerState, recentExecutions] = await Promise.all([
      buildAuthor(recipe),
      getViewerState(recipe.id, user?.id),
      getRecentExecutions(recipe.id),
    ]);

    return successResponse({
      recipe: {
        ...recipe,
        platforms: getRecipePlatforms(recipe),
        author,
      },
      viewer: viewerState,
      recent_executions: recentExecutions,
    });
  } catch (error: unknown) {
    console.error("GET /api/recipes/[id] failed:", error);
    return errorResponse("获取 Recipe 详情失败", "INTERNAL_ERROR", 500);
  }
}

export async function PATCH(request: Request, context: RouteContext): Promise<NextResponse> {
  if (!verifyCsrfOrigin(request)) {
    return errorResponse("请求来源校验失败", "CSRF_INVALID", 403);
  }

  try {
    const { id } = await context.params;
    if (!id) {
      return errorResponse("Recipe 标识不能为空", "INVALID_RECIPE_ID", 400);
    }

    const supabase = await createClientForServer();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse("请先登录", "UNAUTHORIZED", 401);
    }

    const recipe = await resolveRecipe(id);
    if (!recipe) {
      return errorResponse("Recipe 不存在", "RECIPE_NOT_FOUND", 404);
    }

    if (recipe.author_id !== user.id) {
      return errorResponse("只有作者可以修改 Recipe", "FORBIDDEN", 403);
    }

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return errorResponse("请求体不是合法 JSON", "INVALID_JSON", 400);
    }

    const patch: Record<string, unknown> = {};

    if ("title" in body) {
      const title = typeof body.title === "string" ? body.title.trim() : "";
      if (!title) {
        return errorResponse("title 不能为空", "TITLE_REQUIRED", 400);
      }
      if (title.length > 200) {
        return errorResponse("title 不能超过 200 个字符", "TITLE_TOO_LONG", 400);
      }
      patch.title = title;
    }

    if ("description" in body) {
      const description = body.description;
      if (description !== null && typeof description !== "string") {
        return errorResponse("description 类型不合法", "INVALID_DESCRIPTION", 400);
      }
      if (typeof description === "string" && description.trim().length > 500) {
        return errorResponse("description 不能超过 500 个字符", "DESCRIPTION_TOO_LONG", 400);
      }
      patch.description = typeof description === "string" ? description.trim() : null;
    }

    if ("readme_json" in body) {
      const readmeJson = normalizePatchValue(body.readme_json);
      if (
        readmeJson !== null &&
        typeof readmeJson !== "string" &&
        (typeof readmeJson !== "object" || Array.isArray(readmeJson))
      ) {
        return errorResponse("readme_json 类型不合法", "INVALID_README_JSON", 400);
      }
      patch.readme_json = readmeJson ?? null;
    }

    if ("script_template" in body) {
      const scriptTemplate = normalizePatchValue(body.script_template);
      if (
        scriptTemplate !== null &&
        (typeof scriptTemplate !== "object" || Array.isArray(scriptTemplate))
      ) {
        return errorResponse("script_template 类型不合法", "INVALID_SCRIPT_TEMPLATE", 400);
      }
      patch.script_template = scriptTemplate ?? null;
    }

    if ("matrix_config" in body) {
      const matrixConfig = normalizePatchValue(body.matrix_config);
      if (
        matrixConfig !== null &&
        (typeof matrixConfig !== "object" || Array.isArray(matrixConfig))
      ) {
        return errorResponse("matrix_config 类型不合法", "INVALID_MATRIX_CONFIG", 400);
      }
      patch.matrix_config = matrixConfig ?? null;
    }

    if ("status" in body) {
      const status = body.status;
      if (typeof status !== "string" || !VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
        return errorResponse("status 不合法", "INVALID_STATUS", 400);
      }
      patch.status = status;
    }

    if ("visibility" in body) {
      const visibility = body.visibility;
      if (typeof visibility !== "string" || !VALID_VISIBILITIES.includes(visibility as RecipeVisibility)) {
        return errorResponse("visibility 不合法", "INVALID_VISIBILITY", 400);
      }
      patch.visibility = visibility;
    }

    if ("category" in body) {
      const category = body.category;
      if (category !== null && typeof category !== "string") {
        return errorResponse("category 类型不合法", "INVALID_CATEGORY", 400);
      }
      patch.category = typeof category === "string" ? category.trim() : null;
    }

    if ("difficulty" in body) {
      const difficulty = body.difficulty;
      if (typeof difficulty !== "string" || !VALID_DIFFICULTIES.includes(difficulty as RecipeDifficulty)) {
        return errorResponse("difficulty 不合法", "INVALID_DIFFICULTY", 400);
      }
      patch.difficulty = difficulty;
    }

    if ("platforms" in body) {
      if (!Array.isArray(body.platforms) || body.platforms.some((item) => typeof item !== "string")) {
        return errorResponse("platforms 必须是字符串数组", "INVALID_PLATFORMS", 400);
      }

      const normalizedPlatforms = [...new Set(body.platforms.map((item) => item.trim()).filter(Boolean))];
      patch.platforms = normalizedPlatforms;
      patch.platform = normalizedPlatforms;
    }

    if (Object.keys(patch).length === 0) {
      return errorResponse("没有可更新的字段", "EMPTY_PATCH", 400);
    }

    const admin = getSupabaseAdminClient();
    const { data, error } = await admin
      .from("recipes")
      .update(patch)
      .eq("id", recipe.id)
      .select("*")
      .single();

    if (error) {
      throw new Error(`更新 Recipe 失败: ${error.message}`);
    }

    const updatedRecipe = data as Recipe;

    return successResponse({
      recipe: {
        ...updatedRecipe,
        platforms: getRecipePlatforms(updatedRecipe),
      },
    });
  } catch (error: unknown) {
    console.error("PATCH /api/recipes/[id] failed:", error);
    return errorResponse("更新 Recipe 失败", "INTERNAL_ERROR", 500);
  }
}
