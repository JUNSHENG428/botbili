import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { VideoWithCreator } from "@/types";

export interface SearchResult {
  video_id: string;
  title: string;
  creator_name: string;
  creator_id: string;
  match_type: "transcript" | "summary" | "title" | "tags";
  snippet: string;
  created_at: string;
  view_count: number;
}

export async function searchVideos(query: string, limit: number = 20): Promise<SearchResult[]> {
  const supabase = getSupabaseAdminClient();

  const { data: videos, error } = await supabase
    .from("videos")
    .select(
      "id, title, transcript, summary, tags, created_at, view_count, creator:creators!videos_creator_id_fkey(id, name)"
    )
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(200)
    .returns<
      Array<{
        id: string;
        title: string;
        transcript: string | null;
        summary: string | null;
        tags: string[];
        created_at: string;
        view_count: number;
        creator: { id: string; name: string };
      }>
    >();

  if (error) {
    throw new Error(`searchVideos failed: ${error.message}`);
  }

  if (!videos?.length) {
    return [];
  }

  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter((w) => w.length > 1);

  const results: SearchResult[] = [];

  for (const video of videos) {
    let bestMatch: SearchResult["match_type"] | null = null;
    let snippet = "";

    if (video.transcript) {
      const transcriptLower = video.transcript.toLowerCase();
      if (transcriptLower.includes(queryLower)) {
        const idx = transcriptLower.indexOf(queryLower);
        const start = Math.max(0, idx - 40);
        const end = Math.min(video.transcript.length, idx + query.length + 40);
        snippet = (start > 0 ? "..." : "") + video.transcript.slice(start, end) + (end < video.transcript.length ? "..." : "");
        bestMatch = "transcript";
      }
    }

    if (!bestMatch && video.summary) {
      const summaryLower = video.summary.toLowerCase();
      if (summaryLower.includes(queryLower)) {
        snippet = video.summary;
        bestMatch = "summary";
      }
    }

    if (!bestMatch && video.title.toLowerCase().includes(queryLower)) {
      snippet = video.title;
      bestMatch = "title";
    }

    if (!bestMatch) {
      const matchedTag = video.tags.find((tag) =>
        queryWords.some((word) => tag.toLowerCase().includes(word))
      );
      if (matchedTag) {
        snippet = `标签匹配: ${matchedTag}`;
        bestMatch = "tags";
      }
    }

    if (bestMatch) {
      results.push({
        video_id: video.id,
        title: video.title,
        creator_name: video.creator.name,
        creator_id: video.creator.id,
        match_type: bestMatch,
        snippet,
        created_at: video.created_at,
        view_count: video.view_count,
      });
    }
  }

  return results
    .sort((a, b) => {
      const typeOrder = { transcript: 0, summary: 1, title: 2, tags: 3 };
      return typeOrder[a.match_type] - typeOrder[b.match_type] || b.view_count - a.view_count;
    })
    .slice(0, limit);
}
