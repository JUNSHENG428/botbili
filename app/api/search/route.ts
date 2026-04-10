import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-response";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { searchVideos } from "@/lib/search";
import type { ApiError } from "@/types";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") ?? "video";
    const q = searchParams.get("q");

    if (!q || q.trim().length < 2) {
      return apiErrorResponse({
        message: "Query parameter 'q' is required (min 2 characters)",
        code: "VALIDATION_MISSING_QUERY",
        status: 400,
      });
    }

    const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 50);

    if (type === "recipe") {
      const supabase = getSupabaseAdminClient();
      const { data } = await supabase
        .from("recipes")
        .select("id, title, description, tags, star_count, fork_count, author_type, created_at")
        .or(`title.ilike.%${q}%,description.ilike.%${q}%`)
        .eq("visibility", "public")
        .order("star_count", { ascending: false })
        .limit(limit);

      return NextResponse.json({
        type: "recipe",
        query: q.trim(),
        count: data?.length ?? 0,
        recipes: data ?? [],
      });
    }

    const results = await searchVideos(q.trim(), limit);

    return NextResponse.json({
      type: "video",
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
