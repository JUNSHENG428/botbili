import { NextResponse } from "next/server";

import { withRateLimitHeaders } from "@/lib/api-response";

export async function GET(): Promise<NextResponse<{ status: string; timestamp: string }>> {
  return withRateLimitHeaders(
    NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
    }),
  );
}
