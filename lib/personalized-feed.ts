import { getSupabaseAdminClient } from "@/lib/supabase/server";

export interface PersonalizedFeedItem {
  id: string;
  creator_id: string;
  title: string;
  description: string;
  tags: string[];
  raw_video_url: string;
  thumbnail_url: string | null;
  summary: string | null;
  language: string;
  cloudflare_video_id: string | null;
  cloudflare_playback_url: string | null;
  duration_seconds: number | null;
  view_count: number;
  like_count: number;
  status: string;
  moderation_result: Record<string, unknown> | null;
  source: string;
  created_at: string;
  updated_at: string;
  creator: {
    id: string;
    owner_id: string;
    name: string;
    avatar_url: string | null;
    niche: string;
    followers_count: number;
  };
  relevance_score: number;
}

export interface PersonalizedFeedResponse {
  items: PersonalizedFeedItem[];
  has_more: boolean;
  reason: string;
}

export async function getPersonalizedFeed(
  creatorId: string,
  page: number = 1,
  pageSize: number = 20,
): Promise<PersonalizedFeedResponse> {
  const supabase = getSupabaseAdminClient();

  const { data: myCreator } = await supabase
    .from("creators")
    .select("niche")
    .eq("id", creatorId)
    .maybeSingle<{ niche: string }>();

  const myNiche = myCreator?.niche ?? "";

  const { data: followedCreators } = await supabase
    .from("follows")
    .select("creator_id")
    .eq("follower_id", creatorId);

  const followedIds = followedCreators?.map((f) => f.creator_id) ?? [];

  const { data: followedNiches } = followedIds.length > 0
    ? await supabase
        .from("creators")
        .select("id, niche")
        .in("id", followedIds)
        .returns<Array<{ id: string; niche: string }>>()
    : { data: null };

  const nicheSet = new Set<string>();
  if (myNiche) nicheSet.add(myNiche.toLowerCase());
  for (const nc of followedNiches ?? []) {
    if (nc.niche) nicheSet.add(nc.niche.toLowerCase());
  }

  const { count } = await supabase
    .from("videos")
    .select("id", { count: "exact", head: true })
    .eq("status", "published");

  const { data: videos } = await supabase
    .from("videos")
    .select(
      "id, creator_id, title, description, tags, raw_video_url, thumbnail_url, summary, language, cloudflare_video_id, cloudflare_playback_url, duration_seconds, view_count, like_count, status, moderation_result, source, created_at, updated_at, creator:creators!videos_creator_id_fkey(id, owner_id, name, avatar_url, niche, followers_count)"
    )
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(100)
    .returns<
      Array<{
        id: string;
        creator_id: string;
        title: string;
        description: string;
        tags: string[];
        raw_video_url: string;
        thumbnail_url: string | null;
        summary: string | null;
        language: string;
        cloudflare_video_id: string | null;
        cloudflare_playback_url: string | null;
        duration_seconds: number | null;
        view_count: number;
        like_count: number;
        status: string;
        moderation_result: Record<string, unknown> | null;
        source: string;
        created_at: string;
        updated_at: string;
        creator: {
          id: string;
          owner_id: string;
          name: string;
          avatar_url: string | null;
          niche: string;
          followers_count: number;
        };
      }>
    >();

  if (!videos?.length) {
    return { items: [], has_more: false, reason: "暂无内容" };
  }

  const scored = videos
    .filter((v) => v.creator_id !== creatorId)
    .map((v) => {
      let score = 0;

      if (followedIds.includes(v.creator_id)) {
        score += 10;
      }

      if (v.creator.niche && nicheSet.has(v.creator.niche.toLowerCase())) {
        score += 5;
      }

      const videoTags = v.tags.map((t) => t.toLowerCase());
      for (const niche of nicheSet) {
        if (videoTags.some((t) => t.includes(niche) || niche.includes(t))) {
          score += 3;
        }
      }

      score += Math.log10(v.view_count + 1) * 0.5;
      score += Math.log10(v.like_count + 1) * 0.3;

      const ageHours = (Date.now() - new Date(v.created_at).getTime()) / (1000 * 60 * 60);
      score += Math.max(0, 5 - ageHours / 24);

      return { ...v, relevance_score: Math.round(score * 100) / 100 };
    })
    .sort((a, b) => b.relevance_score - a.relevance_score);

  const from = (page - 1) * pageSize;
  const pageItems = scored.slice(from, from + pageSize);

  const reason = nicheSet.size > 0
    ? `根据你的领域「${myNiche}」和关注的 ${followedIds.length} 个 UP 主推荐`
    : "根据热门内容推荐";

  return {
    items: pageItems,
    has_more: from + pageItems.length < scored.length,
    reason,
  };
}
