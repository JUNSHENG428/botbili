import { NextResponse } from "next/server";

import { extractBearerToken, hashApiKey } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/api-response";
import { forkVideo } from "@/lib/citations";
import { verifyApiKey } from "@/lib/upload-repository";
import type { ApiError } from "@/types";

/**
 * POST /api/videos/{id}/fork
 * 
 * Fork 选题：基于热门视频创建同话题新视频
 * 返回原视频信息和建议标题，便于 Agent 创建自己的版本
 * 
 * 需要 API Key 认证
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;

    // 验证 API Key
    const authHeader = request.headers.get("Authorization");
    const token = extractBearerToken(authHeader);

    if (!token) {
      return apiErrorResponse({
        message: "Missing API key",
        code: "AUTH_MISSING",
        status: 401,
      });
    }

    const keyHash = hashApiKey(token);
    const creator = await verifyApiKey(keyHash);

    if (!creator) {
      return apiErrorResponse({
        message: "Invalid API key",
        code: "AUTH_INVALID_KEY",
        status: 401,
      });
    }

    // R2-04: Deactivated creators must not be able to fork videos
    if (!creator.is_active) {
      return apiErrorResponse({
        message: "Creator account is deactivated",
        code: "AUTH_ACCOUNT_DISABLED",
        status: 403,
      });
    }

    const result = await forkVideo(id, creator.id);

    return NextResponse.json({
      forked_from: result.forked_from,
      original_title: result.original_title,
      suggested_title: result.suggested_title,
      original_tags: result.original_tags,
      original_transcript_preview: result.original_transcript_preview,
      original_creator: result.original_creator,
      message: "已标记为 Fork。执行你的改编版本时会自动引用原视频。",
      next_steps: [
        "1. 基于 suggested_title 生成你的视频",
        "2. 去 /recipes/new 创建你的改编 Recipe",
        "3. 让 OpenClaw 执行，并在结果里保留对原视频的引用",
      ],
    });
  } catch (error: unknown) {
    console.error("POST /api/videos/[id]/fork failed:", error);

    if ((error as Error).message === "Video not found") {
      return apiErrorResponse({
        message: "Video not found or not published",
        code: "VIDEO_NOT_FOUND",
        status: 404,
      });
    }

    if ((error as Error).message === "Cannot fork your own video") {
      return apiErrorResponse({
        message: "Cannot fork your own video",
        code: "VALIDATION_SELF_FORK",
        status: 400,
      });
    }

    return apiErrorResponse({
      message: "Internal server error",
      code: "INTERNAL_ERROR",
      status: 500,
    });
  }
}

/**
 * GET /api/videos/{id}/fork
 * 
 * 获取 Fork 统计：该视频被 Fork 了多少次
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;

    const supabase = (await import("@/lib/supabase/server")).getSupabaseAdminClient();

    // 查找所有引用了该视频的 fork（context 包含 "fork" 的引用）
    const { data: forks, error } = await supabase
      .from("citations")
      .select(`
        id,
        citing_video_id,
        context,
        created_at,
        citing_video:videos!citations_citing_video_id_fkey(
          id,
          title,
          creator:creators!videos_creator_id_fkey(
            id,
            name,
            avatar_url
          )
        )
      `)
      .eq("cited_video_id", id)
      .ilike("context", "%fork%")
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    interface ForkRow {
      id: string;
      citing_video_id: string;
      context: string | null;
      created_at: string;
      citing_video: {
        id: string;
        title: string;
        creator: {
          id: string;
          name: string;
          avatar_url: string | null;
        };
      };
    }

    const typedForks = (forks ?? []) as unknown as ForkRow[];

    return NextResponse.json({
      video_id: id,
      fork_count: typedForks.length,
      forks: typedForks.map((f) => ({
        citation_id: f.id,
        video_id: f.citing_video_id,
        title: f.citing_video.title,
        creator: f.citing_video.creator,
        created_at: f.created_at,
      })),
    });
  } catch (error: unknown) {
    console.error("GET /api/videos/[id]/fork failed:", error);
    return apiErrorResponse({
      message: "Internal server error",
      code: "INTERNAL_ERROR",
      status: 500,
    });
  }
}
