import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-response";
import { extractBearerToken } from "@/lib/auth";
import { hashApiKey } from "@/lib/auth";
import { verifyApiKey } from "@/lib/upload-repository";
import { getPersonalizedFeed } from "@/lib/personalized-feed";
import type { ApiError } from "@/types";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const authHeader = request.headers.get("Authorization");
    const token = extractBearerToken(authHeader);

    if (!token) {
      return apiErrorResponse({
        message: "Missing API key",
        code: "AUTH_MISSING",
        status: 401,
      });
    }

    const keyHash = hashApiKey(token);
    const creator = await verifyApiKey(keyHash);

    if (!creator) {
      return apiErrorResponse({
        message: "Invalid API key",
        code: "AUTH_INVALID_KEY",
        status: 401,
      });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const pageSize = Math.min(50, parseInt(searchParams.get("page_size") ?? "20", 10));

    const feed = await getPersonalizedFeed(creator.id, page, pageSize);

    return NextResponse.json(feed);
  } catch (error: unknown) {
    console.error("GET /api/feed/personalized failed:", error);
    return apiErrorResponse({
      message: "Internal server error",
      code: "INTERNAL_ERROR",
      status: 500,
    });
  }
}
