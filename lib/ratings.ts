/**
 * 结构化评价系统（Ratings）
 * 三维评分：relevance（相关性）、accuracy（准确性）、novelty（创新性）
 */

import { getSupabaseAdminClient } from "@/lib/supabase/server";

export interface Rating {
  id: string;
  video_id: string;
  creator_id: string;  // 评价者
  relevance: number;   // 1-5 相关性：内容与标题/标签的匹配度
  accuracy: number;    // 1-5 准确性：事实正确性
  novelty: number;     // 1-5 创新性：内容新颖程度
  comment: string | null;
  created_at: string;
  updated_at: string;
}

export interface RatingWithCreator extends Rating {
  creator: {
    id: string;
    name: string;
    avatar_url: string | null;
  };
}

export interface RatingStats {
  video_id: string;
  avg_relevance: number;
  avg_accuracy: number;
  avg_novelty: number;
  overall_score: number;
  ratings_count: number;
}

export interface CreateRatingRequest {
  relevance: number;
  accuracy: number;
  novelty: number;
  comment?: string;
}

/**
 * 创建评价
 * @param videoId 被评价视频 ID
 * @param creatorId 评价者 ID
 * @param rating 评分数据
 */
export async function createRating(
  videoId: string,
  creatorId: string,
  rating: CreateRatingRequest
): Promise<Rating> {
  const supabase = getSupabaseAdminClient();

  // 验证评分范围
  const scores = [rating.relevance, rating.accuracy, rating.novelty];
  if (scores.some((s) => s < 1 || s > 5 || !Number.isInteger(s))) {
    throw new Error("Ratings must be integers between 1 and 5");
  }

  // 检查是否已评价
  const { data: existing } = await supabase
    .from("ratings")
    .select("id")
    .eq("video_id", videoId)
    .eq("creator_id", creatorId)
    .maybeSingle();

  if (existing) {
    throw new Error("You have already rated this video");
  }

  const { data, error } = await supabase
    .from("ratings")
    .insert({
      video_id: videoId,
      creator_id: creatorId,
      relevance: rating.relevance,
      accuracy: rating.accuracy,
      novelty: rating.novelty,
      comment: rating.comment ?? null,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to create rating: ${error.message}`);
  }

  return data as Rating;
}

/**
 * 更新评价
 * @param ratingId 评价 ID
 * @param rating 新的评分数据
 */
export async function updateRating(
  ratingId: string,
  rating: Partial<CreateRatingRequest>
): Promise<Rating> {
  const supabase = getSupabaseAdminClient();

  const updateData: Record<string, unknown> = {};
  if (rating.relevance !== undefined) updateData.relevance = rating.relevance;
  if (rating.accuracy !== undefined) updateData.accuracy = rating.accuracy;
  if (rating.novelty !== undefined) updateData.novelty = rating.novelty;
  if (rating.comment !== undefined) updateData.comment = rating.comment;

  const { data, error } = await supabase
    .from("ratings")
    .update(updateData)
    .eq("id", ratingId)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to update rating: ${error.message}`);
  }

  return data as Rating;
}

/**
 * 获取视频的评价列表
 * @param videoId 视频 ID
 */
export async function getVideoRatings(
  videoId: string
): Promise<RatingWithCreator[]> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("ratings")
    .select(`
      *,
      creator:creators!ratings_creator_id_fkey(
        id,
        name,
        avatar_url
      )
    `)
    .eq("video_id", videoId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to get ratings: ${error.message}`);
  }

  return (data ?? []) as unknown as RatingWithCreator[];
}

/**
 * 获取视频的评价统计
 * @param videoId 视频 ID
 */
export async function getVideoRatingStats(videoId: string): Promise<RatingStats | null> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("ratings")
    .select("relevance, accuracy, novelty")
    .eq("video_id", videoId);

  if (error || !data?.length) {
    return null;
  }

  const ratings = data as Array<{ relevance: number; accuracy: number; novelty: number }>;
  const count = ratings.length;

  const avgRelevance = ratings.reduce((sum, r) => sum + r.relevance, 0) / count;
  const avgAccuracy = ratings.reduce((sum, r) => sum + r.accuracy, 0) / count;
  const avgNovelty = ratings.reduce((sum, r) => sum + r.novelty, 0) / count;

  // 综合分数：加权平均
  // relevance 40%, accuracy 35%, novelty 25%
  const overallScore = avgRelevance * 0.4 + avgAccuracy * 0.35 + avgNovelty * 0.25;

  return {
    video_id: videoId,
    avg_relevance: Math.round(avgRelevance * 10) / 10,
    avg_accuracy: Math.round(avgAccuracy * 10) / 10,
    avg_novelty: Math.round(avgNovelty * 10) / 10,
    overall_score: Math.round(overallScore * 10) / 10,
    ratings_count: count,
  };
}

/**
 * 获取评价者的评价记录
 * @param creatorId 评价者 ID
 * @param videoId 可选：特定视频
 */
export async function getCreatorRating(
  creatorId: string,
  videoId: string
): Promise<Rating | null> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("ratings")
    .select("*")
    .eq("creator_id", creatorId)
    .eq("video_id", videoId)
    .maybeSingle();

  if (error) {
    return null;
  }

  return data as Rating | null;
}

/**
 * 删除评价
 * @param ratingId 评价 ID
 */
export async function deleteRating(ratingId: string): Promise<void> {
  const supabase = getSupabaseAdminClient();

  const { error } = await supabase
    .from("ratings")
    .delete()
    .eq("id", ratingId);

  if (error) {
    throw new Error(`Failed to delete rating: ${error.message}`);
  }
}

/**
 * 获取创作者的评价统计（该创作者发出的评价）
 * @param creatorId 创作者 ID
 */
export async function getCreatorRatingActivity(creatorId: string): Promise<{
  total_ratings: number;
  avg_relevance_given: number;
  avg_accuracy_given: number;
  avg_novelty_given: number;
}> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("ratings")
    .select("relevance, accuracy, novelty")
    .eq("creator_id", creatorId);

  if (error || !data?.length) {
    return {
      total_ratings: 0,
      avg_relevance_given: 0,
      avg_accuracy_given: 0,
      avg_novelty_given: 0,
    };
  }

  const ratings = data as Array<{ relevance: number; accuracy: number; novelty: number }>;
  const count = ratings.length;

  return {
    total_ratings: count,
    avg_relevance_given: Math.round((ratings.reduce((sum, r) => sum + r.relevance, 0) / count) * 10) / 10,
    avg_accuracy_given: Math.round((ratings.reduce((sum, r) => sum + r.accuracy, 0) / count) * 10) / 10,
    avg_novelty_given: Math.round((ratings.reduce((sum, r) => sum + r.novelty, 0) / count) * 10) / 10,
  };
}
