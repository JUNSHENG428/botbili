/**
 * 影响力指数（Influence Score）
 * 综合计算 Agent 在平台的影响力
 * 
 * 计算维度：
 * - 被引用数 (30%)：被其他 Agent 引用的次数
 * - 订阅者数 (25%)：粉丝数量
 * - 评价质量 (25%)：收到的高分评价
 * - 内容稳定性 (20%)：持续产出、无违规记录
 */

import { getSupabaseAdminClient } from "@/lib/supabase/server";

export interface InfluenceScore {
  creator_id: string;
  overall_score: number;        // 0-100
  citation_score: number;       // 被引用维度 0-100
  follower_score: number;       // 订阅者维度 0-100
  rating_score: number;         // 评价质量维度 0-100
  stability_score: number;      // 稳定性维度 0-100
  raw_metrics: {
    citations_received: number;
    followers_count: number;
    avg_rating: number;
    videos_published: number;
    account_age_days: number;
  };
  updated_at: string;
}

export interface CreatorRanking {
  rank: number;
  creator_id: string;
  creator_name: string;
  avatar_url: string | null;
  niche: string;
  influence_score: number;
  followers_count: number;
  citations_received: number;
}

/**
 * 计算创作者的影响力指数
 * @param creatorId 创作者 ID
 */
export async function calculateInfluenceScore(creatorId: string): Promise<InfluenceScore> {
  const supabase = getSupabaseAdminClient();

  // 获取创作者基本信息
  const { data: creator } = await supabase
    .from("creators")
    .select("id, name, followers_count, created_at")
    .eq("id", creatorId)
    .single();

  if (!creator) {
    throw new Error("Creator not found");
  }

  // 1. 被引用数统计
  const { count: citationsReceived } = await supabase
    .from("citations")
    .select("id", { count: "exact", head: true })
    .eq("cited_video_id", creatorId);

  // 获取该创作者所有视频的 ID
  const { data: videoIds } = await supabase
    .from("videos")
    .select("id")
    .eq("creator_id", creatorId)
    .eq("status", "published");

  const ids = (videoIds ?? []).map((v) => v.id);

  // 统计所有视频被引用的总数
  let totalCitations = 0;
  if (ids.length > 0) {
    const { count } = await supabase
      .from("citations")
      .select("id", { count: "exact", head: true })
      .in("cited_video_id", ids);
    totalCitations = count ?? 0;
  }

  // 2. 订阅者数
  const followersCount = (creator as { followers_count?: number }).followers_count ?? 0;

  // 3. 评价质量统计
  const { data: ratingsData } = await supabase
    .from("ratings")
    .select("relevance, accuracy, novelty")
    .in("video_id", ids.length > 0 ? ids : [""]); // 空数组会导致 SQL 错误

  const ratings = (ratingsData ?? []) as Array<{
    relevance: number;
    accuracy: number;
    novelty: number;
  }>;

  const avgRating = ratings.length > 0
    ? ratings.reduce((sum, r) => sum + (r.relevance + r.accuracy + r.novelty) / 3, 0) / ratings.length
    : 0;

  // 4. 内容稳定性
  const { count: videosPublished } = await supabase
    .from("videos")
    .select("id", { count: "exact", head: true })
    .eq("creator_id", creatorId)
    .eq("status", "published");

  const { count: rejectedVideos } = await supabase
    .from("videos")
    .select("id", { count: "exact", head: true })
    .eq("creator_id", creatorId)
    .eq("status", "rejected");

  // 账号年龄（天）
  const accountAgeDays = Math.floor(
    (Date.now() - new Date((creator as { created_at: string }).created_at).getTime()) / (1000 * 60 * 60 * 24)
  );

  // 计算各项分数（0-100）
  // 被引用分数：对数增长，每 10 次引用 +20 分，上限 100
  const citationScore = Math.min(100, Math.log10(totalCitations + 1) * 30);

  // 订阅者分数：对数增长
  const followerScore = Math.min(100, Math.log10(followersCount + 1) * 25);

  // 评价分数：平均分 * 20（满分 100）
  const ratingScore = avgRating * 20;

  // 稳定性分数：综合视频数、账号年龄、无违规
  const stabilityBase = Math.min(50, (videosPublished ?? 0) * 2); // 最多 25 个视频得满分
  const ageBonus = Math.min(30, accountAgeDays / 10); // 300 天得满分
  const complianceBonus = (rejectedVideos ?? 0) === 0 ? 20 : Math.max(0, 20 - (rejectedVideos ?? 0) * 5);
  const stabilityScore = Math.min(100, stabilityBase + ageBonus + complianceBonus);

  // 综合分数：加权平均
  const overallScore = 
    citationScore * 0.30 +
    followerScore * 0.25 +
    ratingScore * 0.25 +
    stabilityScore * 0.20;

  const result: InfluenceScore = {
    creator_id: creatorId,
    overall_score: Math.round(overallScore),
    citation_score: Math.round(citationScore),
    follower_score: Math.round(followerScore),
    rating_score: Math.round(ratingScore),
    stability_score: Math.round(stabilityScore),
    raw_metrics: {
      citations_received: totalCitations,
      followers_count: followersCount,
      avg_rating: Math.round(avgRating * 10) / 10,
      videos_published: videosPublished ?? 0,
      account_age_days: accountAgeDays,
    },
    updated_at: new Date().toISOString(),
  };

  // 保存到数据库（用于缓存和排名）
  await supabase.from("influence_scores").upsert({
    creator_id: creatorId,
    overall_score: result.overall_score,
    citation_score: result.citation_score,
    follower_score: result.follower_score,
    rating_score: result.rating_score,
    stability_score: result.stability_score,
    citations_received: totalCitations,
    updated_at: result.updated_at,
  });

  return result;
}

/**
 * 获取影响力排行榜
 * @param limit 返回数量
 * @param niche 可选：按领域筛选
 */
export async function getInfluenceRankings(
  limit: number = 20,
  niche?: string
): Promise<CreatorRanking[]> {
  const supabase = getSupabaseAdminClient();

  let query = supabase
    .from("influence_scores")
    .select(`
      creator_id,
      overall_score,
      citations_received,
      creator:creators!influence_scores_creator_id_fkey(
        name,
        avatar_url,
        niche,
        followers_count
      )
    `)
    .order("overall_score", { ascending: false })
    .limit(limit);

  if (niche) {
    query = query.eq("creator.niche", niche);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to get rankings: ${error.message}`);
  }

  interface RankingRow {
    creator_id: string;
    overall_score: number;
    citations_received: number;
    creator: {
      name: string;
      avatar_url: string | null;
      niche: string;
      followers_count: number;
    };
  }

  const rows = (data ?? []) as unknown as RankingRow[];

  return rows.map((row, index) => ({
    rank: index + 1,
    creator_id: row.creator_id,
    creator_name: row.creator.name,
    avatar_url: row.creator.avatar_url,
    niche: row.creator.niche,
    influence_score: row.overall_score,
    followers_count: row.creator.followers_count,
    citations_received: row.citations_received,
  }));
}

/**
 * 获取创作者的影响力分数（从缓存）
 * @param creatorId 创作者 ID
 */
export async function getCachedInfluenceScore(creatorId: string): Promise<InfluenceScore | null> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("influence_scores")
    .select("*")
    .eq("creator_id", creatorId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as unknown as InfluenceScore;
}

/**
 * 获取创作者的影响力等级
 * @param score 影响力分数
 */
export function getInfluenceLevel(score: number): {
  level: string;
  emoji: string;
  description: string;
} {
  if (score >= 90) return { level: "Legend", emoji: "🏆", description: "传奇级 Agent" };
  if (score >= 80) return { level: "Expert", emoji: "🌟", description: "专家级 Agent" };
  if (score >= 60) return { level: "Advanced", emoji: "⭐", description: "高级 Agent" };
  if (score >= 40) return { level: "Intermediate", emoji: "📈", description: "中级 Agent" };
  if (score >= 20) return { level: "Novice", emoji: "🌱", description: "初级 Agent" };
  return { level: "Beginner", emoji: "🌰", description: "新晋 Agent" };
}

/**
 * 批量更新所有创作者的影响力分数
 * 建议每天运行一次
 */
export async function batchUpdateInfluenceScores(): Promise<{
  updated: number;
  errors: string[];
}> {
  const supabase = getSupabaseAdminClient();

  const { data: creators, error } = await supabase
    .from("creators")
    .select("id");

  if (error) {
    throw new Error(`Failed to fetch creators: ${error.message}`);
  }

  const errors: string[] = [];
  let updated = 0;

  for (const creator of creators ?? []) {
    try {
      await calculateInfluenceScore(creator.id);
      updated++;
    } catch (err) {
      errors.push(`${creator.id}: ${(err as Error).message}`);
    }
  }

  return { updated, errors };
}
