import { randomUUID } from "node:crypto";

import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { ViewerType } from "@/types";

export interface LikeRecord {
  id: string;
  video_id: string;
  user_id: string | null;
  agent_key_hash: string | null;
  viewer_type: ViewerType;
  created_at: string;
}

interface ToggleLikeInput {
  videoId: string;
  userId?: string;
  agentKeyHash?: string;
  viewerType: ViewerType;
}

export interface LikeStatus {
  liked: boolean;
  like_count: number;
  ai_like_count: number;
  human_like_count: number;
}

function isMissingTableError(message: string): boolean {
  return message.includes("relation") && message.includes("does not exist");
}

async function getLikeCounts(videoId: string): Promise<{ ai: number; human: number }> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("likes")
    .select("viewer_type")
    .eq("video_id", videoId);

  if (error) {
    if (isMissingTableError(error.message)) return { ai: 0, human: 0 };
    throw new Error(`getLikeCounts failed: ${error.message}`);
  }

  let ai = 0;
  let human = 0;
  (data ?? []).forEach((row: { viewer_type: string }) => {
    if (row.viewer_type === "ai") ai++;
    else human++;
  });
  return { ai, human };
}

function buildStatus(liked: boolean, counts: { ai: number; human: number }): LikeStatus {
  return {
    liked,
    like_count: counts.ai + counts.human,
    ai_like_count: counts.ai,
    human_like_count: counts.human,
  };
}

export async function addLike(input: ToggleLikeInput): Promise<LikeStatus> {
  const supabase = getSupabaseAdminClient();
  const id = randomUUID();

  const row = {
    id,
    video_id: input.videoId,
    user_id: input.userId ?? null,
    agent_key_hash: input.agentKeyHash ?? null,
    viewer_type: input.viewerType,
  };

  const { error } = await supabase.from("likes").insert(row);

  if (error) {
    if (isMissingTableError(error.message)) {
      return buildStatus(true, { ai: 0, human: 0 });
    }
    // 重复点赞，静默处理
    if (error.code === "23505") {
      const counts = await getLikeCounts(input.videoId);
      return buildStatus(true, counts);
    }
    throw new Error(`addLike failed: ${error.message}`);
  }

  // 更新 videos.like_count
  const counts = await getLikeCounts(input.videoId);
  try {
    await supabase
      .from("videos")
      .update({ like_count: counts.ai + counts.human })
      .eq("id", input.videoId);
  } catch {
    // 计数同步失败不阻塞点赞
  }
  return buildStatus(true, counts);
}

export async function removeLike(input: ToggleLikeInput): Promise<LikeStatus> {
  const supabase = getSupabaseAdminClient();

  let query = supabase.from("likes").delete().eq("video_id", input.videoId);

  if (input.userId) {
    query = query.eq("user_id", input.userId);
  } else if (input.agentKeyHash) {
    query = query.eq("agent_key_hash", input.agentKeyHash);
  } else {
    const counts = await getLikeCounts(input.videoId);
    return buildStatus(false, counts);
  }

  const { error } = await query;

  if (error && !isMissingTableError(error.message)) {
    throw new Error(`removeLike failed: ${error.message}`);
  }

  const counts = await getLikeCounts(input.videoId);
  return buildStatus(false, counts);
}

export async function getLikeStatus(
  videoId: string,
  userId?: string,
  agentKeyHash?: string,
): Promise<LikeStatus> {
  const supabase = getSupabaseAdminClient();
  const counts = await getLikeCounts(videoId);

  let liked = false;

  if (userId) {
    const { data, error } = await supabase
      .from("likes")
      .select("id")
      .eq("video_id", videoId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!error && data) liked = true;
  } else if (agentKeyHash) {
    const { data, error } = await supabase
      .from("likes")
      .select("id")
      .eq("video_id", videoId)
      .eq("agent_key_hash", agentKeyHash)
      .maybeSingle();
    if (!error && data) liked = true;
  }

  return buildStatus(liked, counts);
}
