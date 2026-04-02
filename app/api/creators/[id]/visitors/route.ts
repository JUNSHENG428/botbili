import { NextResponse } from "next/server";

import { apiErrorResponse, withRateLimitHeaders } from "@/lib/api-response";
import { extractBearerToken, hashApiKey, verifyApiKey } from "@/lib/auth";
import { createClientForServer } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { ApiError } from "@/types";

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface VisitorEntry {
  id: string;
  creator_id: string;
  visitor_type: string;
  visitor_user_id: string | null;
  visitor_creator_id: string | null;
  visitor_name: string;
  visited_at: string;
}

interface VisitorsListResponse {
  data: VisitorEntry[];
}

interface VisitRecordResponse {
  ok: true;
  recorded: boolean;
}

/**
 * GET /api/creators/[id]/visitors — list recent 20 visitors
 */
export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse<ApiError | VisitorsListResponse>> {
  try {
    const { id: creatorId } = await context.params;
    if (!creatorId) {
      return apiErrorResponse({ message: "Invalid creator id", code: "VALIDATION_CREATOR_ID_INVALID", status: 400 });
    }

    const admin = getSupabaseAdminClient();
    const { data, error } = await admin
      .from("visitor_logs")
      .select("*")
      .eq("creator_id", creatorId)
      .order("visited_at", { ascending: false })
      .limit(20);

    if (error) {
      console.error("GET /api/creators/[id]/visitors DB error:", error);
      return apiErrorResponse({ message: "Internal server error", code: "INTERNAL_ERROR", status: 500 });
    }

    return withRateLimitHeaders(NextResponse.json({ data: data ?? [] }));
  } catch (error: unknown) {
    console.error("GET /api/creators/[id]/visitors failed:", error);
    return apiErrorResponse({ message: "Internal server error", code: "INTERNAL_ERROR", status: 500 });
  }
}

/**
 * POST /api/creators/[id]/visitors — record a visit
 * Deduplicates: same visitor within 1 hour won't be re-recorded
 * Increments visitor_count via RPC
 */
export async function POST(
  request: Request,
  context: RouteContext,
): Promise<NextResponse<ApiError | VisitRecordResponse>> {
  try {
    const { id: creatorId } = await context.params;
    if (!creatorId) {
      return apiErrorResponse({ message: "Invalid creator id", code: "VALIDATION_CREATOR_ID_INVALID", status: 400 });
    }

    const admin = getSupabaseAdminClient();
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    // Bearer token path: agent visit
    const token = extractBearerToken(request.headers.get("authorization"));
    if (token) {
      const agentCreator = await verifyApiKey(hashApiKey(token));
      if (!agentCreator || !agentCreator.is_active) {
        return apiErrorResponse({ message: "Unauthorized — invalid API key", code: "AUTH_INVALID_KEY", status: 401 });
      }

      // Deduplication: same agent visitor within 1 hour
      const { data: recent } = await admin
        .from("visitor_logs")
        .select("id")
        .eq("creator_id", creatorId)
        .eq("visitor_creator_id", agentCreator.id)
        .gte("visited_at", oneHourAgo)
        .limit(1);

      if (recent && recent.length > 0) {
        return withRateLimitHeaders(NextResponse.json({ ok: true as const, recorded: false }));
      }

      const { error: insertError } = await admin
        .from("visitor_logs")
        .insert({
          creator_id: creatorId,
          visitor_type: "agent",
          visitor_user_id: null,
          visitor_creator_id: agentCreator.id,
          visitor_name: agentCreator.name,
        });

      if (insertError) {
        console.error("POST /api/creators/[id]/visitors (agent) insert error:", insertError);
        return apiErrorResponse({ message: "Internal server error", code: "INTERNAL_ERROR", status: 500 });
      }

      await admin.rpc("increment_creator_counter", {
        p_creator_id: creatorId,
        p_field: "visitor_count",
        p_delta: 1,
      });

      return withRateLimitHeaders(
        NextResponse.json({ ok: true as const, recorded: true }, { status: 201 }),
      );
    }

    // Cookie session path: human visit
    const supabase = await createClientForServer();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      // Silently skip unauthenticated visits
      return withRateLimitHeaders(NextResponse.json({ ok: true as const, recorded: false }));
    }

    // Deduplication: check if same visitor visited within 1 hour
    const { data: recent } = await admin
      .from("visitor_logs")
      .select("id")
      .eq("creator_id", creatorId)
      .eq("visitor_user_id", user.id)
      .gte("visited_at", oneHourAgo)
      .limit(1);

    if (recent && recent.length > 0) {
      // Already recorded within the last hour
      return withRateLimitHeaders(NextResponse.json({ ok: true as const, recorded: false }));
    }

    // Get user profile for display name
    const { data: profile } = await admin
      .from("profiles")
      .select("display_name, username")
      .eq("id", user.id)
      .single();

    const visitorName =
      profile?.display_name ||
      profile?.username ||
      user.email?.split("@")[0] ||
      "匿名用户";

    // Record the visit
    const { error: insertError } = await admin
      .from("visitor_logs")
      .insert({
        creator_id: creatorId,
        visitor_type: "user",
        visitor_user_id: user.id,
        visitor_creator_id: null,
        visitor_name: visitorName,
      });

    if (insertError) {
      console.error("POST /api/creators/[id]/visitors insert error:", insertError);
      return apiErrorResponse({ message: "Internal server error", code: "INTERNAL_ERROR", status: 500 });
    }

    // Atomically increment visitor_count
    await admin.rpc("increment_creator_counter", {
      p_creator_id: creatorId,
      p_field: "visitor_count",
      p_delta: 1,
    });

    return withRateLimitHeaders(
      NextResponse.json({ ok: true as const, recorded: true }, { status: 201 }),
    );
  } catch (error: unknown) {
    console.error("POST /api/creators/[id]/visitors failed:", error);
    return apiErrorResponse({ message: "Internal server error", code: "INTERNAL_ERROR", status: 500 });
  }
}
