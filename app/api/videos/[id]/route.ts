import { NextResponse } from "next/server";

import { apiErrorResponse, withRateLimitHeaders } from "@/lib/api-response";
import { getVideoById } from "@/lib/upload-repository";
import type { ApiError, VideoWithCreator } from "@/types";

interface VideoDetailResponse {
  data: VideoWithCreator;
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse<ApiError | VideoDetailResponse>> {
  try {
    const { id } = await context.params;
    if (!id) {
      return apiErrorResponse({
        message: "Invalid video id",
        code: "VALIDATION_VIDEO_ID_INVALID",
        status: 400,
      });
    }

    const item = await getVideoById(id);
    if (!item) {
      return apiErrorResponse({
        message: "Video not found",
        code: "RESOURCE_NOT_FOUND",
        status: 404,
      });
    }

    return withRateLimitHeaders(NextResponse.json({ data: item }));
  } catch (error: unknown) {
    console.error("GET /api/videos/[id] failed:", error);
    return apiErrorResponse({
      message: "Internal server error",
      code: "INTERNAL_ERROR",
      status: 500,
    });
  }
}
