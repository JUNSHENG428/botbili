import { NextResponse } from "next/server";

import { buildRecipeAuthorMap } from "@/lib/recipe-authors";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { Recipe } from "@/types/recipe";

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface ForkRelationRow {
  forked_recipe_id: string;
  created_at: string;
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

async function resolveRecipeId(identifier: string): Promise<string | null> {
  const admin = getSupabaseAdminClient();
  const { data: byId, error: byIdError } = await admin
    .from("recipes")
    .select("id")
    .eq("id", identifier)
    .maybeSingle();

  if (byIdError) {
    throw new Error(`按 id 查询 Recipe 失败: ${byIdError.message}`);
  }

  if (byId) {
    return byId.id as string;
  }

  const { data: bySlug, error: bySlugError } = await admin
    .from("recipes")
    .select("id")
    .eq("slug", identifier)
    .maybeSingle();

  if (bySlugError) {
    throw new Error(`按 slug 查询 Recipe 失败: ${bySlugError.message}`);
  }

  return (bySlug?.id as string | undefined) ?? null;
}

/**
 * curl "http://localhost:3000/api/recipes/RECIPE_ID/forks"
 */
export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    if (!id) {
      return errorResponse("Recipe 标识不能为空", "INVALID_RECIPE_ID", 400);
    }

    const recipeId = await resolveRecipeId(id);
    if (!recipeId) {
      return errorResponse("Recipe 不存在", "RECIPE_NOT_FOUND", 404);
    }

    const admin = getSupabaseAdminClient();
    const { data: relationRows, error: relationError } = await admin
      .from("recipe_forks")
      .select("forked_recipe_id, created_at")
      .eq("original_recipe_id", recipeId)
      .order("created_at", { ascending: false })
      .returns<ForkRelationRow[]>();

    if (relationError) {
      throw new Error(`读取 Fork 关系失败: ${relationError.message}`);
    }

    const forkIds = (relationRows ?? []).map((row) => row.forked_recipe_id);
    if (forkIds.length === 0) {
      return successResponse({ items: [], total: 0 });
    }

    const { data: forkRows, error: forkError } = await admin
      .from("recipes")
      .select("*")
      .in("id", forkIds)
      .eq("status", "published")
      .eq("visibility", "public");

    if (forkError) {
      throw new Error(`读取 Fork Recipe 失败: ${forkError.message}`);
    }

    const forks = (forkRows ?? []) as Recipe[];
    const relationIndex = new Map(
      (relationRows ?? []).map((row, index) => [row.forked_recipe_id, index]),
    );
    const sortedForks = forks.sort(
      (left, right) => (relationIndex.get(left.id) ?? 9999) - (relationIndex.get(right.id) ?? 9999),
    );
    const authorMap = await buildRecipeAuthorMap(sortedForks);

    return successResponse({
      items: sortedForks.slice(0, 6).map((recipe) => ({
        ...recipe,
        author: authorMap.get(recipe.author_id) ?? null,
      })),
      total: sortedForks.length,
    });
  } catch (error: unknown) {
    console.error("GET /api/recipes/[id]/forks failed:", error);
    return errorResponse("获取 Fork 家族失败", "INTERNAL_ERROR", 500);
  }
}
