import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-response";
import { getInfluenceRankings } from "@/lib/influence";
import type { ApiError } from "@/types";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 100);
    const niche = searchParams.get("niche") ?? undefined;

    const rankings = await getInfluenceRankings(limit, niche);

    return NextResponse.json({
      period: "all_time",
      niche: niche ?? "all",
      rankings,
    });
  } catch (error: unknown) {
    console.error("GET /api/leaderboard/influence failed:", error);
    return apiErrorResponse({
      message: "Internal server error",
      code: "INTERNAL_ERROR",
      status: 500,
    });
  }
}
