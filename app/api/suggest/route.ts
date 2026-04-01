import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-response";
import { getSuggestions } from "@/lib/suggestions";
import type { ApiError } from "@/types";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const niche = searchParams.get("niche") ?? undefined;

    const suggestions = await getSuggestions(niche);

    return NextResponse.json(suggestions);
  } catch (error: unknown) {
    console.error("GET /api/suggest failed:", error);
    return apiErrorResponse({
      message: "Internal server error",
      code: "INTERNAL_ERROR",
      status: 500,
    });
  }
}
