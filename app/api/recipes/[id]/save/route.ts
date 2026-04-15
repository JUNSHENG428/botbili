import { NextResponse } from "next/server";

import { verifyCsrfOrigin } from "@/lib/csrf";
import { createClientForServer, getSupabaseAdminClient } from "@/lib/supabase/server";

interface RouteContext {
  params: Promise<{ id: string }>;
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function resolveRecipeId(identifier: string): Promise<string | null> {
  const admin = getSupabaseAdminClient();
  // 非 UUID 则跳过 id 查询（避免 PostgreSQL 类型错误）
  let byId: { id: string; status: string; visibility: string } | null = null;
  if (UUID_RE.test(identifier)) {
    const { data, error: byIdError } = await admin
      .from("recipes")
      .select("id, status, visibility")
      .eq("id", identifier)
      .maybeSingle();

    if (byIdError) {
      throw new Error(`按 id 查询 Recipe 失败: ${byIdError.message}`);
    }
    byId = data as { id: string; status: string; visibility: string } | null;
  }

  if (byId) {
    if (byId.status !== "published" || byId.visibility === "private") {
      return null;
    }
    return byId.id as string;
  }

  const { data: bySlug, error: bySlugError } = await admin
    .from("recipes")
    .select("id, status, visibility")
    .eq("slug", identifier)
    .maybeSingle();

  if (bySlugError) {
    throw new Error(`按 slug 查询 Recipe 失败: ${bySlugError.message}`);
  }

  if (!bySlug || bySlug.status !== "published" || bySlug.visibility === "private") {
    return null;
  }

  return bySlug.id as string;
}

/**
 * curl -X POST "http://localhost:3000/api/recipes/RECIPE_ID/save" \
 *   -H "Origin: http://localhost:3000"
 */
export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
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

    const recipeId = await resolveRecipeId(id);
    if (!recipeId) {
      return errorResponse("Recipe 不存在", "RECIPE_NOT_FOUND", 404);
    }

    const admin = getSupabaseAdminClient();
    const { data: existing, error: existingError } = await admin
      .from("recipe_saves")
      .select("id")
      .eq("recipe_id", recipeId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingError) {
      throw new Error(`读取 Save 状态失败: ${existingError.message}`);
    }

    let saved = false;

    if (existing) {
      const { error } = await admin.from("recipe_saves").delete().eq("id", existing.id);
      if (error) {
        throw new Error(`取消 Save 失败: ${error.message}`);
      }
    } else {
      const { error } = await admin.from("recipe_saves").insert({ recipe_id: recipeId, user_id: user.id });
      if (error) {
        throw new Error(`添加 Save 失败: ${error.message}`);
      }
      saved = true;
    }

    const { data: recipe, error: recipeError } = await admin
      .from("recipes")
      .select("save_count")
      .eq("id", recipeId)
      .single();

    if (recipeError) {
      throw new Error(`读取最新 save_count 失败: ${recipeError.message}`);
    }

    return successResponse({
      saved,
      save_count: recipe.save_count ?? 0,
    });
  } catch (error: unknown) {
    console.error("POST /api/recipes/[id]/save failed:", error);
    return errorResponse("切换收藏状态失败", "INTERNAL_ERROR", 500);
  }
}
