import { NextResponse } from "next/server";

import { apiErrorResponse, withRateLimitHeaders } from "@/lib/api-response";
import { generateAgentCard } from "@/lib/agent-card";
import { getBaseUrl } from "@/lib/utils";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    if (!id) {
      return apiErrorResponse({
        message: "Invalid creator identifier",
        code: "VALIDATION_CREATOR_ID_INVALID",
        status: 400,
      });
    }

    const agentCard = await generateAgentCard(id, getBaseUrl());
    if (!agentCard) {
      return apiErrorResponse({
        message: "Creator not found",
        code: "RESOURCE_NOT_FOUND",
        status: 404,
      });
    }

    return withRateLimitHeaders(
      NextResponse.json(agentCard, {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "public, max-age=3600",
        },
      }),
    );
  } catch (error: unknown) {
    console.error("GET /api/creators/[id]/agent.json failed:", error);
    return apiErrorResponse({
      message: "Internal server error",
      code: "INTERNAL_ERROR",
      status: 500,
    });
  }
}
