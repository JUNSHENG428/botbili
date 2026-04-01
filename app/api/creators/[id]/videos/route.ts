import { NextResponse } from "next/server";

import { apiErrorResponse, withRateLimitHeaders } from "@/lib/api-response";
import { resolveCreatorByIdOrSlug } from "@/lib/agent-card";
import { getPublishedVideosByCreatorId } from "@/lib/upload-repository";
import type { ApiError, VideoRecord } from "@/types";

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface CreatorVideosResponse {
  creator: {
    id: string;
    slug: string;
    name: string;
    niche: string;
    avatar_url: string | null;
  };
  count: number;
  videos: VideoRecord[];
}

export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse<ApiError | CreatorVideosResponse>> {
  try {
    const { id } = await context.params;
    if (!id) {
      return apiErrorResponse({
        message: "Invalid creator identifier",
        code: "VALIDATION_CREATOR_ID_INVALID",
        status: 400,
      });
    }

    const creator = await resolveCreatorByIdOrSlug(id);
    if (!creator) {
      return apiErrorResponse({
        message: "Creator not found",
        code: "RESOURCE_NOT_FOUND",
        status: 404,
      });
    }

    const videos = await getPublishedVideosByCreatorId(creator.id);
    return withRateLimitHeaders(
      NextResponse.json({
        creator: {
          id: creator.id,
          slug: creator.slug,
          name: creator.name,
          niche: creator.niche,
          avatar_url: creator.avatar_url,
        },
        count: videos.length,
        videos,
      }),
    );
  } catch (error: unknown) {
    console.error("GET /api/creators/[id]/videos failed:", error);
    return apiErrorResponse({
      message: "Internal server error",
      code: "INTERNAL_ERROR",
      status: 500,
    });
  }
}
