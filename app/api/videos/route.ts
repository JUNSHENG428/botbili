import { NextRequest, NextResponse } from "next/server";

import { apiErrorResponse, withRateLimitHeaders } from "@/lib/api-response";
import { getPublishedVideos } from "@/lib/upload-repository";
import type { ApiError, VideoWithCreator, VideoWithCreatorWithoutTranscript } from "@/types";

interface VideosResponse<TItem extends VideoWithCreator | VideoWithCreatorWithoutTranscript> {
  data: TItem[];
  pagination: {
    page: number;
    page_size: number;
    total: number;
    has_more: boolean;
  };
}

export async function GET(
  request: NextRequest,
): Promise<
  NextResponse<
    | ApiError
    | VideosResponse<VideoWithCreator>
    | VideosResponse<VideoWithCreatorWithoutTranscript>
  >
> {
  try {
    const { searchParams } = request.nextUrl;
    const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const pageSize = Math.min(50, Math.max(1, Number(searchParams.get("page_size") ?? "12")));
    const sortParam = searchParams.get("sort");
    const sort = sortParam === "latest" ? "latest" : "hot";
    const includeTranscript = searchParams.get("include") === "transcript";

    const result = includeTranscript
      ? await getPublishedVideos(page, pageSize, sort, { includeTranscript: true })
      : await getPublishedVideos(page, pageSize, sort, { includeTranscript: false });
    return withRateLimitHeaders(
      NextResponse.json({
        data: result.items,
        pagination: {
          page,
          page_size: pageSize,
          total: result.total,
          has_more: result.hasMore,
        },
      }),
    );
  } catch (error: unknown) {
    console.error("GET /api/videos failed:", error);
    return apiErrorResponse({
      message: "Internal server error",
      code: "INTERNAL_ERROR",
      status: 500,
    });
  }
}
