import { getSupabaseAdminClient } from "@/lib/supabase/server";

export interface SuggestTopic {
  topic: string;
  reason: string;
  related_tags: string[];
  competition: "low" | "medium" | "high";
}

export interface SuggestResponse {
  topics: SuggestTopic[];
  generated_at: string;
}

export async function getSuggestions(niche?: string): Promise<SuggestResponse> {
  const supabase = getSupabaseAdminClient();

  const { data: allTags } = await supabase
    .from("videos")
    .select("tags, creator:creators!videos_creator_id_fkey(niche)")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(500);

  if (!allTags?.length) {
    return { topics: [], generated_at: new Date().toISOString() };
  }

  const tagCounts = new Map<string, number>();
  const nicheTags = new Map<string, Set<string>>();

  for (const row of allTags) {
    const tags = (row.tags as string[]) ?? [];
    const creatorNiche = (row.creator as { niche?: string } | null)?.niche ?? "";

    for (const tag of tags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);

      if (creatorNiche) {
        if (!nicheTags.has(creatorNiche)) {
          nicheTags.set(creatorNiche, new Set());
        }
        nicheTags.get(creatorNiche)!.add(tag);
      }
    }
  }

  const sortedTags = Array.from(tagCounts.entries())
    .sort((a, b) => a[1] - b[1])
    .slice(0, 20);

  const filteredTags = niche
    ? sortedTags.filter(([tag]) => {
        const related = Array.from(nicheTags.entries())
          .filter(([n]) => n.includes(niche) || niche.includes(n));
        return related.some(([, tags]) => tags.has(tag));
      })
    : sortedTags;

  const topics: SuggestTopic[] = filteredTags.slice(0, 8).map(([tag, count]) => ({
    topic: tag,
    reason: count <= 5
      ? `低竞争，只有 ${count} 个视频覆盖`
      : count <= 15
        ? `中等竞争，有 ${count} 个视频，仍有增长空间`
        : `热门话题，${count} 个视频覆盖，但需求旺盛`,
    related_tags: Array.from(nicheTags.entries())
      .filter(([, tags]) => tags.has(tag))
      .slice(0, 3)
      .map(([n]) => n),
    competition: count <= 5 ? "low" : count <= 15 ? "medium" : "high",
  }));

  return {
    topics,
    generated_at: new Date().toISOString(),
  };
}
