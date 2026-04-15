import { after, NextResponse } from "next/server";

import { extractBearerToken, hashApiKey } from "@/lib/auth";
import {
  getExecutionOutputColumns,
  parseExecutionOutputPayload,
} from "@/lib/executions/normalizeExecutionOutput";
import { awardPoints } from "@/lib/reputation";
import { recalculateRecipeStats } from "@/lib/recipe-stats";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { verifyApiKey } from "@/lib/upload-repository";
import type { RecipeExecutionCompleteRequest, RecipeExecutionOutput } from "@/types/recipe";

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface ExecutionOwnershipRow {
  id: string;
  recipe_id: string;
  user_id: string;
}

interface RecipeOwnershipRow {
  id: string;
  author_id: string;
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

function parseBody(body: unknown): RecipeExecutionCompleteRequest {
  if (!isRecord(body)) {
    throw new Error("请求体必须是对象");
  }

  if (body.status !== "completed" && body.status !== "failed" && body.status !== "cancelled") {
    throw new Error("status 必须是 completed / failed / cancelled");
  }

  if (
    body.duration_seconds !== undefined &&
    (typeof body.duration_seconds !== "number" ||
      !Number.isInteger(body.duration_seconds) ||
      body.duration_seconds < 0)
  ) {
    throw new Error("duration_seconds 必须是非负整数");
  }

  if (
    body.output_video_id !== undefined &&
    (typeof body.output_video_id !== "string" || body.output_video_id.trim().length === 0)
  ) {
    throw new Error("output_video_id 必须是合法 UUID 字符串");
  }

  if (body.notes !== undefined && typeof body.notes !== "string") {
    throw new Error("notes 必须是字符串");
  }

  if (body.error_message !== undefined && body.error_message !== null && typeof body.error_message !== "string") {
    throw new Error("error_message 必须是字符串");
  }

  if (body.output_metrics !== undefined) {
    if (!isRecord(body.output_metrics)) {
      throw new Error("output_metrics 必须是对象");
    }

    for (const [key, value] of Object.entries(body.output_metrics)) {
      if (typeof value !== "number" || Number.isNaN(value) || value < 0) {
        throw new Error(`${key} 必须是非负数字`);
      }
    }
  }

  let output: RecipeExecutionOutput | null = null;
  try {
    output = parseExecutionOutputPayload(body, {
      fallbackTitle: "执行产出",
    });
  } catch (parseError) {
    throw new Error(parseError instanceof Error ? parseError.message : "output 非法");
  }

  return {
    status: body.status,
    duration_seconds: body.duration_seconds,
    output_video_id: body.output_video_id?.trim(),
    output_metrics: body.output_metrics,
    notes: body.notes?.trim(),
    error_message:
      typeof body.error_message === "string" && body.error_message.trim().length > 0
        ? body.error_message.trim()
        : body.error_message ?? null,
    output,
  };
}

function schedulePostUpdate(payload: {
  recipeId: string;
  recipeAuthorId: string;
  executionId: string;
  executorUserId: string;
  status: RecipeExecutionCompleteRequest["status"];
}): void {
  after(async () => {
    try {
      await recalculateRecipeStats(payload.recipeId);

      if (payload.status !== "completed") {
        return;
      }

      await awardPoints(payload.recipeAuthorId, 2, "recipe_got_execution", payload.executionId);
      if (payload.executorUserId !== payload.recipeAuthorId) {
        await awardPoints(payload.executorUserId, 1, "execution_completed", payload.executionId);
      }
    } catch (error) {
      console.error("PATCH /api/executions/[id]/complete post-update failed:", error);
    }
  });
}

/**
 * curl -X PATCH "http://localhost:3000/api/executions/EXECUTION_ID/complete" \
 *   -H "Authorization: Bearer CREATOR_API_KEY" \
 *   -H "Content-Type: application/json" \
 *   -d '{"status":"completed","duration_seconds":92,"output_metrics":{"views_24h":1280,"likes_count":56,"ctr_percent":3.4}}'
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

    let body: RecipeExecutionCompleteRequest;
    try {
      body = parseBody(await request.json());
    } catch (parseError) {
      return errorResponse(
        parseError instanceof Error ? parseError.message : "请求体非法",
        "INVALID_COMPLETE_PAYLOAD",
        400,
      );
    }

    const admin = getSupabaseAdminClient();
    const { data: executionData, error: executionError } = await admin
      .from("recipe_executions")
      .select("id, recipe_id, user_id")
      .eq("id", id)
      .maybeSingle<ExecutionOwnershipRow>();

    if (executionError) {
      throw new Error(`读取 Execution 失败: ${executionError.message}`);
    }

    if (!executionData) {
      return errorResponse("Execution 不存在", "EXECUTION_NOT_FOUND", 404);
    }

    const { data: recipeData, error: recipeError } = await admin
      .from("recipes")
      .select("id, author_id")
      .eq("id", executionData.recipe_id)
      .maybeSingle<RecipeOwnershipRow>();

    if (recipeError) {
      throw new Error(`读取 Recipe 失败: ${recipeError.message}`);
    }

    if (!recipeData) {
      return errorResponse("Recipe 不存在", "RECIPE_NOT_FOUND", 404);
    }

    if (recipeData.author_id !== creator.owner_id) {
      return errorResponse("你无权回写这个执行结果", "FORBIDDEN", 403);
    }

    if (body.output_video_id) {
      const { data: videoData, error: videoError } = await admin
        .from("videos")
        .select("id")
        .eq("id", body.output_video_id)
        .maybeSingle();

      if (videoError) {
        throw new Error(`读取 output_video_id 失败: ${videoError.message}`);
      }

      if (!videoData) {
        return errorResponse("output_video_id 对应视频不存在", "OUTPUT_VIDEO_NOT_FOUND", 404);
      }
    }

    const timestamp = new Date().toISOString();
    const updatePayload: Record<string, unknown> = {
      status: body.status,
      duration_seconds: body.duration_seconds ?? null,
      output_video_id: body.output_video_id ?? null,
      output_metrics: body.output_metrics ?? {},
      notes: body.notes ?? null,
      error_message:
        body.status === "completed" ? null : body.error_message ?? null,
      completed_at: body.status === "completed" || body.status === "failed" || body.status === "cancelled" ? timestamp : null,
      updated_at: timestamp,
    };

    if (body.output) {
      Object.assign(updatePayload, getExecutionOutputColumns(body.output));
    } else if (body.status === "failed" || body.status === "cancelled") {
      Object.assign(updatePayload, getExecutionOutputColumns(null));
    }

    const { data: updatedData, error: updateError } = await admin
      .from("recipe_executions")
      .update(updatePayload)
      .eq("id", id)
      .select("*")
      .single();

    if (updateError) {
      throw new Error(`更新 Execution 失败: ${updateError.message}`);
    }

    schedulePostUpdate({
      recipeId: executionData.recipe_id,
      recipeAuthorId: recipeData.author_id,
      executionId: id,
      executorUserId: executionData.user_id,
      status: body.status,
    });

    return successResponse(updatedData, 200);
  } catch (error: unknown) {
    console.error("PATCH /api/executions/[id]/complete failed:", error);
    return errorResponse("回写执行完成结果失败", "INTERNAL_ERROR", 500);
  }
}
