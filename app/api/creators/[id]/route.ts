import { NextResponse } from "next/server";

import { apiErrorResponse, withRateLimitHeaders } from "@/lib/api-response";
import { resolveCreatorByIdOrSlug } from "@/lib/agent-card";
import { getPublishedVideosByCreatorId } from "@/lib/upload-repository";
import { createClientForServer, getSupabaseAdminClient } from "@/lib/supabase/server";
import type { ApiError, VideoRecord } from "@/types";

/**
 * R2-02: Public-safe creator shape — excludes agent_key_hash, owner_id, guardian_id,
 * uploads_this_month, upload_quota, quota_reset_at (all sensitive/internal fields).
 */
interface PublicCreator {
  id: string;
  name: string;
  slug: string;
  bio: string | null;
  niche: string;
  avatar_url: string | null;
  followers_count: number;
  is_active: boolean;
  source?: "agent" | "human";
  created_at: string;
}

interface CreatorDetailResponse {
  creator: PublicCreator;
  videos: VideoRecord[];
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse<ApiError | CreatorDetailResponse>> {
  try {
    const { id } = await context.params;
    if (!id) {
      return apiErrorResponse({
        message: "Invalid creator identifier",
        code: "VALIDATION_CREATOR_ID_INVALID",
        status: 400,
      });
    }

    const resolved = await resolveCreatorByIdOrSlug(id);
    if (!resolved) {
      return apiErrorResponse({
        message: "Creator not found",
        code: "RESOURCE_NOT_FOUND",
        status: 404,
      });
    }

    // R2-02: Only return public-safe fields; strip agent_key_hash and other sensitive data
    const creator: PublicCreator = {
      id: resolved.id,
      name: resolved.name,
      slug: resolved.slug,
      bio: resolved.bio ?? null,
      niche: resolved.niche,
      avatar_url: resolved.avatar_url ?? null,
      followers_count: resolved.followers_count,
      is_active: resolved.is_active,
      source: resolved.source,
      created_at: resolved.created_at,
    };

    const videos = await getPublishedVideosByCreatorId(resolved.id);
    return withRateLimitHeaders(NextResponse.json({ creator, videos }));
  } catch (error: unknown) {
    console.error("GET /api/creators/[id] failed:", error);
    return apiErrorResponse({
      message: "Internal server error",
      code: "INTERNAL_ERROR",
      status: 500,
    });
  }
}

/* ─── 编辑频道信息 ─── */

interface PatchBody {
  bio?: string;
  niche?: string;
  style?: string;
  avatar_url?: string;
}

export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const { id } = await context.params;

    // 验证登录用户
    const supabase = await createClientForServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return apiErrorResponse({ message: "Unauthorized", code: "AUTH_UNAUTHORIZED", status: 401 });
    }

    // 验证所有权
    const admin = getSupabaseAdminClient();
    const { data: creator } = await admin
      .from("creators")
      .select("id, owner_id")
      .eq("id", id)
      .maybeSingle();

    if (!creator) {
      return apiErrorResponse({ message: "Not found", code: "RESOURCE_NOT_FOUND", status: 404 });
    }
    if (creator.owner_id !== user.id) {
      return apiErrorResponse({ message: "Forbidden", code: "AUTH_FORBIDDEN", status: 403 });
    }

    const body = (await request.json()) as PatchBody;
    const updates: Record<string, unknown> = {};

    if (body.bio !== undefined) updates.bio = body.bio.slice(0, 500);
    if (body.niche !== undefined) updates.niche = body.niche.slice(0, 50);
    if (body.style !== undefined) updates.style = body.style.slice(0, 100);
    if (body.avatar_url !== undefined) updates.avatar_url = body.avatar_url.slice(0, 500);

    if (Object.keys(updates).length === 0) {
      return apiErrorResponse({ message: "No fields to update", code: "VALIDATION_EMPTY", status: 400 });
    }

    const { data: updated, error } = await admin
      .from("creators")
      .update(updates)
      .eq("id", id)
      .select("id, name, bio, niche, style, avatar_url")
      .single();

    if (error) {
      return apiErrorResponse({ message: error.message, code: "INTERNAL_ERROR", status: 500 });
    }

    return NextResponse.json({ creator: updated });
  } catch (error: unknown) {
    console.error("PATCH /api/creators/[id] failed:", error);
    return apiErrorResponse({ message: "Internal server error", code: "INTERNAL_ERROR", status: 500 });
  }
}

/* ─── 删除频道 ─── */

export async function DELETE(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const { id } = await context.params;

    // 验证登录用户
    const supabase = await createClientForServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return apiErrorResponse({ message: "Unauthorized", code: "AUTH_UNAUTHORIZED", status: 401 });
    }

    // 验证所有权
    const admin = getSupabaseAdminClient();
    const { data: creator } = await admin
      .from("creators")
      .select("id, owner_id, name")
      .eq("id", id)
      .maybeSingle();

    if (!creator) {
      return apiErrorResponse({ message: "Not found", code: "RESOURCE_NOT_FOUND", status: 404 });
    }
    if (creator.owner_id !== user.id) {
      return apiErrorResponse({ message: "Forbidden", code: "AUTH_FORBIDDEN", status: 403 });
    }

    // 删除频道下的视频元数据（Cloudflare Stream 视频需要手动清理或定时任务）
    await admin.from("videos").delete().eq("creator_id", id);
    // 删除关注关系
    await admin.from("follows").delete().eq("creator_id", id);
    // 删除影响力分数
    await admin.from("influence_scores").delete().eq("creator_id", id);
    // 删除频道
    const { error } = await admin.from("creators").delete().eq("id", id);

    if (error) {
      return apiErrorResponse({ message: error.message, code: "INTERNAL_ERROR", status: 500 });
    }

    return NextResponse.json({ deleted: true, name: creator.name });
  } catch (error: unknown) {
    console.error("DELETE /api/creators/[id] failed:", error);
    return apiErrorResponse({ message: "Internal server error", code: "INTERNAL_ERROR", status: 500 });
  }
}
