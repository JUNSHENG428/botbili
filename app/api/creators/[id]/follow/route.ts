import { NextResponse } from "next/server";

import { apiErrorResponse, withRateLimitHeaders } from "@/lib/api-response";
import { extractBearerToken, hashApiKey, verifyApiKey } from "@/lib/auth";
import {
  followCreator,
  getCreatorOwnership,
  getFollowStatus,
  unfollowCreator,
} from "@/lib/follow-repository";
import { createClientForServer } from "@/lib/supabase/server";
import type { ApiError } from "@/types";

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface FollowStatusResponse {
  following: boolean;
}

interface FollowMutationResponse {
  following: boolean;
  followers_count: number;
}

/**
 * curl 测试命令：
 * curl -X GET http://localhost:3000/api/creators/<creatorId>/follow
 * curl -X POST http://localhost:3000/api/creators/<creatorId>/follow
 * curl -X DELETE http://localhost:3000/api/creators/<creatorId>/follow
 */

async function resolveUserId(): Promise<string | null> {
  const supabase = await createClientForServer();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user.id;
}

export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse<ApiError | FollowStatusResponse>> {
  try {
    const { id: creatorId } = await context.params;
    if (!creatorId) {
      return apiErrorResponse({
        message: "Invalid creator id",
        code: "VALIDATION_CREATOR_ID_INVALID",
        status: 400,
      });
    }

    const userId = await resolveUserId();
    if (!userId) {
      return withRateLimitHeaders(NextResponse.json({ following: false }));
    }

    const following = await getFollowStatus(userId, creatorId);
    return withRateLimitHeaders(NextResponse.json({ following }));
  } catch (error: unknown) {
    console.error("GET /api/creators/[id]/follow failed:", error);
    return apiErrorResponse({
      message: "Internal server error",
      code: "INTERNAL_ERROR",
      status: 500,
    });
  }
}

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<NextResponse<ApiError | FollowMutationResponse>> {
  try {
    const { id: creatorId } = await context.params;
    if (!creatorId) {
      return apiErrorResponse({
        message: "Invalid creator id",
        code: "VALIDATION_CREATOR_ID_INVALID",
        status: 400,
      });
    }

    // Bearer token path: agent auth
    const token = extractBearerToken(request.headers.get("authorization"));
    if (token) {
      const agentCreator = await verifyApiKey(hashApiKey(token));
      if (!agentCreator || !agentCreator.is_active) {
        return apiErrorResponse({
          message: "Unauthorized — invalid API key",
          code: "AUTH_INVALID_KEY",
          status: 401,
        });
      }

      // Prevent an agent from following itself
      if (agentCreator.id === creatorId) {
        return apiErrorResponse({
          message: "Cannot follow your own creator",
          code: "VALIDATION_CANNOT_FOLLOW_SELF",
          status: 400,
        });
      }

      const targetCreator = await getCreatorOwnership(creatorId);
      if (!targetCreator) {
        return apiErrorResponse({
          message: "Creator not found",
          code: "RESOURCE_NOT_FOUND",
          status: 404,
        });
      }

      // Use the agent's owner_id as the follower_id so the follows table
      // stores a stable user-scoped identity for the agent.
      const result = await followCreator(agentCreator.owner_id, creatorId);
      return withRateLimitHeaders(
        NextResponse.json(
          {
            following: result.following,
            followers_count: result.followersCount,
          },
          { status: 201 },
        ),
      );
    }

    // Cookie session path: human auth
    const userId = await resolveUserId();
    if (!userId) {
      return apiErrorResponse({
        message: "Unauthorized",
        code: "AUTH_UNAUTHORIZED",
        status: 401,
      });
    }

    const creator = await getCreatorOwnership(creatorId);
    if (!creator) {
      return apiErrorResponse({
        message: "Creator not found",
        code: "RESOURCE_NOT_FOUND",
        status: 404,
      });
    }

    if (creator.owner_id === userId) {
      return apiErrorResponse({
        message: "Cannot follow your own creator",
        code: "VALIDATION_CANNOT_FOLLOW_SELF",
        status: 400,
      });
    }

    const result = await followCreator(userId, creatorId);
    return withRateLimitHeaders(
      NextResponse.json(
        {
          following: result.following,
          followers_count: result.followersCount,
        },
        { status: 201 },
      ),
    );
  } catch (error: unknown) {
    console.error("POST /api/creators/[id]/follow failed:", error);
    return apiErrorResponse({
      message: "Internal server error",
      code: "INTERNAL_ERROR",
      status: 500,
    });
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse<ApiError | FollowMutationResponse>> {
  try {
    const { id: creatorId } = await context.params;
    if (!creatorId) {
      return apiErrorResponse({
        message: "Invalid creator id",
        code: "VALIDATION_CREATOR_ID_INVALID",
        status: 400,
      });
    }

    const userId = await resolveUserId();
    if (!userId) {
      return apiErrorResponse({
        message: "Unauthorized",
        code: "AUTH_UNAUTHORIZED",
        status: 401,
      });
    }

    const creator = await getCreatorOwnership(creatorId);
    if (!creator) {
      return apiErrorResponse({
        message: "Creator not found",
        code: "RESOURCE_NOT_FOUND",
        status: 404,
      });
    }

    if (creator.owner_id === userId) {
      return apiErrorResponse({
        message: "Cannot follow your own creator",
        code: "VALIDATION_CANNOT_FOLLOW_SELF",
        status: 400,
      });
    }

    const result = await unfollowCreator(userId, creatorId);
    return withRateLimitHeaders(
      NextResponse.json({
        following: result.following,
        followers_count: result.followersCount,
      }),
    );
  } catch (error: unknown) {
    console.error("DELETE /api/creators/[id]/follow failed:", error);
    return apiErrorResponse({
      message: "Internal server error",
      code: "INTERNAL_ERROR",
      status: 500,
    });
  }
}
