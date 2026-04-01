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

export interface InfluenceRawMetrics {
  citations_received: number;
  followers_count: number;
  avg_rating: number;
  videos_published: number;
  account_age_days: number;
}

export interface InfluenceScore {
  creator_id: string;
  overall_score: number;
  citation_score: number;
  follower_score: number;
  rating_score: number;
  stability_score: number;
  raw_metrics: InfluenceRawMetrics;
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

interface CreatorProfileRow {
  id: string;
  name: string;
  followers_count: number;
  created_at: string;
}

interface InfluenceComputationSnapshot extends InfluenceRawMetrics {
  rejected_videos: number;
}

interface InfluenceCacheRow {
  creator_id: string;
  overall_score: number;
  citation_score: number;
  follower_score: number;
  rating_score: number;
  stability_score: number;
  citations_received: number | null;
  followers_count?: number | string | null;
  avg_rating?: number | string | null;
  videos_published?: number | string | null;
  account_age_days?: number | string | null;
  updated_at: string;
}

function toNumber(value: number | string | null | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function roundToSingleDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function buildInfluenceScore(
  creatorId: string,
  snapshot: InfluenceComputationSnapshot,
  updatedAt: string,
): InfluenceScore {
  // 被引用分数：对数增长，每 10 次引用约 +30 分，上限 100。
  const citationScore = Math.min(100, Math.log10(snapshot.citations_received + 1) * 30);

  // 订阅者分数：对数增长，避免大号完全碾压小号。
  const followerScore = Math.min(100, Math.log10(snapshot.followers_count + 1) * 25);

  // 评价分数：平均分 * 20，满分 100。
  const ratingScore = snapshot.avg_rating * 20;

  // 稳定性分数：产量、账号年龄、违规情况共同决定。
  const stabilityBase = Math.min(50, snapshot.videos_published * 2);
  const ageBonus = Math.min(30, snapshot.account_age_days / 10);
  const complianceBonus =
    snapshot.rejected_videos === 0
      ? 20
      : Math.max(0, 20 - snapshot.rejected_videos * 5);
  const stabilityScore = Math.min(100, stabilityBase + ageBonus + complianceBonus);

  const overallScore =
    citationScore * 0.30 +
    followerScore * 0.25 +
    ratingScore * 0.25 +
    stabilityScore * 0.20;

  return {
    creator_id: creatorId,
    overall_score: Math.round(overallScore),
    citation_score: Math.round(citationScore),
    follower_score: Math.round(followerScore),
    rating_score: Math.round(ratingScore),
    stability_score: Math.round(stabilityScore),
    raw_metrics: {
      citations_received: snapshot.citations_received,
      followers_count: snapshot.followers_count,
      avg_rating: roundToSingleDecimal(snapshot.avg_rating),
      videos_published: snapshot.videos_published,
      account_age_days: snapshot.account_age_days,
    },
    updated_at: updatedAt,
  };
}

function isMissingInfluenceColumnError(error: { code?: string; message?: string } | null): boolean {
  if (!error) {
    return false;
  }

  return (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    Boolean(error.message?.includes("followers_count")) ||
    Boolean(error.message?.includes("avg_rating")) ||
    Boolean(error.message?.includes("videos_published")) ||
    Boolean(error.message?.includes("account_age_days"))
  );
}

async function getInfluenceComputationSnapshot(
  creatorId: string,
): Promise<InfluenceComputationSnapshot> {
  const supabase = getSupabaseAdminClient();

  const { data: creator, error: creatorError } = await supabase
    .from("creators")
    .select("id, name, followers_count, created_at")
    .eq("id", creatorId)
    .single<CreatorProfileRow>();

  if (creatorError || !creator) {
    throw new Error("Creator not found");
  }

  const { data: publishedVideos, error: publishedVideosError } = await supabase
    .from("videos")
    .select("id")
    .eq("creator_id", creatorId)
    .eq("status", "published");

  if (publishedVideosError) {
    throw new Error(`Failed to fetch creator videos: ${publishedVideosError.message}`);
  }

  const publishedVideoIds = (publishedVideos ?? []).map((video) => (video as { id: string }).id);

  let citationsReceived = 0;
  if (publishedVideoIds.length > 0) {
    const { count, error: citationsError } = await supabase
      .from("citations")
      .select("id", { count: "exact", head: true })
      .in("cited_video_id", publishedVideoIds);

    if (citationsError) {
      throw new Error(`Failed to fetch citations: ${citationsError.message}`);
    }

    citationsReceived = count ?? 0;
  }

  let avgRating = 0;
  if (publishedVideoIds.length > 0) {
    const { data: ratingsData, error: ratingsError } = await supabase
      .from("ratings")
      .select("relevance, accuracy, novelty")
      .in("video_id", publishedVideoIds);

    if (ratingsError) {
      throw new Error(`Failed to fetch ratings: ${ratingsError.message}`);
    }

    const ratings = (ratingsData ?? []) as Array<{
      relevance: number;
      accuracy: number;
      novelty: number;
    }>;

    if (ratings.length > 0) {
      avgRating =
        ratings.reduce((sum, rating) => {
          return sum + (rating.relevance + rating.accuracy + rating.novelty) / 3;
        }, 0) / ratings.length;
    }
  }

  const { count: rejectedVideos, error: rejectedVideosError } = await supabase
    .from("videos")
    .select("id", { count: "exact", head: true })
    .eq("creator_id", creatorId)
    .eq("status", "rejected");

  if (rejectedVideosError) {
    throw new Error(`Failed to fetch rejected videos: ${rejectedVideosError.message}`);
  }

  const createdAt = new Date(creator.created_at);
  const accountAgeDays = Number.isNaN(createdAt.getTime())
    ? 0
    : Math.max(
        0,
        Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24)),
      );

  return {
    citations_received: citationsReceived,
    followers_count: creator.followers_count ?? 0,
    avg_rating: avgRating,
    videos_published: publishedVideoIds.length,
    account_age_days: accountAgeDays,
    rejected_videos: rejectedVideos ?? 0,
  };
}

async function upsertInfluenceCache(score: InfluenceScore): Promise<void> {
  const supabase = getSupabaseAdminClient();

  const basePayload = {
    creator_id: score.creator_id,
    overall_score: score.overall_score,
    citation_score: score.citation_score,
    follower_score: score.follower_score,
    rating_score: score.rating_score,
    stability_score: score.stability_score,
    citations_received: score.raw_metrics.citations_received,
    updated_at: score.updated_at,
  };

  const extendedPayload = {
    ...basePayload,
    followers_count: score.raw_metrics.followers_count,
    avg_rating: score.raw_metrics.avg_rating,
    videos_published: score.raw_metrics.videos_published,
    account_age_days: score.raw_metrics.account_age_days,
  };

  const { error: extendedError } = await supabase
    .from("influence_scores")
    .upsert(extendedPayload);

  if (!extendedError) {
    return;
  }

  if (!isMissingInfluenceColumnError(extendedError)) {
    throw new Error(`Failed to cache influence score: ${extendedError.message}`);
  }

  const { error: fallbackError } = await supabase
    .from("influence_scores")
    .upsert(basePayload);

  if (fallbackError) {
    throw new Error(`Failed to cache influence score: ${fallbackError.message}`);
  }
}

/**
 * 计算创作者的影响力指数
 * @param creatorId 创作者 ID
 */
export async function calculateInfluenceScore(creatorId: string): Promise<InfluenceScore> {
  const snapshot = await getInfluenceComputationSnapshot(creatorId);
  const result = buildInfluenceScore(creatorId, snapshot, new Date().toISOString());

  await upsertInfluenceCache(result);

  return result;
}

/**
 * 获取影响力排行榜
 * @param limit 返回数量
 * @param niche 可选：按领域筛选
 */
export async function getInfluenceRankings(
  limit: number = 20,
  niche?: string,
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

  const row = data as InfluenceCacheRow;

  const cachedFollowersCount = toNumber(row.followers_count);
  const cachedAvgRating = toNumber(row.avg_rating);
  const cachedVideosPublished = toNumber(row.videos_published);
  const cachedAccountAgeDays = toNumber(row.account_age_days);

  let rawMetrics: InfluenceRawMetrics;
  if (
    cachedFollowersCount !== null &&
    cachedAvgRating !== null &&
    cachedVideosPublished !== null &&
    cachedAccountAgeDays !== null
  ) {
    rawMetrics = {
      citations_received: toNumber(row.citations_received) ?? 0,
      followers_count: cachedFollowersCount,
      avg_rating: roundToSingleDecimal(cachedAvgRating),
      videos_published: cachedVideosPublished,
      account_age_days: cachedAccountAgeDays,
    };
  } else {
    const snapshot = await getInfluenceComputationSnapshot(creatorId);
    rawMetrics = {
      citations_received: snapshot.citations_received,
      followers_count: snapshot.followers_count,
      avg_rating: roundToSingleDecimal(snapshot.avg_rating),
      videos_published: snapshot.videos_published,
      account_age_days: snapshot.account_age_days,
    };
  }

  return {
    creator_id: row.creator_id,
    overall_score: row.overall_score,
    citation_score: row.citation_score,
    follower_score: row.follower_score,
    rating_score: row.rating_score,
    stability_score: row.stability_score,
    raw_metrics: rawMetrics,
    updated_at: row.updated_at,
  };
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
      await calculateInfluenceScore((creator as { id: string }).id);
      updated++;
    } catch (err) {
      errors.push(`${(creator as { id: string }).id}: ${(err as Error).message}`);
    }
  }

  return { updated, errors };
}
