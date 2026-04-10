import { NextResponse } from "next/server";

import { extractBearerToken, hashApiKey } from "@/lib/auth";
import { resolveUser } from "@/lib/executions/resolveUser";
import { verifyApiKey } from "@/lib/upload-repository";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { dispatchExecutionCompletedWebhooks } from "@/lib/webhooks/dispatch";
import type { RecipeExecution, RecipeExecutionOutput, VideoPlatform } from "@/types/recipe";

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface RecipeExecutionRecipeRow {
  id: string;
  author_id: string;
  title: string;
  slug: string;
}

const VIDEO_PLATFORMS: VideoPlatform[] = [
  "bilibili",
  "youtube",
  "douyin",
  "kuaishou",
  "xiaohongshu",
  "other",
];

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

function isVideoPlatform(value: unknown): value is VideoPlatform {
  return typeof value === "string" && VIDEO_PLATFORMS.includes(value as VideoPlatform);
}

function isValidUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function validateOptionalUrl(body: Record<string, unknown>, key: "thumbnail_url" | "gif_url"): string | undefined {
  const value = body[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string" || !isValidUrl(value)) {
    throw new Error(`${key} 必须是合法 URL`);
  }
  return value;
}

function parseExecutionOutput(body: unknown): RecipeExecutionOutput {
  if (!isRecord(body)) {
    throw new Error("请求体必须是对象");
  }

  if (!isVideoPlatform(body.platform)) {
    throw new Error("platform 非法");
  }

  if (typeof body.video_url !== "string" || !isValidUrl(body.video_url)) {
    throw new Error("video_url 必须是合法 URL");
  }

  if (typeof body.title !== "string" || body.title.trim().length === 0) {
    throw new Error("title 不能为空");
  }

  const output: RecipeExecutionOutput = {
    platform: body.platform,
    video_url: body.video_url,
    title: body.title.trim(),
  };

  const thumbnailUrl = validateOptionalUrl(body, "thumbnail_url");
  if (thumbnailUrl) {
    output.thumbnail_url = thumbnailUrl;
  }

  const gifUrl = validateOptionalUrl(body, "gif_url");
  if (gifUrl) {
    output.gif_url = gifUrl;
  }

  if (body.published_at !== undefined) {
    if (typeof body.published_at !== "string" || Number.isNaN(Date.parse(body.published_at))) {
      throw new Error("published_at 必须是 ISO 时间字符串");
    }
    output.published_at = body.published_at;
  }

  if (body.view_count !== undefined) {
    if (
      typeof body.view_count !== "number" ||
      !Number.isInteger(body.view_count) ||
      body.view_count < 0
    ) {
      throw new Error("view_count 必须是非负整数");
    }
    output.view_count = body.view_count;
  }

  if (body.platform_video_id !== undefined) {
    if (typeof body.platform_video_id !== "string" || body.platform_video_id.trim().length === 0) {
      throw new Error("platform_video_id 必须是非空字符串");
    }
    output.platform_video_id = body.platform_video_id.trim();
  }

  return output;
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
      command_text: execution.command_text ?? execution.command_preview,
      output_external_url: execution.output_external_url,
      output_thumbnail_url: execution.output_thumbnail_url,
      output_platform: execution.output_platform,
      output: execution.output ?? null,
      error_message: execution.error_message,
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
      output = parseExecutionOutput(await request.json());
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
        status: "success",
        progress_pct: 100,
        output,
        output_external_url: output.video_url,
        output_thumbnail_url: output.thumbnail_url ?? null,
        output_platform: output.platform,
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

    return successResponse(updatedData as RecipeExecution);
  } catch (error: unknown) {
    console.error("PATCH /api/executions/[id] failed:", error);
    return errorResponse("回填执行结果失败", "INTERNAL_ERROR", 500);
  }
}
