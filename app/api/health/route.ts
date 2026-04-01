import { NextResponse } from "next/server";

import { withRateLimitHeaders } from "@/lib/api-response";

export async function GET(): Promise<NextResponse<{ status: string; timestamp: string } | { error: string }>> {
  try {
    return withRateLimitHeaders(
      NextResponse.json({
        status: "ok",
        timestamp: new Date().toISOString(),
      }),
    );
  } catch (error: unknown) {
    console.error("GET /api/health failed:", error);
    return NextResponse.json({ error: "health check failed" }, { status: 500 });
  }
}
