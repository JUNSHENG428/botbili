import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { updateExecutionById } from "@/lib/executions/updateExecution";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { dispatchExecutionCompletedWebhooks } from "@/lib/webhooks/dispatch";
import type { RecipeExecution, RecipeExecutionStatus } from "@/types/recipe";

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface CallbackBody {
  status: "success" | "failed";
  progress_pct: number;
  output_external_url?: string;
  output_thumbnail_url?: string;
  output_platform?: string;
  error_message?: string | null;
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
    let body: CallbackBody;
    try {
      body = (await request.json()) as CallbackBody;
    } catch {
      return errorResponse("请求体不是合法 JSON", "INVALID_JSON", 400);
    }

    // 验证必填字段
    if (!body.status || (body.status !== "success" && body.status !== "failed")) {
      return errorResponse("status 必须是 'success' 或 'failed'", "INVALID_STATUS", 400);
    }

    if (typeof body.progress_pct !== "number" || body.progress_pct < 0 || body.progress_pct > 100) {
      return errorResponse("progress_pct 必须是 0-100 的数字", "INVALID_PROGRESS", 400);
    }

    // 获取 execution
    const admin = getSupabaseAdminClient();
    const { data: executionData, error: executionError } = await admin
      .from("recipe_executions")
      .select("*, recipe:recipes!recipe_executions_recipe_id_fkey(id, title, slug)")
      .eq("id", id)
      .maybeSingle();

    if (executionError) {
      throw new Error(`读取 Execution 失败: ${executionError.message}`);
    }

    if (!executionData) {
      return errorResponse("Execution 不存在", "EXECUTION_NOT_FOUND", 404);
    }

    const execution = executionData as RecipeExecution & {
      recipe: { id: string; title: string; slug: string } | null;
    };

    // 更新 execution
    const updatePayload: Parameters<typeof updateExecutionById>[1] = {
      status: body.status as RecipeExecutionStatus,
      progress_pct: body.progress_pct,
      output_external_url: body.output_external_url ?? null,
      output_thumbnail_url: body.output_thumbnail_url ?? null,
      output_platform: body.output_platform ?? null,
      error_message: body.error_message ?? null,
      completed_at: new Date().toISOString(),
    };

    await updateExecutionById(id, updatePayload);

    // 如果 status === "success"，调用 webhook 分发
    if (body.status === "success" && execution.recipe) {
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
            output: {
              platform: (body.output_platform as "bilibili" | "youtube" | "douyin" | "kuaishou" | "xiaohongshu" | "other") || "other",
              video_url: body.output_external_url || "",
              title: execution.recipe.title,
              thumbnail_url: body.output_thumbnail_url,
            },
          });
        }
      } catch (dispatchError) {
        console.error("dispatchExecutionCompletedWebhooks failed:", dispatchError);
        // webhook 失败不影响主流程
      }
    }

    return successResponse({ success: true });
  } catch (error: unknown) {
    console.error("POST /api/executions/[id]/callback failed:", error);
    return errorResponse("处理回调失败", "INTERNAL_ERROR", 500);
  }
}
