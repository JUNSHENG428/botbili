import { NextRequest, NextResponse } from "next/server";

import { apiErrorResponse, withRateLimitHeaders } from "@/lib/api-response";
import { getCreatorById, getPublishedVideosByCreatorId } from "@/lib/upload-repository";
import type { ApiError } from "@/types";

interface JsonFeedItem {
  id: string;
  url: string;
  title: string;
  transcript: string | null;
  summary: string | null;
  language: string | null;
  image?: string;
  date_published: string;
  tags: string[];
}

interface JsonFeedResponse {
  version: string;
  title: string;
  home_page_url: string;
  feed_url: string;
  description: string;
  items: JsonFeedItem[];
}

interface RouteContext {
  params: Promise<{ slug: string }>;
}

function parseCreatorIdFromSlug(slug: string): string | null {
  if (!slug.endsWith(".json")) {
    return null;
  }
  const creatorId = slug.slice(0, -5);
  return creatorId.length > 0 ? creatorId : null;
}

export async function GET(
  _request: NextRequest,
  context: RouteContext,
): Promise<NextResponse<ApiError | JsonFeedResponse>> {
  try {
    const { slug } = await context.params;
    const creatorId = parseCreatorIdFromSlug(slug);
    if (!creatorId) {
      return apiErrorResponse({
        message: "Invalid creator id",
        code: "VALIDATION_CREATOR_ID_INVALID",
        status: 400,
      });
    }

    const creator = await getCreatorById(creatorId);
    if (!creator) {
      return apiErrorResponse({
        message: "Creator not found",
        code: "RESOURCE_NOT_FOUND",
        status: 404,
      });
    }

    const { getBaseUrl } = await import("@/lib/utils");
    const appUrl = getBaseUrl();
    const videos = await getPublishedVideosByCreatorId(creator.id);
    const items: JsonFeedItem[] = videos.map((video) => ({
      id: video.id,
      url: `${appUrl}/v/${video.id}`,
      title: video.title,
      transcript: video.transcript,
      summary: video.summary,
      language: video.language ?? null,
      image: video.thumbnail_url ?? undefined,
      date_published: video.created_at,
      tags: video.tags ?? [],
    }));

    const feed: JsonFeedResponse = {
      version: "https://jsonfeed.org/version/1.1",
      title: `${creator.name} - BotBili`,
      home_page_url: `${appUrl}/c/${creator.id}`,
      feed_url: `${appUrl}/feed/${creator.id}.json`,
      description: creator.bio || `${creator.name} 的 BotBili 视频 Feed`,
      items,
    };

    const response = NextResponse.json(feed);
    response.headers.set("Content-Type", "application/feed+json; charset=utf-8");
    return withRateLimitHeaders(response);
  } catch (error: unknown) {
    console.error("GET /feed/[slug] failed:", error);
    return apiErrorResponse({
      message: "Internal server error",
      code: "INTERNAL_ERROR",
      status: 500,
    });
  }
}
