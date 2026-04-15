import { NextResponse } from "next/server";

import { normalizeExecutionOutput } from "@/lib/executions/normalizeExecutionOutput";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { Recipe, RecipeExecutionOutput, RecipeOutputExample } from "@/types/recipe";

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface RecipeVisibilityRow extends Pick<Recipe, "id" | "status" | "visibility"> {}

interface RecipeOutputExecutionRow {
  id: string;
  recipe_id: string;
  output: RecipeExecutionOutput | null;
  output_external_url: string | null;
  output_thumbnail_url: string | null;
  output_platform: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
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

async function resolveRecipe(identifier: string): Promise<RecipeVisibilityRow | null> {
  const admin = getSupabaseAdminClient();
  const { data: byId, error: byIdError } = await admin
    .from("recipes")
    .select("id, status, visibility")
    .eq("id", identifier)
    .maybeSingle<RecipeVisibilityRow>();

  if (byIdError) {
    throw new Error(`按 id 查询 Recipe 失败: ${byIdError.message}`);
  }

  if (byId) {
    return byId;
  }

  const { data: bySlug, error: bySlugError } = await admin
    .from("recipes")
    .select("id, status, visibility")
    .eq("slug", identifier)
    .maybeSingle<RecipeVisibilityRow>();

  if (bySlugError) {
    throw new Error(`按 slug 查询 Recipe 失败: ${bySlugError.message}`);
  }

  return bySlug ?? null;
}

/**
 * curl "http://localhost:3000/api/recipes/RECIPE_ID/outputs?limit=6"
 */
export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    if (!id) {
      return errorResponse("Recipe 标识不能为空", "INVALID_RECIPE_ID", 400);
    }

    const { searchParams } = new URL(request.url);
    const limit = parseLimit(searchParams.get("limit"));
    const recipe = await resolveRecipe(id);

    if (!recipe || recipe.status !== "published" || recipe.visibility === "private") {
      return errorResponse("Recipe 不存在", "RECIPE_NOT_FOUND", 404);
    }

    const admin = getSupabaseAdminClient();
    const [rowsResult, countResult] = await Promise.all([
      admin
        .from("recipe_executions")
        .select(
          "id, recipe_id, output, output_external_url, output_thumbnail_url, output_platform, completed_at, created_at, updated_at",
        )
        .eq("recipe_id", recipe.id)
        .in("status", ["success", "completed"])
        .not("output_external_url", "is", null)
        .order("completed_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(limit)
        .returns<RecipeOutputExecutionRow[]>(),
      admin
        .from("recipe_executions")
        .select("id", { count: "exact", head: true })
        .eq("recipe_id", recipe.id)
        .in("status", ["success", "completed"])
        .not("output_external_url", "is", null),
    ]);

    if (rowsResult.error) {
      throw new Error(`读取执行示例输出失败: ${rowsResult.error.message}`);
    }

    if (countResult.error) {
      throw new Error(`统计执行示例输出失败: ${countResult.error.message}`);
    }

    const items: RecipeOutputExample[] = [];
    for (const row of rowsResult.data ?? []) {
      const output = normalizeExecutionOutput(row, "执行产出");
      if (!output) {
        continue;
      }

      items.push({
        id: row.id,
        recipe_id: row.recipe_id,
        execution_id: row.id,
        title: output.title,
        platform: output.platform,
        video_url: output.video_url,
        thumbnail_url: output.thumbnail_url,
        gif_url: output.gif_url,
        published_at: output.published_at,
        completed_at: row.completed_at,
        created_at: row.created_at,
      });
    }

    return successResponse({
      items,
      total: countResult.count ?? items.length,
    });
  } catch (error: unknown) {
    console.error("GET /api/recipes/[id]/outputs failed:", error);
    return errorResponse("获取执行示例输出失败", "INTERNAL_ERROR", 500);
  }
}
