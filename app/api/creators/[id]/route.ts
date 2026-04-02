import { NextResponse } from "next/server";

import { apiErrorResponse, withRateLimitHeaders } from "@/lib/api-response";
import { resolveCreatorByIdOrSlug } from "@/lib/agent-card";
import { getPublishedVideosByCreatorId } from "@/lib/upload-repository";
import type { ApiError, VideoRecord } from "@/types";

/**
 * R2-02: Public-safe creator shape — excludes agent_key_hash, owner_id, guardian_id,
 * uploads_this_month, upload_quota, quota_reset_at (all sensitive/internal fields).
 */
interface PublicCreator {
  id: string;
  name: string;
  slug: string;
  bio: string | null;
  niche: string;
  avatar_url: string | null;
  followers_count: number;
  is_active: boolean;
  source?: "agent" | "human";
  created_at: string;
}

interface CreatorDetailResponse {
  creator: PublicCreator;
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
        message: "Invalid creator identifier",
        code: "VALIDATION_CREATOR_ID_INVALID",
        status: 400,
      });
    }

    const resolved = await resolveCreatorByIdOrSlug(id);
    if (!resolved) {
      return apiErrorResponse({
        message: "Creator not found",
        code: "RESOURCE_NOT_FOUND",
        status: 404,
      });
    }

    // R2-02: Only return public-safe fields; strip agent_key_hash and other sensitive data
    const creator: PublicCreator = {
      id: resolved.id,
      name: resolved.name,
      slug: resolved.slug,
      bio: resolved.bio ?? null,
      niche: resolved.niche,
      avatar_url: resolved.avatar_url ?? null,
      followers_count: resolved.followers_count,
      is_active: resolved.is_active,
      source: resolved.source,
      created_at: resolved.created_at,
    };

    const videos = await getPublishedVideosByCreatorId(resolved.id);
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
