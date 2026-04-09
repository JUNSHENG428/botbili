import { NextResponse } from "next/server";

import { verifyCsrfOrigin } from "@/lib/csrf";
import { startRecipeExecution } from "@/lib/executions/openclaw";
import { updateExecutionById } from "@/lib/executions/updateExecution";
import { createClientForServer, getSupabaseAdminClient } from "@/lib/supabase/server";
import type { Recipe } from "@/types/recipe";

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

async function insertAnalyticsEvent(payload: {
  event_name: "recipe_execute_success" | "recipe_execute_failed";
  user_id: string;
  recipe_id: string;
  execution_id: string;
  error?: string;
}): Promise<void> {
  try {
    const admin = getSupabaseAdminClient();
    await admin.from("analytics_events").insert({
      event_name: payload.event_name,
      user_id: payload.user_id,
      properties: {
        recipe_id: payload.recipe_id,
        execution_id: payload.execution_id,
        ...(payload.error ? { error: payload.error } : {}),
      },
    });
  } catch {
    // 埋点失败不影响执行主流程
  }
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

/**
 * curl -X POST "http://localhost:3000/api/recipes/RECIPE_ID/execute" \
 *   -H "Content-Type: application/json" \
 *   -H "Origin: http://localhost:3000" \
 *   -d '{}'
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

    const recipe = await resolveRecipe(id);
    if (!recipe || recipe.status !== "published") {
      return errorResponse("Recipe 不存在或尚未发布", "RECIPE_NOT_FOUND", 404);
    }

    let body: { input_overrides?: Record<string, unknown> } = {};
    try {
      const text = await request.text();
      if (text.trim()) {
        body = JSON.parse(text) as { input_overrides?: Record<string, unknown> };
      }
    } catch {
      return errorResponse("请求体不是合法 JSON", "INVALID_JSON", 400);
    }

    if (
      body.input_overrides !== undefined &&
      (typeof body.input_overrides !== "object" ||
        body.input_overrides === null ||
        Array.isArray(body.input_overrides))
    ) {
      return errorResponse("input_overrides 必须是对象", "INVALID_INPUT_OVERRIDES", 400);
    }

    const commandPreview = `openclaw run recipe:${recipe.slug}`;
    const admin = getSupabaseAdminClient();
    const insertPayload = {
      recipe_id: recipe.id,
      user_id: user.id,
      status: "pending",
      progress: 0,
      progress_pct: 0,
      input_overrides: body.input_overrides ?? null,
      command_preview: commandPreview,
      command_text: commandPreview,
    };

    const { data: execution, error: insertError } = await admin
      .from("recipe_executions")
      .insert(insertPayload)
      .select("id, status")
      .single();

    if (insertError) {
      throw new Error(`创建 Execution 失败: ${insertError.message}`);
    }

    await insertAnalyticsEvent({
      event_name: "recipe_execute_success",
      user_id: user.id,
      recipe_id: recipe.id,
      execution_id: execution.id,
    });

    try {
      await startRecipeExecution({
        executionId: execution.id,
        recipe,
        commandPreview,
        inputOverrides: body.input_overrides ?? null,
      });
    } catch (dispatchError) {
      console.error("startRecipeExecution failed:", dispatchError);
      await insertAnalyticsEvent({
        event_name: "recipe_execute_failed",
        user_id: user.id,
        recipe_id: recipe.id,
        execution_id: execution.id,
        error: dispatchError instanceof Error ? dispatchError.message : "提交到执行引擎失败",
      });
      await updateExecutionById(execution.id, {
        status: "failed",
        progress_pct: 100,
        error_message:
          dispatchError instanceof Error ? dispatchError.message : "提交到执行引擎失败",
      });
      return errorResponse("提交到执行引擎失败", "EXECUTION_DISPATCH_FAILED", 502);
    }

    return successResponse(
      {
        execution_id: execution.id,
        command_preview: commandPreview,
        status: "pending",
      },
      201,
    );
  } catch (error: unknown) {
    console.error("POST /api/recipes/[id]/execute failed:", error);
    return errorResponse("执行 Recipe 失败", "INTERNAL_ERROR", 500);
  }
}
