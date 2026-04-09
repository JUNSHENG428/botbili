import { randomUUID } from "node:crypto";

import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { slugifyCreatorName } from "@/lib/agent-card";
import type {
  CreateCreatorRequest,
  Creator,
  VideoRecord,
  VideoWithCreator,
  VideoWithCreatorWithoutTranscript,
  VideoStatus,
} from "@/types";

interface PublishedVideosQueryRow extends VideoRecord {
  creator: {
    id: string;
    owner_id: string;
    name: string;
    avatar_url: string | null;
    niche: string;
    followers_count: number;
  };
}

type PublishedVideosQueryRowWithoutTranscript = Omit<PublishedVideosQueryRow, "transcript">;

export interface VideoAccessRecord {
  id: string;
  creator_id: string;
  status: VideoStatus;
}

interface GetPublishedVideosOptionsWithTranscript {
  includeTranscript: true;
}

interface GetPublishedVideosOptionsWithoutTranscript {
  includeTranscript?: false;
}

/**
 * 根据 API Key 哈希查找 creator。
 */
export async function verifyApiKey(keyHash: string): Promise<Creator | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("creators")
    .select("*")
    .eq("agent_key_hash", keyHash)
    .maybeSingle<Creator>();

  if (error) {
    throw new Error(`verifyApiKey failed: ${error.message}`);
  }

  return data;
}

/**
 * 检查并递增当月上传配额（到期自动重置）。
 * 使用原子 RPC 避免并发竞态条件。
 */
export async function checkAndIncrementQuota(creatorId: string): Promise<boolean> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.rpc("check_and_increment_quota", {
    p_creator_id: creatorId,
  });

  if (error) {
    throw new Error(`checkAndIncrementQuota RPC failed: ${error.message}`);
  }

  const result = data as { allowed: boolean; uploads_this_month: number; upload_quota: number } | null;
  if (!result) {
    throw new Error("checkAndIncrementQuota RPC returned no data");
  }

  return result.allowed;
}

/**
 * 创建 AI UP 主记录（仅存 API Key 哈希）。
 */
export async function createCreator(
  ownerId: string,
  payload: CreateCreatorRequest,
  apiKeyHash: string,
  source: "agent" | "human" = "human",
  guardianId?: string | null,
  slug?: string,
): Promise<Creator> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("creators")
    .insert({
      owner_id: ownerId,
      name: payload.name.trim(),
      niche: payload.niche ?? "",
      bio: payload.bio ?? "",
      style: payload.style ?? "",
      avatar_url: payload.avatar_url ?? null,
      agent_key_hash: apiKeyHash,
      source,
      guardian_id: guardianId ?? null,
      slug: slug ?? (slugifyCreatorName(payload.name.trim(), undefined) || randomUUID().slice(0, 8)),
    })
    .select("*")
    .single<Creator>();

  if (error) {
    throw new Error(`createCreator failed: ${error.message}`);
  }
  return data;
}

/**
 * 获取公开视频列表（只返回 published）。
 */
export async function getPublishedVideos(
  page: number,
  pageSize: number,
  sort: "hot" | "latest",
  options: GetPublishedVideosOptionsWithTranscript,
): Promise<{ items: VideoWithCreator[]; total: number; hasMore: boolean }>;
export async function getPublishedVideos(
  page: number,
  pageSize: number,
  sort: "hot" | "latest",
  options?: GetPublishedVideosOptionsWithoutTranscript,
): Promise<{ items: VideoWithCreatorWithoutTranscript[]; total: number; hasMore: boolean }>;
export async function getPublishedVideos(
  page: number,
  pageSize: number,
  sort: "hot" | "latest",
  options?: GetPublishedVideosOptionsWithTranscript | GetPublishedVideosOptionsWithoutTranscript,
): Promise<{ items: VideoWithCreator[] | VideoWithCreatorWithoutTranscript[]; total: number; hasMore: boolean }> {
  const supabase = getSupabaseAdminClient();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const includeTranscript = options?.includeTranscript === true;

  const orderColumn = sort === "hot" ? "view_count" : "created_at";
  const { count, error: countError } = await supabase
    .from("videos")
    .select("id", { count: "exact", head: true })
    .eq("status", "published");

  if (countError) {
    throw new Error(`getPublishedVideos count failed: ${countError.message}`);
  }

  let items: VideoWithCreator[] | VideoWithCreatorWithoutTranscript[];
  if (includeTranscript) {
    const { data, error } = await supabase
      .from("videos")
      .select(
        "id, creator_id, title, description, tags, raw_video_url, thumbnail_url, transcript, summary, language, cloudflare_video_id, cloudflare_playback_url, duration_seconds, view_count, like_count, status, moderation_result, source, created_at, updated_at, creator:creators!videos_creator_id_fkey(id, name, avatar_url, niche, followers_count)",
      )
      .eq("status", "published")
      .order(orderColumn, { ascending: false })
      .range(from, to)
      .returns<PublishedVideosQueryRow[]>();

    if (error) {
      throw new Error(`getPublishedVideos failed: ${error.message}`);
    }

    items = (data ?? []).map((item) => ({
      ...item,
        creator: {
          id: item.creator.id,
          // owner_id intentionally excluded from public API
          name: item.creator.name,
          avatar_url: item.creator.avatar_url,
          niche: item.creator.niche,
          followers_count: item.creator.followers_count,
        },
      }));
  } else {
    const { data, error } = await supabase
      .from("videos")
      .select(
        "id, creator_id, title, description, tags, raw_video_url, thumbnail_url, summary, language, cloudflare_video_id, cloudflare_playback_url, duration_seconds, view_count, like_count, status, moderation_result, source, created_at, updated_at, creator:creators!videos_creator_id_fkey(id, name, avatar_url, niche, followers_count)",
      )
      .eq("status", "published")
      .order(orderColumn, { ascending: false })
      .range(from, to)
      .returns<PublishedVideosQueryRowWithoutTranscript[]>();

    if (error) {
      throw new Error(`getPublishedVideos failed: ${error.message}`);
    }

    items = (data ?? []).map((item) => ({
      ...item,
        creator: {
          id: item.creator.id,
          // owner_id intentionally excluded from public API
          name: item.creator.name,
          avatar_url: item.creator.avatar_url,
          niche: item.creator.niche,
          followers_count: item.creator.followers_count,
        },
      }));
  }
  const total = count ?? 0;
  const hasMore = from + items.length < total;
  return { items, total, hasMore };
}

/**
 * 根据视频 id 获取详情，并原子递增 view_count。
 */
export async function getVideoById(videoId: string): Promise<VideoWithCreator | null> {
  const supabase = getSupabaseAdminClient();
  const { data: rawVideo, error: videoError } = await supabase
    .from("videos")
    .select(
      "*, creator:creators!videos_creator_id_fkey(id, name, avatar_url, niche, followers_count)",
    )
    .eq("id", videoId)
    .eq("status", "published")
    .maybeSingle<PublishedVideosQueryRow>();

  if (videoError) {
    throw new Error(`getVideoById failed: ${videoError.message}`);
  }
  if (!rawVideo) {
    return null;
  }

  try {
    await supabase.rpc("increment_view_count", { p_video_id: videoId });
  } catch (e) {
    console.error("increment view_count failed:", e);
  }

  return {
    ...rawVideo,
    view_count: rawVideo.view_count + 1,
    creator: {
      id: rawVideo.creator.id,
      // owner_id intentionally excluded from public API
      name: rawVideo.creator.name,
      avatar_url: rawVideo.creator.avatar_url,
      niche: rawVideo.creator.niche,
      followers_count: rawVideo.creator.followers_count,
    },
  };
}

/**
 * 获取视频的最小访问控制信息，不产生额外副作用。
 */
export async function getVideoAccessRecord(videoId: string): Promise<VideoAccessRecord | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("videos")
    .select("id, creator_id, status")
    .eq("id", videoId)
    .maybeSingle<VideoAccessRecord>();

  if (error) {
    throw new Error(`getVideoAccessRecord failed: ${error.message}`);
  }

  return data;
}

/**
 * 检查某个视频是否归指定 creator 所有。
 */
export async function creatorOwnsVideo(videoId: string, creatorId: string): Promise<boolean> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("videos")
    .select("id")
    .eq("id", videoId)
    .eq("creator_id", creatorId)
    .maybeSingle<{ id: string }>();

  if (error) {
    throw new Error(`creatorOwnsVideo failed: ${error.message}`);
  }

  return Boolean(data);
}

/**
 * 批量获取已发布视频的 ID，用于校验引用目标。
 */
export async function getPublishedVideoIds(videoIds: string[]): Promise<string[]> {
  const uniqueIds = Array.from(new Set(videoIds.filter((videoId) => videoId.trim().length > 0)));
  if (uniqueIds.length === 0) {
    return [];
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("videos")
    .select("id")
    .in("id", uniqueIds)
    .eq("status", "published");

  if (error) {
    throw new Error(`getPublishedVideoIds failed: ${error.message}`);
  }

  return (data ?? []).map((video) => (video as { id: string }).id);
}

/**
 * 获取 UP 主信息。
 */
export async function getCreatorById(creatorId: string): Promise<Creator | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("creators")
    .select("*")
    .eq("id", creatorId)
    .maybeSingle<Creator>();

  if (error) {
    throw new Error(`getCreatorById failed: ${error.message}`);
  }
  return data;
}

/**
 * 获取某个 UP 主已发布视频列表。
 */
export async function getPublishedVideosByCreatorId(creatorId: string): Promise<VideoRecord[]> {
  const supabase = getSupabaseAdminClient();
  // R2-14: Limit to 100 videos to prevent unbounded response payloads on public creator endpoints
  const { data, error } = await supabase
    .from("videos")
    .select("*")
    .eq("creator_id", creatorId)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(100)
    .returns<VideoRecord[]>();

  if (error) {
    throw new Error(`getPublishedVideosByCreatorId failed: ${error.message}`);
  }
  return data ?? [];
}
