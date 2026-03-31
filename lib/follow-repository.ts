import { getSupabaseAdminClient } from "@/lib/supabase/server";

interface CreatorOwnership {
  id: string;
  owner_id: string;
  followers_count: number;
}

interface FollowRow {
  id: string;
}

interface FollowMutationResult {
  following: boolean;
  followersCount: number;
}

function isDuplicateError(message: string): boolean {
  return message.includes("duplicate key value") || message.includes("23505");
}

async function recalculateFollowersCount(creatorId: string): Promise<number> {
  const supabase = getSupabaseAdminClient();
  const { count, error: countError } = await supabase
    .from("follows")
    .select("id", { count: "exact", head: true })
    .eq("creator_id", creatorId);

  if (countError) {
    throw new Error(`recalculateFollowersCount count failed: ${countError.message}`);
  }

  const nextCount = count ?? 0;
  const { error: updateError } = await supabase
    .from("creators")
    .update({ followers_count: nextCount })
    .eq("id", creatorId);

  if (updateError) {
    throw new Error(`recalculateFollowersCount update failed: ${updateError.message}`);
  }

  return nextCount;
}

/**
 * 获取 UP 主 owner 信息，用于校验自关注。
 */
export async function getCreatorOwnership(creatorId: string): Promise<CreatorOwnership | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("creators")
    .select("id, owner_id, followers_count")
    .eq("id", creatorId)
    .maybeSingle<CreatorOwnership>();

  if (error) {
    throw new Error(`getCreatorOwnership failed: ${error.message}`);
  }

  return data;
}

/**
 * 查询某用户是否已关注某 UP 主。
 */
export async function getFollowStatus(followerId: string, creatorId: string): Promise<boolean> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("follows")
    .select("id")
    .eq("follower_id", followerId)
    .eq("creator_id", creatorId)
    .maybeSingle<FollowRow>();

  if (error) {
    throw new Error(`getFollowStatus failed: ${error.message}`);
  }

  return Boolean(data?.id);
}

/**
 * 关注 UP 主（幂等）。
 */
export async function followCreator(followerId: string, creatorId: string): Promise<FollowMutationResult> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("follows").insert({
    follower_id: followerId,
    creator_id: creatorId,
  });

  if (error && !isDuplicateError(error.message)) {
    throw new Error(`followCreator failed: ${error.message}`);
  }

  const followersCount = await recalculateFollowersCount(creatorId);
  return {
    following: true,
    followersCount,
  };
}

/**
 * 取消关注 UP 主（幂等）。
 */
export async function unfollowCreator(
  followerId: string,
  creatorId: string,
): Promise<FollowMutationResult> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", followerId)
    .eq("creator_id", creatorId);

  if (error) {
    throw new Error(`unfollowCreator failed: ${error.message}`);
  }

  const followersCount = await recalculateFollowersCount(creatorId);
  return {
    following: false,
    followersCount,
  };
}
