import { NextResponse } from "next/server";

import { updateExecutionById } from "@/lib/executions/updateExecution";
import type { RecipeExecutionStatus } from "@/types/recipe";

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface ExecutionCallbackBody {
  status?: RecipeExecutionStatus;
  progress_pct?: number;
  output_external_url?: string | null;
  output_thumbnail_url?: string | null;
  output_platform?: string | null;
  error_message?: string | null;
  command_text?: string | null;
}

const ALLOWED_STATUSES: RecipeExecutionStatus[] = [
  "pending",
  "running",
  "script_done",
  "edit_done",
  "publishing",
  "success",
  "failed",
];

function successResponse<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ success: true, data }, { status });
}

function errorResponse(message: string, code: string, status: number): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: { code, message },
    },
    { status },
  );
}

function isValidStatus(status: unknown): status is RecipeExecutionStatus {
  return typeof status === "string" && ALLOWED_STATUSES.includes(status as RecipeExecutionStatus);
}

function verifyCallbackSecret(request: Request): boolean {
  const expected = process.env.OPENCLAW_CALLBACK_SECRET?.trim();
  if (!expected) {
    return false;
  }

  const headerSecret =
    request.headers.get("x-botbili-callback-secret") ||
    request.headers.get("x-openclaw-callback-secret");

  if (headerSecret && headerSecret === expected) {
    return true;
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length).trim() === expected;
  }

  return false;
}

/**
 * curl -X POST "http://localhost:3000/api/executions/EXECUTION_ID/callback" \
 *   -H "Content-Type: application/json" \
 *   -H "X-BotBili-Callback-Secret: your-secret" \
 *   -d '{"status":"running","progress_pct":10}'
 */
export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    if (!id) {
      return errorResponse("Execution 标识不能为空", "INVALID_EXECUTION_ID", 400);
    }

    if (!process.env.OPENCLAW_CALLBACK_SECRET?.trim()) {
      return errorResponse("OpenClaw callback 未配置", "CALLBACK_NOT_CONFIGURED", 503);
    }

    if (!verifyCallbackSecret(request)) {
      return errorResponse("回调签名无效", "CALLBACK_UNAUTHORIZED", 401);
    }

    let body: ExecutionCallbackBody;
    try {
      body = (await request.json()) as ExecutionCallbackBody;
    } catch {
      return errorResponse("请求体不是合法 JSON", "INVALID_JSON", 400);
    }

    if (!isValidStatus(body.status)) {
      return errorResponse("status 非法", "INVALID_STATUS", 400);
    }

    if (
      body.progress_pct !== undefined &&
      (!Number.isFinite(body.progress_pct) || body.progress_pct < 0 || body.progress_pct > 100)
    ) {
      return errorResponse("progress_pct 必须在 0-100 之间", "INVALID_PROGRESS", 400);
    }

    await updateExecutionById(id, {
      status: body.status,
      progress_pct: body.progress_pct,
      output_external_url: body.output_external_url,
      output_thumbnail_url: body.output_thumbnail_url,
      output_platform: body.output_platform,
      error_message: body.error_message,
      command_text: body.command_text,
    });

    return successResponse({ execution_id: id, status: body.status });
  } catch (error: unknown) {
    console.error("POST /api/executions/[id]/callback failed:", error);
    return errorResponse("更新执行状态失败", "INTERNAL_ERROR", 500);
  }
}
