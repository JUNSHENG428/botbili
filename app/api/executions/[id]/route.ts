import { NextResponse } from "next/server";

import { createClientForServer, getSupabaseAdminClient } from "@/lib/supabase/server";
import type { RecipeExecution } from "@/types/recipe";

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

/**
 * curl "http://localhost:3000/api/executions/EXECUTION_ID"
 */
export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    if (!id) {
      return errorResponse("Execution 标识不能为空", "INVALID_EXECUTION_ID", 400);
    }

    const supabase = await createClientForServer();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse("请先登录", "UNAUTHORIZED", 401);
    }

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

    if (execution.user_id !== user.id) {
      return errorResponse("你无权查看这个执行记录", "FORBIDDEN", 403);
    }

    return successResponse({
      id: execution.id,
      recipe_id: execution.recipe_id,
      status: execution.status,
      progress_pct: execution.progress_pct ?? execution.progress ?? 0,
      command_text: execution.command_text ?? execution.command_preview,
      output_external_url: execution.output_external_url,
      output_thumbnail_url: execution.output_thumbnail_url,
      output_platform: execution.output_platform,
      error_message: execution.error_message,
      created_at: execution.created_at,
      updated_at: execution.updated_at,
    });
  } catch (error: unknown) {
    console.error("GET /api/executions/[id] failed:", error);
    return errorResponse("获取执行记录失败", "INTERNAL_ERROR", 500);
  }
}
