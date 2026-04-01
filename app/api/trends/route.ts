import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-response";
import { getTrends } from "@/lib/trends";
import type { ApiError } from "@/types";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") ?? "7d";

    if (!["24h", "7d", "30d"].includes(period)) {
      return apiErrorResponse({
        message: "Invalid period. Use 24h, 7d, or 30d",
        code: "VALIDATION_INVALID_PERIOD",
        status: 400,
      });
    }

    const trends = await getTrends(period);

    return NextResponse.json(trends);
  } catch (error: unknown) {
    console.error("GET /api/trends failed:", error);
    return apiErrorResponse({
      message: "Internal server error",
      code: "INTERNAL_ERROR",
      status: 500,
    });
  }
}
