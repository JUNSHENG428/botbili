import { after, NextResponse } from "next/server";

import { extractBearerToken, hashApiKey } from "@/lib/auth";
import {
  getExecutionOutputColumns,
  normalizeExecutionOutput,
  parseExecutionOutputPayload,
} from "@/lib/executions/normalizeExecutionOutput";
import { isExecutionCompletedStatus } from "@/lib/executions/getExecutionStatusLabel";
import { resolveUser } from "@/lib/executions/resolveUser";
import { awardPoints } from "@/lib/reputation";
import { recalculateRecipeStats } from "@/lib/recipe-stats";
import { verifyApiKey } from "@/lib/upload-repository";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { dispatchExecutionCompletedWebhooks } from "@/lib/webhooks/dispatch";
import type { RecipeExecution, RecipeExecutionOutput } from "@/types/recipe";

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface RecipeExecutionRecipeRow {
  id: string;
  author_id: string;
  title: string;
  slug: string;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCompletedExecutionStatus(status: string): boolean {
  return status === "success" || status === "completed";
}

function scheduleExecutionPostUpdate(payload: {
  recipeId: string;
  recipeAuthorId: string;
  executionId: string;
  executorUserId: string;
  status: string;
}): void {
  after(async () => {
    try {
      await recalculateRecipeStats(payload.recipeId);

      if (!isCompletedExecutionStatus(payload.status)) {
        return;
      }

      await awardPoints(payload.recipeAuthorId, 2, "recipe_got_execution", payload.executionId);
      if (payload.executorUserId !== payload.recipeAuthorId) {
        await awardPoints(payload.executorUserId, 1, "execution_completed", payload.executionId);
      }
    } catch (error) {
      console.error("scheduleExecutionPostUpdate failed:", error);
    }
  });
}

/**
 * curl "http://localhost:3000/api/executions/EXECUTION_ID"
 */
export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  // P14: api-key-auth
  try {
    const { id } = await context.params;
    if (!id) {
      return errorResponse("Execution 标识不能为空", "INVALID_EXECUTION_ID", 400);
    }

    const resolved = await resolveUser(_request.headers.get("Authorization"));
    if (!resolved) return errorResponse("请先登录或提供有效 API Key", "UNAUTHORIZED", 401);
    const userId = resolved.userId;

    const admin = getSupabaseAdminClient();
    const { data, error } = await admin
      .from("recipe_executions")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw new Error(`读取 Execution 失败: ${error.message}`);
    }

    if (!data) {
      return errorResponse("Execution 不存在", "EXECUTION_NOT_FOUND", 404);
    }

    const execution = data as RecipeExecution;

    // 所有权校验：使用 resolveAuth 返回的 userId
    if (execution.user_id !== userId) {
      return errorResponse("你无权查看这个执行记录", "FORBIDDEN", 403);
    }

    return successResponse({
      id: execution.id,
      recipe_id: execution.recipe_id,
      status: execution.status,
      progress_pct: execution.progress_pct ?? 0,
      command_preview: execution.command_preview ?? null,
      command_text: execution.command_text ?? execution.command_preview,
      output_external_url: execution.output_external_url,
      output_thumbnail_url: execution.output_thumbnail_url,
      output_platform: execution.output_platform,
      output: normalizeExecutionOutput(execution, "执行产出"),
      duration_seconds: execution.duration_seconds ?? null,
      output_video_id: execution.output_video_id ?? null,
      output_metrics: execution.output_metrics ?? {},
      notes: execution.notes ?? null,
      error_message: execution.error_message,
      completed_at: execution.completed_at ?? null,
      created_at: execution.created_at,
      updated_at: execution.updated_at,
    });
  } catch (error: unknown) {
    console.error("GET /api/executions/[id] failed:", error);
    return errorResponse("获取执行记录失败", "INTERNAL_ERROR", 500);
  }
}

/**
 * curl -X PATCH "http://localhost:3000/api/executions/EXECUTION_ID" \
 *   -H "Authorization: Bearer CREATOR_API_KEY" \
 *   -H "Content-Type: application/json" \
 *   -d '{"platform":"bilibili","video_url":"https://www.bilibili.com/video/BVxxxxx","title":"视频标题"}'
 */
export async function PATCH(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    if (!id) {
      return errorResponse("Execution 标识不能为空", "INVALID_EXECUTION_ID", 400);
    }

    const token = extractBearerToken(request.headers.get("Authorization"));
    if (!token) {
      return errorResponse("缺少 creator API key", "AUTH_MISSING", 401);
    }

    const creator = await verifyApiKey(hashApiKey(token));
    if (!creator) {
      return errorResponse("creator API key 无效", "AUTH_INVALID_KEY", 401);
    }

    let output: RecipeExecutionOutput;
    try {
      output = parseExecutionOutputPayload(await request.json(), {
        required: true,
      }) as RecipeExecutionOutput;
    } catch (parseError) {
      return errorResponse(
        parseError instanceof Error ? parseError.message : "请求体非法",
        "INVALID_OUTPUT",
        400,
      );
    }

    const admin = getSupabaseAdminClient();
    const { data: executionData, error: executionError } = await admin
      .from("recipe_executions")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (executionError) {
      throw new Error(`读取 Execution 失败: ${executionError.message}`);
    }

    if (!executionData) {
      return errorResponse("Execution 不存在", "EXECUTION_NOT_FOUND", 404);
    }

    const execution = executionData as RecipeExecution;
    const { data: recipeData, error: recipeError } = await admin
      .from("recipes")
      .select("id, author_id, title, slug")
      .eq("id", execution.recipe_id)
      .maybeSingle<RecipeExecutionRecipeRow>();

    if (recipeError) {
      throw new Error(`读取 Recipe 失败: ${recipeError.message}`);
    }

    if (!recipeData) {
      return errorResponse("Recipe 不存在", "RECIPE_NOT_FOUND", 404);
    }

    if (recipeData.author_id !== creator.owner_id) {
      return errorResponse("你无权回填这个执行结果", "FORBIDDEN", 403);
    }

    const now = new Date().toISOString();
    const { data: updatedData, error: updateError } = await admin
      .from("recipe_executions")
      .update({
        status: "completed",
        progress_pct: 100,
        ...getExecutionOutputColumns(output),
        error_message: null,
        completed_at: now,
        updated_at: now,
      })
      .eq("id", id)
      .select("*")
      .single();

    if (updateError) {
      throw new Error(`回填 Execution output 失败: ${updateError.message}`);
    }

    try {
      await dispatchExecutionCompletedWebhooks({
        creatorId: creator.id,
        executionId: id,
        recipe: {
          id: recipeData.id,
          title: recipeData.title,
          slug: recipeData.slug,
        },
        output,
      });
    } catch (dispatchError) {
      console.error("dispatchExecutionCompletedWebhooks failed:", dispatchError);
    }

    scheduleExecutionPostUpdate({
      recipeId: execution.recipe_id,
      recipeAuthorId: recipeData.author_id,
      executionId: id,
      executorUserId: execution.user_id,
      status: "completed",
    });

    return successResponse(updatedData as RecipeExecution);
  } catch (error: unknown) {
    console.error("PATCH /api/executions/[id] failed:", error);
    return errorResponse("回填执行结果失败", "INTERNAL_ERROR", 500);
  }
}
