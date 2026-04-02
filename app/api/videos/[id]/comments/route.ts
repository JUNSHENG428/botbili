import { NextResponse } from "next/server";

import { apiErrorResponse, withRateLimitHeaders } from "@/lib/api-response";
import { extractBearerToken, hashApiKey, verifyApiKey } from "@/lib/auth";
import { createComment, listComments } from "@/lib/comments";
import type { CommentWithProfile } from "@/lib/comments";
import { createClientForServer } from "@/lib/supabase/server";
import type { ApiError, ViewerType } from "@/types";

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface CommentsListResponse {
  data: CommentWithProfile[];
  total: number;
  page: number;
  hasMore: boolean;
}

interface CommentCreateResponse {
  ok: true;
  comment_id: string;
}

/**
 * GET /api/videos/[id]/comments?page=1&viewer_type=all|human|ai
 *
 * curl http://localhost:3000/api/videos/<id>/comments?page=1&viewer_type=ai
 */
export async function GET(
  request: Request,
  context: RouteContext,
): Promise<NextResponse<ApiError | CommentsListResponse>> {
  try {
    const { id: videoId } = await context.params;
    if (!videoId) {
      return apiErrorResponse({ message: "Invalid video id", code: "VALIDATION_VIDEO_ID_INVALID", status: 400 });
    }

    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
    const viewerType = (url.searchParams.get("viewer_type") ?? "all") as ViewerType | "all";

    if (!["all", "human", "ai"].includes(viewerType)) {
      return apiErrorResponse({ message: "Invalid viewer_type", code: "VALIDATION_VIEWER_TYPE_INVALID", status: 400 });
    }

    const result = await listComments({ videoId, page, viewerType });
    return withRateLimitHeaders(NextResponse.json(result));
  } catch (error: unknown) {
    console.error("GET /api/videos/[id]/comments failed:", error);
    return apiErrorResponse({ message: "Internal server error", code: "INTERNAL_ERROR", status: 500 });
  }
}

/**
 * POST /api/videos/[id]/comments
 * 人类：Supabase Auth 认证
 * AI：Bearer token（API Key）认证
 *
 * curl -X POST http://localhost:3000/api/videos/<id>/comments \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer bb_xxx" \
 *   -d '{"content":"Agent comment"}'
 */
export async function POST(
  request: Request,
  context: RouteContext,
): Promise<NextResponse<ApiError | CommentCreateResponse>> {
  try {
    const { id: videoId } = await context.params;
    if (!videoId) {
      return apiErrorResponse({ message: "Invalid video id", code: "VALIDATION_VIDEO_ID_INVALID", status: 400 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiErrorResponse({ message: "Invalid JSON body", code: "VALIDATION_JSON_INVALID", status: 400 });
    }

    const payload = body as { content?: string; viewer_label?: string };
    // R2-07: Strip HTML tags from content before validation (defense-in-depth against stored XSS)
    const rawContent = payload.content?.trim();
    const content = rawContent ? rawContent.replace(/<[^>]*>/g, "").trim() : "";
    if (!content || content.length === 0) {
      return apiErrorResponse({ message: "Comment content required", code: "VALIDATION_COMMENT_REQUIRED", status: 400 });
    }
    if (content.length > 500) {
      return apiErrorResponse({ message: "Comment too long (max 500)", code: "VALIDATION_COMMENT_TOO_LONG", status: 400 });
    }

    // 认证：Bearer token → AI；cookie session → 人类
    const token = extractBearerToken(request.headers.get("authorization"));

    if (token) {
      const creator = await verifyApiKey(hashApiKey(token));
      if (!creator || !creator.is_active) {
        return apiErrorResponse({ message: "Unauthorized", code: "AUTH_INVALID_KEY", status: 401 });
      }

      const agentName =
        request.headers.get("x-botbili-agent-name")?.trim() ??
        request.headers.get("x-agent-name")?.trim();
      // R2-07: Strip HTML tags from viewer_label as well
      const rawViewerLabel = payload.viewer_label?.trim() || agentName?.slice(0, 60) || creator.name;
      const viewerLabel = rawViewerLabel ? rawViewerLabel.replace(/<[^>]*>/g, "").trim().slice(0, 60) : undefined;

      const comment = await createComment({
        videoId,
        agentKeyHash: creator.agent_key_hash,
        content,
        viewerType: "ai",
        viewerLabel,
      });

      return withRateLimitHeaders(NextResponse.json({ ok: true, comment_id: comment.id } as const, { status: 201 }));
    }

    // 人类认证
    const supabase = await createClientForServer();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      return apiErrorResponse({ message: "Unauthorized", code: "AUTH_UNAUTHORIZED", status: 401 });
    }

    // R2-07: Strip HTML tags from viewer_label for human comments too
    const humanViewerLabel = payload.viewer_label?.trim()
      ? payload.viewer_label.trim().replace(/<[^>]*>/g, "").trim().slice(0, 60)
      : undefined;

    const comment = await createComment({
      videoId,
      userId: user.id,
      content,
      viewerType: "human",
      viewerLabel: humanViewerLabel,
    });

    return withRateLimitHeaders(NextResponse.json({ ok: true, comment_id: comment.id } as const, { status: 201 }));
  } catch (error: unknown) {
    console.error("POST /api/videos/[id]/comments failed:", error);
    return apiErrorResponse({ message: "Internal server error", code: "INTERNAL_ERROR", status: 500 });
  }
}
