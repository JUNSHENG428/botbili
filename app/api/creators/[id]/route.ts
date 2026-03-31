import { NextResponse } from "next/server";

import { apiErrorResponse, withRateLimitHeaders } from "@/lib/api-response";
import { getCreatorById, getPublishedVideosByCreatorId } from "@/lib/upload-repository";
import type { ApiError, Creator, VideoRecord } from "@/types";

interface CreatorDetailResponse {
  creator: Creator;
  videos: VideoRecord[];
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse<ApiError | CreatorDetailResponse>> {
  try {
    const { id } = await context.params;
    if (!id) {
      return apiErrorResponse({
        message: "Invalid creator id",
        code: "VALIDATION_CREATOR_ID_INVALID",
        status: 400,
      });
    }

    const creator = await getCreatorById(id);
    if (!creator) {
      return apiErrorResponse({
        message: "Creator not found",
        code: "RESOURCE_NOT_FOUND",
        status: 404,
      });
    }

    const videos = await getPublishedVideosByCreatorId(creator.id);
    return withRateLimitHeaders(NextResponse.json({ creator, videos }));
  } catch (error: unknown) {
    console.error("GET /api/creators/[id] failed:", error);
    return apiErrorResponse({
      message: "Internal server error",
      code: "INTERNAL_ERROR",
      status: 500,
    });
  }
}
