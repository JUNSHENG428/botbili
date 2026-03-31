import { NextResponse } from "next/server";

import { apiErrorResponse, withRateLimitHeaders } from "@/lib/api-response";
import { extractBearerToken, hashApiKey, verifyApiKey } from "@/lib/auth";
import { createComment } from "@/lib/comments";
import { addLike } from "@/lib/likes";
import { createClientForServer } from "@/lib/supabase/server";
import { createVideoInteraction, getVideoInteractionSummary } from "@/lib/video-interactions";
import type { ApiError, InteractionAction, VideoInteractionSummary, ViewerType } from "@/types";

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface InteractionCreateRequest {
  viewer_type?: ViewerType;
  action: InteractionAction;
  content?: string;
  viewer_label?: string;
}

interface InteractionCreateResponse {
  ok: true;
}

interface InteractionSummaryResponse {
  data: VideoInteractionSummary;
}

const VALID_VIEWER_TYPES: ViewerType[] = ["human", "ai"];
const VALID_ACTIONS: InteractionAction[] = ["view", "like", "comment", "share"];

function resolveViewerLabel(
  request: Request,
  explicitViewerLabel: string | undefined,
  viewerType: ViewerType,
  fallbackViewerLabel?: string,
): string | undefined {
  const normalizedExplicit = explicitViewerLabel?.trim();
  if (normalizedExplicit) {
    return normalizedExplicit;
  }

  if (viewerType !== "ai") {
    return undefined;
  }

  const headerAgentName =
    request.headers.get("x-botbili-agent-name") ?? request.headers.get("x-agent-name");
  const normalizedHeaderName = headerAgentName?.trim();
  if (normalizedHeaderName) {
    return normalizedHeaderName.slice(0, 60);
  }

  return fallbackViewerLabel ?? "AI Viewer";
}

interface ResolvedViewerContext {
  viewerType: ViewerType;
  viewerLabel?: string;
}

async function resolveViewerContext(
  request: Request,
  payload: InteractionCreateRequest,
): Promise<ResolvedViewerContext | NextResponse<ApiError>> {
  const token = extractBearerToken(request.headers.get("authorization"));

  if (token) {
    const creator = await verifyApiKey(hashApiKey(token));
    if (!creator || !creator.is_active) {
      return apiErrorResponse({
        message: "Unauthorized",
        code: "AUTH_INVALID_KEY",
        status: 401,
      });
    }
    if (payload.viewer_type === "human") {
      return apiErrorResponse({
        message: "viewer_type mismatch with auth mode",
        code: "VALIDATION_VIEWER_TYPE_MISMATCH",
        status: 400,
      });
    }

    return {
      viewerType: "ai",
      viewerLabel: resolveViewerLabel(request, payload.viewer_label, "ai", creator.name),
    };
  }

  if (payload.viewer_type === "ai") {
    return apiErrorResponse({
      message: "Unauthorized",
      code: "AUTH_INVALID_KEY",
      status: 401,
    });
  }

  const supabase = await createClientForServer();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return apiErrorResponse({
      message: "Unauthorized",
      code: "AUTH_UNAUTHORIZED",
      status: 401,
    });
  }

  return {
    viewerType: "human",
    viewerLabel: resolveViewerLabel(request, payload.viewer_label, "human"),
  };
}

/**
 * curl 测试命令：
 * curl -X POST http://localhost:3000/api/videos/<videoId>/interactions \
 *  -H "Content-Type: application/json" \
 *  -d '{"viewer_type":"ai","action":"comment","content":"Agent 点评","viewer_label":"OpenClaw"}'
 */
export async function POST(
  request: Request,
  context: RouteContext,
): Promise<NextResponse<ApiError | InteractionCreateResponse>> {
  try {
    const { id: videoId } = await context.params;
    if (!videoId) {
      return apiErrorResponse({
        message: "Invalid video id",
        code: "VALIDATION_VIDEO_ID_INVALID",
        status: 400,
      });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiErrorResponse({
        message: "Invalid JSON body",
        code: "VALIDATION_JSON_INVALID",
        status: 400,
      });
    }

    if (!body || typeof body !== "object") {
      return apiErrorResponse({
        message: "Invalid request body",
        code: "VALIDATION_REQUEST_BODY_INVALID",
        status: 400,
      });
    }

    const payload = body as InteractionCreateRequest;
    if (payload.viewer_type !== undefined && !VALID_VIEWER_TYPES.includes(payload.viewer_type)) {
      return apiErrorResponse({
        message: "Invalid viewer_type",
        code: "VALIDATION_VIEWER_TYPE_INVALID",
        status: 400,
      });
    }
    if (!VALID_ACTIONS.includes(payload.action)) {
      return apiErrorResponse({
        message: "Invalid action",
        code: "VALIDATION_ACTION_INVALID",
        status: 400,
      });
    }
    if (payload.action === "comment" && (!payload.content || payload.content.trim().length === 0)) {
      return apiErrorResponse({
        message: "Comment content required",
        code: "VALIDATION_COMMENT_REQUIRED",
        status: 400,
      });
    }
    if (payload.viewer_label && payload.viewer_label.length > 60) {
      return apiErrorResponse({
        message: "viewer_label too long",
        code: "VALIDATION_VIEWER_LABEL_INVALID",
        status: 400,
      });
    }
    if (payload.content && payload.content.length > 500) {
      return apiErrorResponse({
        message: "Comment too long",
        code: "VALIDATION_COMMENT_TOO_LONG",
        status: 400,
      });
    }

    const resolvedViewer = await resolveViewerContext(request, payload);
    if (resolvedViewer instanceof NextResponse) {
      return resolvedViewer;
    }

    await createVideoInteraction({
      videoId,
      viewerType: resolvedViewer.viewerType,
      action: payload.action,
      content: payload.content?.trim(),
      viewerLabel: resolvedViewer.viewerLabel,
    });

    // 向后兼容：同步写入独立 comments / likes 表
    try {
      if (payload.action === "comment" && payload.content?.trim()) {
        const token = extractBearerToken(request.headers.get("authorization"));
        await createComment({
          videoId,
          agentKeyHash: token ? hashApiKey(token) : undefined,
          content: payload.content.trim(),
          viewerType: resolvedViewer.viewerType,
          viewerLabel: resolvedViewer.viewerLabel,
        });
      } else if (payload.action === "like") {
        const token = extractBearerToken(request.headers.get("authorization"));
        await addLike({
          videoId,
          agentKeyHash: token ? hashApiKey(token) : undefined,
          viewerType: resolvedViewer.viewerType,
        });
      }
    } catch {
      // 独立表写入失败不阻塞 interactions API 返回
    }

    return withRateLimitHeaders(NextResponse.json({ ok: true }, { status: 201 }));
  } catch (error: unknown) {
    console.error("POST /api/videos/[id]/interactions failed:", error);
    return apiErrorResponse({
      message: "Internal server error",
      code: "INTERNAL_ERROR",
      status: 500,
    });
  }
}

export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse<ApiError | InteractionSummaryResponse>> {
  try {
    const { id: videoId } = await context.params;
    if (!videoId) {
      return apiErrorResponse({
        message: "Invalid video id",
        code: "VALIDATION_VIDEO_ID_INVALID",
        status: 400,
      });
    }

    const summary = await getVideoInteractionSummary(videoId);
    return withRateLimitHeaders(NextResponse.json({ data: summary }));
  } catch (error: unknown) {
    console.error("GET /api/videos/[id]/interactions failed:", error);
    return apiErrorResponse({
      message: "Internal server error",
      code: "INTERNAL_ERROR",
      status: 500,
    });
  }
}
