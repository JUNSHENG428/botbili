import { getSupabaseAdminClient } from "@/lib/supabase/server";

export interface SuggestTopic {
  topic: string;
  reason: string;
  related_tags: string[];
  competition: "low" | "medium" | "high";
  estimated_views: string;
  reference_videos?: Array<{
    id: string;
    title: string;
    view_count: number;
  }>;
}

export interface SuggestResponse {
  niche: string;
  suggestions: SuggestTopic[];
  generated_at: string;
}

/**
 * 获取选题建议
 * 基于趋势数据、热门话题和竞争分析
 * @param niche 领域/ niche（如"科技"、"娱乐"等）
 * @param count 建议数量
 * @param creatorId 可选：当前创作者 ID（用于排除已做过的选题）
 */
export async function getSuggestions(
  niche?: string,
  count: number = 5,
  creatorId?: string,
): Promise<SuggestResponse> {
  const supabase = getSupabaseAdminClient();

  // 获取热门 tags（趋势）
  const { data: trendingTags } = await supabase
    .rpc("get_trending_tags", { days: 7 })
    .returns<Array<{ tag: string; count: number; growth: number }>>();

  // 获取该领域最近高播放视频的选题
  const { data: hotVideos } = await supabase
    .from("videos")
    .select("id, title, tags, view_count, summary, creator:creators!videos_creator_id_fkey(niche)")
    .eq("status", "published")
    .order("view_count", { ascending: false })
    .limit(50)
    .returns<Array<{
      id: string;
      title: string;
      tags: string[];
      view_count: number;
      summary: string | null;
      creator: { niche?: string } | null;
    }>>();

  // 如果有 creatorId，获取该频道已有的 tags（避免重复）
  let existingTags: string[] = [];
  if (creatorId) {
    const { data: myVideos } = await supabase
      .from("videos")
      .select("tags")
      .eq("creator_id", creatorId)
      .eq("status", "published");
    
    existingTags = [...new Set((myVideos ?? []).flatMap((v) => v.tags ?? []))];
  }

  // 过滤符合 niche 的视频
  const nicheVideos = niche
    ? hotVideos?.filter((v) => 
        v.creator?.niche?.includes(niche) || 
        niche.includes(v.creator?.niche ?? "") ||
        v.tags.some((t) => t.includes(niche))
      )
    : hotVideos;

  // 按 tag 统计（排除已做过的）
  const tagStats = new Map<string, { count: number; views: number; videos: typeof hotVideos }>();
  
  for (const video of nicheVideos ?? []) {
    for (const tag of video.tags ?? []) {
      // 跳过已做过的 tags
      if (existingTags.some((et) => et.toLowerCase() === tag.toLowerCase())) {
        continue;
      }

      const existing = tagStats.get(tag);
      if (existing) {
        existing.count += 1;
        existing.views += video.view_count;
        if (existing.videos.length < 3) {
          existing.videos.push(video);
        }
      } else {
        tagStats.set(tag, {
          count: 1,
          views: video.view_count,
          videos: [video],
        });
      }
    }
  }

  // 结合趋势数据排序
  const sortedTags = Array.from(tagStats.entries())
    .map(([tag, stats]) => {
      const trend = trendingTags?.find((t) => t.tag === tag);
      const trendScore = trend ? (trend.growth > 0 ? trend.growth : 0) : 0;
      const hotScore = Math.log10(stats.views + 1) * stats.count;
      const score = hotScore + trendScore * 0.1;
      
      return {
        tag,
        count: stats.count,
        views: stats.views,
        trend: trend?.growth ?? 0,
        score,
        videos: stats.videos,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, count);

  // 生成选题建议
  const suggestions: SuggestTopic[] = sortedTags.map((item) => {
    const avgViews = Math.round(item.views / item.count);
    const competition: SuggestTopic["competition"] = 
      item.count <= 3 ? "low" : item.count <= 10 ? "medium" : "high";
    
    // 生成差异化选题角度
    const angles = [
      `${item.tag} 最新进展与深度解析`,
      `${item.tag} 实战教程：从入门到精通`,
      `${item.tag} 一周回顾：关键动态盘点`,
      `如何用 ${item.tag} 提升你的工作效率`,
      `${item.tag} 对比评测：选对工具很重要`,
    ];
    
    const topic = angles[Math.floor(Math.random() * angles.length)];
    
    let reason: string;
    if (item.trend > 100) {
      reason = `${item.tag} 是本周上升最快的话题（+${item.trend}%），已有 ${item.count} 个视频覆盖但仍供不应求`;
    } else if (item.count <= 3) {
      reason = `低竞争蓝海：${item.tag} 话题仅有 ${item.count} 个视频，平均播放 ${avgViews.toLocaleString()}`;
    } else {
      reason = `热门话题：${item.tag} 有 ${item.count} 个视频，平均播放 ${avgViews.toLocaleString()}，建议找差异化角度切入`;
    }

    // 估计播放量区间
    let estimatedViews: string;
    if (competition === "low") {
      estimatedViews = "500-1500";
    } else if (competition === "medium") {
      estimatedViews = "300-800";
    } else {
      estimatedViews = "100-500（需差异化角度）";
    }

    return {
      topic,
      reason,
      related_tags: [item.tag, "AI", niche ?? "科技"].filter(Boolean),
      competition,
      estimated_views: estimatedViews,
      reference_videos: item.videos?.map((v) => ({
        id: v.id,
        title: v.title,
        view_count: v.view_count,
      })),
    };
  });

  return {
    niche: niche ?? "通用",
    suggestions,
    generated_at: new Date().toISOString(),
  };
}
