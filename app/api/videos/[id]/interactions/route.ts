import { NextResponse } from "next/server";

import { apiErrorResponse, withRateLimitHeaders } from "@/lib/api-response";
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

const VALID_VIEWER_TYPES: ViewerType[] = ["ai", "human"];
const VALID_ACTIONS: InteractionAction[] = ["view", "like", "comment", "share"];

function parseBearerToken(authorizationHeader: string | null): string | null {
  if (!authorizationHeader) {
    return null;
  }
  const [scheme, token] = authorizationHeader.split(" ");
  if (scheme !== "Bearer" || !token) {
    return null;
  }
  return token.trim();
}

function resolveViewerType(request: Request, explicitViewerType?: ViewerType): ViewerType {
  if (explicitViewerType && VALID_VIEWER_TYPES.includes(explicitViewerType)) {
    return explicitViewerType;
  }

  const headerViewerType = request.headers.get("x-botbili-viewer-type");
  if (headerViewerType === "ai" || headerViewerType === "human") {
    return headerViewerType;
  }

  const token = parseBearerToken(request.headers.get("authorization"));
  if (token?.startsWith("bb_")) {
    return "ai";
  }

  return "human";
}

function resolveViewerLabel(
  request: Request,
  explicitViewerLabel: string | undefined,
  viewerType: ViewerType,
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

  return "AI Viewer";
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

    const resolvedViewerType = resolveViewerType(request, payload.viewer_type);
    const resolvedViewerLabel = resolveViewerLabel(
      request,
      payload.viewer_label,
      resolvedViewerType,
    );

    await createVideoInteraction({
      videoId,
      viewerType: resolvedViewerType,
      action: payload.action,
      content: payload.content?.trim(),
      viewerLabel: resolvedViewerLabel,
    });

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
