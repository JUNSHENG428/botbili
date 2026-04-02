import { NextResponse } from "next/server";

import { apiErrorResponse, withRateLimitHeaders } from "@/lib/api-response";
import { extractBearerToken, hashApiKey, verifyApiKey } from "@/lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { ApiError } from "@/types";

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface FriendEntry {
  id: string;
  creator_id: string;
  friend_creator_id: string;
  created_at: string;
}

interface FriendsListResponse {
  data: FriendEntry[];
}

interface FriendMutationResponse {
  ok: true;
}

/**
 * GET /api/creators/[id]/friends — list friends
 */
export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse<ApiError | FriendsListResponse>> {
  try {
    const { id: creatorId } = await context.params;
    if (!creatorId) {
      return apiErrorResponse({ message: "Invalid creator id", code: "VALIDATION_CREATOR_ID_INVALID", status: 400 });
    }

    const admin = getSupabaseAdminClient();
    const { data, error } = await admin
      .from("lobster_friends")
      .select("*")
      .eq("creator_id", creatorId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("GET /api/creators/[id]/friends DB error:", error);
      return apiErrorResponse({ message: "Internal server error", code: "INTERNAL_ERROR", status: 500 });
    }

    return withRateLimitHeaders(NextResponse.json({ data: data ?? [] }));
  } catch (error: unknown) {
    console.error("GET /api/creators/[id]/friends failed:", error);
    return apiErrorResponse({ message: "Internal server error", code: "INTERNAL_ERROR", status: 500 });
  }
}

/**
 * POST /api/creators/[id]/friends — add friend (requires API Key auth, agent-to-agent)
 * Body: { friend_creator_id: string }
 * Only creators can friend other creators (verified via Bearer token)
 * Increments friend_count for both sides via RPC
 */
export async function POST(
  request: Request,
  context: RouteContext,
): Promise<NextResponse<ApiError | FriendMutationResponse>> {
  try {
    const { id: creatorId } = await context.params;
    if (!creatorId) {
      return apiErrorResponse({ message: "Invalid creator id", code: "VALIDATION_CREATOR_ID_INVALID", status: 400 });
    }

    // Auth: require Bearer API key (creator/agent auth)
    const token = extractBearerToken(request.headers.get("authorization"));
    if (!token) {
      return apiErrorResponse({ message: "Unauthorized — API key required", code: "AUTH_UNAUTHORIZED", status: 401 });
    }

    const creator = await verifyApiKey(hashApiKey(token));
    if (!creator || !creator.is_active) {
      return apiErrorResponse({ message: "Unauthorized — invalid API key", code: "AUTH_INVALID_KEY", status: 401 });
    }

    // Verify that the authenticated creator is the one in the URL
    if (creator.id !== creatorId) {
      return apiErrorResponse({ message: "Forbidden — can only add friends for your own creator", code: "AUTH_FORBIDDEN", status: 403 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiErrorResponse({ message: "Invalid JSON body", code: "VALIDATION_JSON_INVALID", status: 400 });
    }

    const payload = body as { friend_creator_id?: string };
    const friendCreatorId = payload.friend_creator_id?.trim();

    if (!friendCreatorId) {
      return apiErrorResponse({ message: "friend_creator_id required", code: "VALIDATION_FRIEND_ID_REQUIRED", status: 400 });
    }

    if (friendCreatorId === creatorId) {
      return apiErrorResponse({ message: "Cannot friend yourself", code: "VALIDATION_CANNOT_FRIEND_SELF", status: 400 });
    }

    const admin = getSupabaseAdminClient();

    // Verify friend creator exists
    const { data: friendCreator } = await admin
      .from("creators")
      .select("id")
      .eq("id", friendCreatorId)
      .single();

    if (!friendCreator) {
      return apiErrorResponse({ message: "Friend creator not found", code: "RESOURCE_NOT_FOUND", status: 404 });
    }

    // Insert friendship (unique constraint prevents duplicates)
    const { error: insertError } = await admin
      .from("lobster_friends")
      .insert({ creator_id: creatorId, friend_creator_id: friendCreatorId });

    if (insertError) {
      if (insertError.code === "23505") {
        // Already friends
        return withRateLimitHeaders(NextResponse.json({ ok: true as const }));
      }
      console.error("POST /api/creators/[id]/friends insert error:", insertError);
      return apiErrorResponse({ message: "Internal server error", code: "INTERNAL_ERROR", status: 500 });
    }

    // Increment friend_count for both sides atomically
    await Promise.all([
      admin.rpc("increment_creator_counter", {
        p_creator_id: creatorId,
        p_field: "friend_count",
        p_delta: 1,
      }),
      admin.rpc("increment_creator_counter", {
        p_creator_id: friendCreatorId,
        p_field: "friend_count",
        p_delta: 1,
      }),
    ]);

    return withRateLimitHeaders(
      NextResponse.json({ ok: true as const }, { status: 201 }),
    );
  } catch (error: unknown) {
    console.error("POST /api/creators/[id]/friends failed:", error);
    return apiErrorResponse({ message: "Internal server error", code: "INTERNAL_ERROR", status: 500 });
  }
}

/**
 * DELETE /api/creators/[id]/friends — remove friend
 * Body: { friend_creator_id: string }
 */
export async function DELETE(
  request: Request,
  context: RouteContext,
): Promise<NextResponse<ApiError | FriendMutationResponse>> {
  try {
    const { id: creatorId } = await context.params;
    if (!creatorId) {
      return apiErrorResponse({ message: "Invalid creator id", code: "VALIDATION_CREATOR_ID_INVALID", status: 400 });
    }

    // Auth: require Bearer API key
    const token = extractBearerToken(request.headers.get("authorization"));
    if (!token) {
      return apiErrorResponse({ message: "Unauthorized — API key required", code: "AUTH_UNAUTHORIZED", status: 401 });
    }

    const creator = await verifyApiKey(hashApiKey(token));
    if (!creator || !creator.is_active) {
      return apiErrorResponse({ message: "Unauthorized — invalid API key", code: "AUTH_INVALID_KEY", status: 401 });
    }

    if (creator.id !== creatorId) {
      return apiErrorResponse({ message: "Forbidden", code: "AUTH_FORBIDDEN", status: 403 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiErrorResponse({ message: "Invalid JSON body", code: "VALIDATION_JSON_INVALID", status: 400 });
    }

    const payload = body as { friend_creator_id?: string };
    const friendCreatorId = payload.friend_creator_id?.trim();

    if (!friendCreatorId) {
      return apiErrorResponse({ message: "friend_creator_id required", code: "VALIDATION_FRIEND_ID_REQUIRED", status: 400 });
    }

    const admin = getSupabaseAdminClient();

    const { error: deleteError } = await admin
      .from("lobster_friends")
      .delete()
      .eq("creator_id", creatorId)
      .eq("friend_creator_id", friendCreatorId);

    if (deleteError) {
      console.error("DELETE /api/creators/[id]/friends error:", deleteError);
      return apiErrorResponse({ message: "Internal server error", code: "INTERNAL_ERROR", status: 500 });
    }

    // Decrement friend_count for both sides
    await Promise.all([
      admin.rpc("increment_creator_counter", {
        p_creator_id: creatorId,
        p_field: "friend_count",
        p_delta: -1,
      }),
      admin.rpc("increment_creator_counter", {
        p_creator_id: friendCreatorId,
        p_field: "friend_count",
        p_delta: -1,
      }),
    ]);

    return withRateLimitHeaders(NextResponse.json({ ok: true as const }));
  } catch (error: unknown) {
    console.error("DELETE /api/creators/[id]/friends failed:", error);
    return apiErrorResponse({ message: "Internal server error", code: "INTERNAL_ERROR", status: 500 });
  }
}
