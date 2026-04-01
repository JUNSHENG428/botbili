import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-response";
import { searchVideos } from "@/lib/search";
import type { ApiError } from "@/types";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q");

    if (!q || q.trim().length < 2) {
      return apiErrorResponse({
        message: "Query parameter 'q' is required (min 2 characters)",
        code: "VALIDATION_MISSING_QUERY",
        status: 400,
      });
    }

    const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 50);

    const results = await searchVideos(q.trim(), limit);

    return NextResponse.json({
      query: q.trim(),
      count: results.length,
      results,
    });
  } catch (error: unknown) {
    console.error("GET /api/search failed:", error);
    return apiErrorResponse({
      message: "Internal server error",
      code: "INTERNAL_ERROR",
      status: 500,
    });
  }
}
