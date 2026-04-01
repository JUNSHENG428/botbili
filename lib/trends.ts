import { getSupabaseAdminClient } from "@/lib/supabase/server";

export interface TrendingTag {
  tag: string;
  count: number;
  growth: string;
}

export interface RisingTopic {
  topic: string;
  first_seen: string;
  video_count: number;
  trend: string;
}

export interface ContentTypeStat {
  type: string;
  avg_views: number;
  avg_engagement: number;
}

export interface TrendsResponse {
  period: string;
  hot_tags: TrendingTag[];
  rising_topics: RisingTopic[];
  top_content_types: ContentTypeStat[];
}

export async function getTrends(period: string = "7d"): Promise<TrendsResponse> {
  const supabase = getSupabaseAdminClient();

  const days = period === "24h" ? 1 : period === "30d" ? 30 : 7;

  const { data: tagsData, error: tagsError } = await supabase
    .rpc("get_trending_tags", { days });

  if (tagsError) {
    console.error("get_trending_tags RPC failed:", tagsError);
  }

  const { data: topicsData, error: topicsError } = await supabase
    .rpc("get_rising_topics", { days });

  if (topicsError) {
    console.error("get_rising_topics RPC failed:", topicsError);
  }

  const { data: statsData, error: statsError } = await supabase
    .rpc("get_content_type_stats", { days });

  if (statsError) {
    console.error("get_content_type_stats RPC failed:", statsError);
  }

  const safeArray = <T>(data: unknown): T[] => {
    if (Array.isArray(data)) return data as T[];
    return [];
  };

  const tags = safeArray<{ tag: string; count: number; growth: number }>(tagsData);
  const topics = safeArray<{ topic: string; first_seen: string; video_count: number; trend: string }>(topicsData);
  const stats = safeArray<{ content_type: string; avg_views: number; avg_engagement: number }>(statsData);

  return {
    period,
    hot_tags: tags.map((t) => ({
      tag: t.tag,
      count: t.count,
      growth: t.growth >= 999 ? "+∞" : `+${t.growth}%`,
    })),
    rising_topics: topics.map((t) => ({
      topic: t.topic,
      first_seen: t.first_seen,
      video_count: t.video_count,
      trend: t.trend,
    })),
    top_content_types: stats.map((s) => ({
      type: s.content_type,
      avg_views: Math.round(s.avg_views),
      avg_engagement: Math.round(s.avg_engagement * 100) / 100,
    })),
  };
}
