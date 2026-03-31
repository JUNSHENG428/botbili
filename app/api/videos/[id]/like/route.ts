import { NextResponse } from "next/server";

import { apiErrorResponse, withRateLimitHeaders } from "@/lib/api-response";
import { extractBearerToken, hashApiKey, verifyApiKey } from "@/lib/auth";
import { addLike, getLikeStatus, removeLike } from "@/lib/likes";
import type { LikeStatus } from "@/lib/likes";
import { createClientForServer } from "@/lib/supabase/server";
import type { ApiError } from "@/types";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/videos/[id]/like — 查询点赞状态
 *
 * curl http://localhost:3000/api/videos/<id>/like
 */
export async function GET(
  request: Request,
  context: RouteContext,
): Promise<NextResponse<ApiError | LikeStatus>> {
  try {
    const { id: videoId } = await context.params;
    if (!videoId) {
      return apiErrorResponse({ message: "Invalid video id", code: "VALIDATION_VIDEO_ID_INVALID", status: 400 });
    }

    const token = extractBearerToken(request.headers.get("authorization"));
    if (token) {
      const creator = await verifyApiKey(hashApiKey(token));
      if (!creator || !creator.is_active) {
        return apiErrorResponse({ message: "Unauthorized", code: "AUTH_INVALID_KEY", status: 401 });
      }
      const status = await getLikeStatus(videoId, undefined, creator.agent_key_hash);
      return withRateLimitHeaders(NextResponse.json(status));
    }

    const supabase = await createClientForServer();
    const { data: { user } } = await supabase.auth.getUser();
    const status = await getLikeStatus(videoId, user?.id);
    return withRateLimitHeaders(NextResponse.json(status));
  } catch (error: unknown) {
    console.error("GET /api/videos/[id]/like failed:", error);
    return apiErrorResponse({ message: "Internal server error", code: "INTERNAL_ERROR", status: 500 });
  }
}

/**
 * POST /api/videos/[id]/like — 点赞
 *
 * curl -X POST http://localhost:3000/api/videos/<id>/like
 */
export async function POST(
  request: Request,
  context: RouteContext,
): Promise<NextResponse<ApiError | LikeStatus>> {
  try {
    const { id: videoId } = await context.params;
    if (!videoId) {
      return apiErrorResponse({ message: "Invalid video id", code: "VALIDATION_VIDEO_ID_INVALID", status: 400 });
    }

    const token = extractBearerToken(request.headers.get("authorization"));
    if (token) {
      const creator = await verifyApiKey(hashApiKey(token));
      if (!creator || !creator.is_active) {
        return apiErrorResponse({ message: "Unauthorized", code: "AUTH_INVALID_KEY", status: 401 });
      }
      const status = await addLike({
        videoId,
        agentKeyHash: creator.agent_key_hash,
        viewerType: "ai",
      });
      return withRateLimitHeaders(NextResponse.json(status, { status: 201 }));
    }

    const supabase = await createClientForServer();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      return apiErrorResponse({ message: "Unauthorized", code: "AUTH_UNAUTHORIZED", status: 401 });
    }

    const status = await addLike({
      videoId,
      userId: user.id,
      viewerType: "human",
    });
    return withRateLimitHeaders(NextResponse.json(status, { status: 201 }));
  } catch (error: unknown) {
    console.error("POST /api/videos/[id]/like failed:", error);
    return apiErrorResponse({ message: "Internal server error", code: "INTERNAL_ERROR", status: 500 });
  }
}

/**
 * DELETE /api/videos/[id]/like — 取消点赞
 *
 * curl -X DELETE http://localhost:3000/api/videos/<id>/like
 */
export async function DELETE(
  request: Request,
  context: RouteContext,
): Promise<NextResponse<ApiError | LikeStatus>> {
  try {
    const { id: videoId } = await context.params;
    if (!videoId) {
      return apiErrorResponse({ message: "Invalid video id", code: "VALIDATION_VIDEO_ID_INVALID", status: 400 });
    }

    const token = extractBearerToken(request.headers.get("authorization"));
    if (token) {
      const creator = await verifyApiKey(hashApiKey(token));
      if (!creator || !creator.is_active) {
        return apiErrorResponse({ message: "Unauthorized", code: "AUTH_INVALID_KEY", status: 401 });
      }
      const status = await removeLike({
        videoId,
        agentKeyHash: creator.agent_key_hash,
        viewerType: "ai",
      });
      return withRateLimitHeaders(NextResponse.json(status));
    }

    const supabase = await createClientForServer();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      return apiErrorResponse({ message: "Unauthorized", code: "AUTH_UNAUTHORIZED", status: 401 });
    }

    const status = await removeLike({
      videoId,
      userId: user.id,
      viewerType: "human",
    });
    return withRateLimitHeaders(NextResponse.json(status));
  } catch (error: unknown) {
    console.error("DELETE /api/videos/[id]/like failed:", error);
    return apiErrorResponse({ message: "Internal server error", code: "INTERNAL_ERROR", status: 500 });
  }
}
