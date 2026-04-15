import { timingSafeEqual } from "node:crypto";

import { after, NextResponse } from "next/server";

import {
  getExecutionOutputColumns,
  parseExecutionOutputPayload,
} from "@/lib/executions/normalizeExecutionOutput";
import {
  isExecutionCompletedStatus,
  isExecutionFailedStatus,
  isExecutionTerminalStatus,
} from "@/lib/executions/getExecutionStatusLabel";
import { updateExecutionById } from "@/lib/executions/updateExecution";
import { awardPoints } from "@/lib/reputation";
import { recalculateRecipeStats } from "@/lib/recipe-stats";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { dispatchExecutionCompletedWebhooks } from "@/lib/webhooks/dispatch";
import type { RecipeExecution, RecipeExecutionCallbackPayload, RecipeExecutionStatus } from "@/types/recipe";

interface RouteContext {
  params: Promise<{ id: string }>;
}

function schedulePostUpdate(payload: {
  recipeId: string;
  recipeAuthorId: string;
  executionId: string;
  executorUserId: string;
  status: RecipeExecutionStatus;
}): void {
  after(async () => {
    try {
      await recalculateRecipeStats(payload.recipeId);

      if (!isExecutionCompletedStatus(payload.status)) {
        return;
      }

      await awardPoints(payload.recipeAuthorId, 2, "recipe_got_execution", payload.executionId);
      if (payload.executorUserId !== payload.recipeAuthorId) {
        await awardPoints(payload.executorUserId, 1, "execution_completed", payload.executionId);
      }
    } catch (error) {
      console.error("POST /api/executions/[id]/callback post-update failed:", error);
    }
  });
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

/**
 * POST /api/executions/{id}/callback
 * 
 * 给外部 OpenClaw 执行器调用的回调接口，用 HMAC Secret 鉴权。
 * 
 * // P14: api-key-auth
 */
export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    if (!id) {
      return errorResponse("Execution 标识不能为空", "INVALID_EXECUTION_ID", 400);
    }

    // 检查 OPENCLAW_CALLBACK_SECRET 是否配置
    const callbackSecret = process.env.OPENCLAW_CALLBACK_SECRET;
    if (!callbackSecret || callbackSecret.length === 0) {
      return errorResponse(
        "回调密钥未配置",
        "CALLBACK_SECRET_NOT_CONFIGURED",
        503
      );
    }

    // 验证 X-BotBili-Callback-Secret header
    const providedSecret = request.headers.get("x-botbili-callback-secret");
    if (!providedSecret) {
      return errorResponse("缺少回调密钥", "CALLBACK_SECRET_MISSING", 401);
    }

    // 使用 timingSafeEqual 防止时序攻击
    try {
      const providedBuffer = Buffer.from(providedSecret, "utf8");
      const expectedBuffer = Buffer.from(callbackSecret, "utf8");
      
      if (providedBuffer.length !== expectedBuffer.length) {
        return errorResponse("回调密钥无效", "CALLBACK_SECRET_INVALID", 401);
      }
      
      if (!timingSafeEqual(providedBuffer, expectedBuffer)) {
        return errorResponse("回调密钥无效", "CALLBACK_SECRET_INVALID", 401);
      }
    } catch {
      return errorResponse("回调密钥验证失败", "CALLBACK_SECRET_INVALID", 401);
    }

    // 解析请求体
    let body: RecipeExecutionCallbackPayload;
    try {
      body = (await request.json()) as RecipeExecutionCallbackPayload;
    } catch {
      return errorResponse("请求体不是合法 JSON", "INVALID_JSON", 400);
    }

    // 验证必填字段
    const allowedStatuses: RecipeExecutionStatus[] = [
      "running",
      "script_done",
      "edit_done",
      "publishing",
      "success",
      "completed",
      "failed",
      "cancelled",
    ];
    if (!body.status || !allowedStatuses.includes(body.status)) {
      return errorResponse(
        "status 必须是 running / script_done / edit_done / publishing / success / completed / failed / cancelled",
        "INVALID_STATUS",
        400,
      );
    }

    if (
      body.progress_pct !== undefined &&
      (typeof body.progress_pct !== "number" || body.progress_pct < 0 || body.progress_pct > 100)
    ) {
      return errorResponse("progress_pct 必须是 0-100 的数字", "INVALID_PROGRESS", 400);
    }

    // 获取 execution
    const admin = getSupabaseAdminClient();
    const { data: executionData, error: executionError } = await admin
      .from("recipe_executions")
      .select("*, recipe:recipes!recipe_executions_recipe_id_fkey(id, title, slug, author_id)")
      .eq("id", id)
      .maybeSingle();

    if (executionError) {
      throw new Error(`读取 Execution 失败: ${executionError.message}`);
    }

    if (!executionData) {
      return errorResponse("Execution 不存在", "EXECUTION_NOT_FOUND", 404);
    }

    const execution = executionData as RecipeExecution & {
      recipe: { id: string; title: string; slug: string; author_id: string } | null;
    };

    let output = null;
    try {
      output = parseExecutionOutputPayload(body, {
        fallbackTitle: execution.recipe?.title ?? "执行产出",
      });
    } catch (parseError) {
      return errorResponse(
        parseError instanceof Error ? parseError.message : "执行产出结构非法",
        "INVALID_OUTPUT",
        400,
      );
    }

    let completedAt: string | undefined;
    if (body.completed_at !== undefined && body.completed_at !== null) {
      if (typeof body.completed_at !== "string" || Number.isNaN(Date.parse(body.completed_at))) {
        return errorResponse("completed_at 必须是 ISO 时间字符串", "INVALID_COMPLETED_AT", 400);
      }
      completedAt = body.completed_at;
    }

    // 更新 execution
    const updatePayload: Parameters<typeof updateExecutionById>[1] = {
      status: body.status as RecipeExecutionStatus,
      error_message: body.error_message ?? (isExecutionFailedStatus(body.status) ? "Agent 执行失败" : null),
    };

    if (typeof body.progress_pct === "number") {
      updatePayload.progress_pct = body.progress_pct;
    } else if (isExecutionTerminalStatus(body.status)) {
      updatePayload.progress_pct = 100;
    }

    if (body.command_text !== undefined) {
      updatePayload.command_text =
        typeof body.command_text === "string" && body.command_text.trim().length > 0
          ? body.command_text.trim()
          : null;
    }

    if (output) {
      Object.assign(updatePayload, getExecutionOutputColumns(output));
    } else if (isExecutionFailedStatus(body.status)) {
      Object.assign(updatePayload, getExecutionOutputColumns(null));
    }

    if (isExecutionTerminalStatus(body.status)) {
      updatePayload.completed_at = completedAt ?? new Date().toISOString();
    }

    await updateExecutionById(id, updatePayload);

    // 如果 status 已完成且有外链产出，调用 webhook 分发
    if (isExecutionCompletedStatus(body.status) && execution.recipe && output) {
      try {
        // 获取 creator 信息
        const { data: creatorData } = await admin
          .from("creators")
          .select("id")
          .eq("owner_id", execution.user_id)
          .maybeSingle();

        if (creatorData) {
          await dispatchExecutionCompletedWebhooks({
            creatorId: creatorData.id,
            executionId: id,
            recipe: {
              id: execution.recipe.id,
              title: execution.recipe.title,
              slug: execution.recipe.slug,
            },
            output,
          });
        }
      } catch (dispatchError) {
        console.error("dispatchExecutionCompletedWebhooks failed:", dispatchError);
        // webhook 失败不影响主流程
      }
    }

    if (execution.recipe) {
      schedulePostUpdate({
        recipeId: execution.recipe.id,
        recipeAuthorId: execution.recipe.author_id,
        executionId: id,
        executorUserId: execution.user_id,
        status: body.status,
      });
    }

    return successResponse({ success: true });
  } catch (error: unknown) {
    console.error("POST /api/executions/[id]/callback failed:", error);
    return errorResponse("处理回调失败", "INTERNAL_ERROR", 500);
  }
}
