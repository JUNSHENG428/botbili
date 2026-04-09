import { NextRequest, NextResponse } from "next/server";

import { apiErrorResponse, withRateLimitHeaders } from "@/lib/api-response";
import { resolveCreatorByIdOrSlug } from "@/lib/agent-card";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { getBaseUrl } from "@/lib/utils";
import type { ApiError } from "@/types";

interface JsonFeedItem {
  id: string;
  url: string;
  title: string;
  summary: string | null;
  content_text: string | null;
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

function parseCreatorIdentifierFromSlug(slug: string): string | null {
  if (!slug.endsWith(".json")) {
    return null;
  }
  const creatorIdentifier = slug.slice(0, -5);
  return creatorIdentifier.length > 0 ? creatorIdentifier : null;
}

export async function GET(
  _request: NextRequest,
  context: RouteContext,
): Promise<NextResponse<ApiError | JsonFeedResponse>> {
  try {
    const { slug } = await context.params;
    const creatorIdentifier = parseCreatorIdentifierFromSlug(slug);
    if (!creatorIdentifier) {
      return apiErrorResponse({
        message: "Invalid creator identifier",
        code: "VALIDATION_CREATOR_ID_INVALID",
        status: 400,
      });
    }

    const creator = await resolveCreatorByIdOrSlug(creatorIdentifier);
    if (!creator) {
      return apiErrorResponse({
        message: "Creator not found",
        code: "RESOURCE_NOT_FOUND",
        status: 404,
      });
    }

    const appUrl = getBaseUrl();
    const supabase = getSupabaseAdminClient();
    const { data: recipes, error } = await supabase
      .from("recipes")
      .select("id, slug, title, description, readme_md, category, difficulty, platforms, platform, created_at")
      .eq("author_id", creator.owner_id)
      .eq("status", "published")
      .eq("visibility", "public")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      throw new Error(`recipe feed lookup failed: ${error.message}`);
    }

    const items: JsonFeedItem[] = (recipes ?? []).map((recipe) => {
      const platforms = Array.isArray(recipe.platforms) && recipe.platforms.length > 0
        ? recipe.platforms
        : Array.isArray(recipe.platform)
          ? recipe.platform
          : [];
      const tags = [recipe.category, recipe.difficulty, ...platforms]
        .filter((value): value is string => Boolean(value))
        .map((value) => value.trim())
        .filter(Boolean);

      return {
        id: recipe.id,
        url: `${appUrl}/recipes/${recipe.slug ?? recipe.id}`,
        title: recipe.title,
        summary: recipe.description ?? null,
        content_text: recipe.readme_md ?? recipe.description ?? null,
        date_published: recipe.created_at,
        tags,
      };
    });

    const feed: JsonFeedResponse = {
      version: "https://jsonfeed.org/version/1.1",
      title: `${creator.name} - Recipe Feed`,
      home_page_url: `${appUrl}/u/${creator.slug}`,
      feed_url: `${appUrl}/feed/${creator.slug}.json`,
      description: creator.bio || `${creator.name} 的公开 Recipe Feed`,
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
