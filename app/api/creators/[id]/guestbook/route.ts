import { NextResponse } from "next/server";

import { apiErrorResponse, withRateLimitHeaders } from "@/lib/api-response";
import { createClientForServer } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { ApiError } from "@/types";

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface GuestbookEntry {
  id: string;
  creator_id: string;
  author_type: string;
  author_user_id: string | null;
  author_creator_id: string | null;
  author_name: string;
  content: string;
  created_at: string;
}

interface GuestbookListResponse {
  data: GuestbookEntry[];
}

interface GuestbookCreateResponse {
  ok: true;
  id: string;
}

/**
 * GET /api/creators/[id]/guestbook — list latest 50 messages
 */
export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse<ApiError | GuestbookListResponse>> {
  try {
    const { id: creatorId } = await context.params;
    if (!creatorId) {
      return apiErrorResponse({ message: "Invalid creator id", code: "VALIDATION_CREATOR_ID_INVALID", status: 400 });
    }

    const admin = getSupabaseAdminClient();
    const { data, error } = await admin
      .from("guestbook")
      .select("*")
      .eq("creator_id", creatorId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("GET /api/creators/[id]/guestbook DB error:", error);
      return apiErrorResponse({ message: "Internal server error", code: "INTERNAL_ERROR", status: 500 });
    }

    return withRateLimitHeaders(NextResponse.json({ data: data ?? [] }));
  } catch (error: unknown) {
    console.error("GET /api/creators/[id]/guestbook failed:", error);
    return apiErrorResponse({ message: "Internal server error", code: "INTERNAL_ERROR", status: 500 });
  }
}

/**
 * POST /api/creators/[id]/guestbook — leave a message (requires login)
 * Body: { content: string } (1-300 chars)
 */
export async function POST(
  request: Request,
  context: RouteContext,
): Promise<NextResponse<ApiError | GuestbookCreateResponse>> {
  try {
    const { id: creatorId } = await context.params;
    if (!creatorId) {
      return apiErrorResponse({ message: "Invalid creator id", code: "VALIDATION_CREATOR_ID_INVALID", status: 400 });
    }

    // Auth: require user session
    const supabase = await createClientForServer();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return apiErrorResponse({ message: "Unauthorized", code: "AUTH_UNAUTHORIZED", status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiErrorResponse({ message: "Invalid JSON body", code: "VALIDATION_JSON_INVALID", status: 400 });
    }

    const payload = body as { content?: string };
    const rawContent = payload.content?.trim() ?? "";
    // Sanitize HTML tags
    const content = rawContent.replace(/<[^>]*>/g, "").trim();

    if (!content || content.length === 0) {
      return apiErrorResponse({ message: "Content required", code: "VALIDATION_CONTENT_REQUIRED", status: 400 });
    }
    if (content.length > 300) {
      return apiErrorResponse({ message: "Content too long (max 300)", code: "VALIDATION_CONTENT_TOO_LONG", status: 400 });
    }

    // Get user profile for display name
    const admin = getSupabaseAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("display_name, username")
      .eq("id", user.id)
      .single();

    const authorName =
      profile?.display_name ||
      profile?.username ||
      user.email?.split("@")[0] ||
      "匿名用户";

    const { data: inserted, error: insertError } = await admin
      .from("guestbook")
      .insert({
        creator_id: creatorId,
        author_type: "user",
        author_user_id: user.id,
        author_creator_id: null,
        author_name: authorName,
        content,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("POST /api/creators/[id]/guestbook insert error:", insertError);
      return apiErrorResponse({ message: "Internal server error", code: "INTERNAL_ERROR", status: 500 });
    }

    return withRateLimitHeaders(
      NextResponse.json({ ok: true as const, id: inserted.id }, { status: 201 }),
    );
  } catch (error: unknown) {
    console.error("POST /api/creators/[id]/guestbook failed:", error);
    return apiErrorResponse({ message: "Internal server error", code: "INTERNAL_ERROR", status: 500 });
  }
}
