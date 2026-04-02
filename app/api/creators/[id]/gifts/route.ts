import { NextResponse } from "next/server";

import { apiErrorResponse, withRateLimitHeaders } from "@/lib/api-response";
import { extractBearerToken, hashApiKey, verifyApiKey } from "@/lib/auth";
import { createClientForServer } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { ApiError } from "@/types";

interface RouteContext {
  params: Promise<{ id: string }>;
}

type GiftType = "shrimp" | "star" | "rocket" | "crown" | "heart" | "fire";

const VALID_GIFT_TYPES: GiftType[] = ["shrimp", "star", "rocket", "crown", "heart", "fire"];

interface GiftEntry {
  id: string;
  creator_id: string;
  sender_type: string;
  sender_user_id: string | null;
  sender_creator_id: string | null;
  sender_name: string;
  gift_type: GiftType;
  message: string | null;
  created_at: string;
}

interface GiftSummary {
  shrimp: number;
  star: number;
  rocket: number;
  crown: number;
  heart: number;
  fire: number;
}

interface GiftsListResponse {
  data: GiftEntry[];
  summary: GiftSummary;
}

interface GiftCreateResponse {
  ok: true;
  id: string;
}

/**
 * GET /api/creators/[id]/gifts — list recent 30 gifts + summary by type
 */
export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse<ApiError | GiftsListResponse>> {
  try {
    const { id: creatorId } = await context.params;
    if (!creatorId) {
      return apiErrorResponse({ message: "Invalid creator id", code: "VALIDATION_CREATOR_ID_INVALID", status: 400 });
    }

    const admin = getSupabaseAdminClient();

    // Fetch recent gifts
    const { data: gifts, error } = await admin
      .from("lobster_gifts")
      .select("*")
      .eq("creator_id", creatorId)
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) {
      console.error("GET /api/creators/[id]/gifts DB error:", error);
      return apiErrorResponse({ message: "Internal server error", code: "INTERNAL_ERROR", status: 500 });
    }

    // Compute summary (count by type from ALL gifts, not just recent 30)
    const { data: allGifts, error: summaryError } = await admin
      .from("lobster_gifts")
      .select("gift_type")
      .eq("creator_id", creatorId);

    if (summaryError) {
      console.error("GET /api/creators/[id]/gifts summary error:", summaryError);
    }

    const summary: GiftSummary = {
      shrimp: 0,
      star: 0,
      rocket: 0,
      crown: 0,
      heart: 0,
      fire: 0,
    };

    for (const g of allGifts ?? []) {
      const t = g.gift_type as GiftType;
      if (t in summary) {
        summary[t]++;
      }
    }

    return withRateLimitHeaders(NextResponse.json({ data: gifts ?? [], summary }));
  } catch (error: unknown) {
    console.error("GET /api/creators/[id]/gifts failed:", error);
    return apiErrorResponse({ message: "Internal server error", code: "INTERNAL_ERROR", status: 500 });
  }
}

/**
 * POST /api/creators/[id]/gifts — send a gift (requires login)
 * Body: { gift_type: GiftType, message?: string }
 */
export async function POST(
  request: Request,
  context: RouteContext,
): Promise<NextResponse<ApiError | GiftCreateResponse>> {
  try {
    const { id: creatorId } = await context.params;
    if (!creatorId) {
      return apiErrorResponse({ message: "Invalid creator id", code: "VALIDATION_CREATOR_ID_INVALID", status: 400 });
    }

    // Bearer token path: agent auth
    const token = extractBearerToken(request.headers.get("authorization"));

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiErrorResponse({ message: "Invalid JSON body", code: "VALIDATION_JSON_INVALID", status: 400 });
    }

    const payload = body as { gift_type?: string; message?: string };

    const giftType = payload.gift_type as GiftType;
    if (!giftType || !VALID_GIFT_TYPES.includes(giftType)) {
      return apiErrorResponse({
        message: `Invalid gift_type. Must be one of: ${VALID_GIFT_TYPES.join(", ")}`,
        code: "VALIDATION_GIFT_TYPE_INVALID",
        status: 400,
      });
    }

    // Sanitize message HTML
    const rawMessage = payload.message?.trim() ?? "";
    const message = rawMessage ? rawMessage.replace(/<[^>]*>/g, "").trim().slice(0, 200) : null;

    const admin = getSupabaseAdminClient();

    if (token) {
      // Agent path
      const agentCreator = await verifyApiKey(hashApiKey(token));
      if (!agentCreator || !agentCreator.is_active) {
        return apiErrorResponse({ message: "Unauthorized — invalid API key", code: "AUTH_INVALID_KEY", status: 401 });
      }

      const { data: inserted, error: insertError } = await admin
        .from("lobster_gifts")
        .insert({
          creator_id: creatorId,
          sender_type: "agent",
          sender_user_id: null,
          sender_creator_id: agentCreator.id,
          sender_name: agentCreator.name,
          gift_type: giftType,
          message: message ?? null,
        })
        .select("id")
        .single();

      if (insertError) {
        console.error("POST /api/creators/[id]/gifts (agent) insert error:", insertError);
        return apiErrorResponse({ message: "Internal server error", code: "INTERNAL_ERROR", status: 500 });
      }

      await admin.rpc("increment_creator_counter", {
        p_creator_id: creatorId,
        p_field: "gift_count",
        p_delta: 1,
      });

      return withRateLimitHeaders(
        NextResponse.json({ ok: true as const, id: inserted.id }, { status: 201 }),
      );
    }

    // Cookie session path: human auth
    const supabase = await createClientForServer();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return apiErrorResponse({ message: "Unauthorized", code: "AUTH_UNAUTHORIZED", status: 401 });
    }

    // Get user profile for display name
    const { data: profile } = await admin
      .from("profiles")
      .select("display_name, username")
      .eq("id", user.id)
      .single();

    const senderName =
      profile?.display_name ||
      profile?.username ||
      user.email?.split("@")[0] ||
      "匿名用户";

    const { data: inserted, error: insertError } = await admin
      .from("lobster_gifts")
      .insert({
        creator_id: creatorId,
        sender_type: "user",
        sender_user_id: user.id,
        sender_creator_id: null,
        sender_name: senderName,
        gift_type: giftType,
        message: message ?? null,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("POST /api/creators/[id]/gifts insert error:", insertError);
      return apiErrorResponse({ message: "Internal server error", code: "INTERNAL_ERROR", status: 500 });
    }

    // Atomically increment gift_count
    await admin.rpc("increment_creator_counter", {
      p_creator_id: creatorId,
      p_field: "gift_count",
      p_delta: 1,
    });

    return withRateLimitHeaders(
      NextResponse.json({ ok: true as const, id: inserted.id }, { status: 201 }),
    );
  } catch (error: unknown) {
    console.error("POST /api/creators/[id]/gifts failed:", error);
    return apiErrorResponse({ message: "Internal server error", code: "INTERNAL_ERROR", status: 500 });
  }
}
