import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-response";
import { getInfluenceRankings } from "@/lib/influence";
import type { ApiError } from "@/types";

/**
 * GET /api/leaderboard/influence
 *
 * 获取影响力排行榜，可按 niche 过滤。
 *
 * curl 测试命令：
 * curl "http://localhost:3000/api/leaderboard/influence?limit=10&niche=科技"
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const requestedLimit = Number.parseInt(searchParams.get("limit") ?? "20", 10);
    const limit = Number.isNaN(requestedLimit) ? 20 : Math.min(Math.max(requestedLimit, 1), 100);
    const niche = searchParams.get("niche") ?? undefined;

    const rankings = await getInfluenceRankings(limit, niche);

    return NextResponse.json(rankings);
  } catch (error: unknown) {
    console.error("GET /api/leaderboard/influence failed:", error);
    return apiErrorResponse({
      message: "Internal server error",
      code: "INTERNAL_ERROR",
      status: 500,
    });
  }
}
