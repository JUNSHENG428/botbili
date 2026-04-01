import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { VideoWithCreator } from "@/types";

export interface SearchResult {
  video_id: string;
  title: string;
  creator_name: string;
  creator_id: string;
  match_type: "semantic" | "transcript" | "summary" | "title" | "tags";
  snippet: string;
  relevance_score: number;
  created_at: string;
  view_count: number;
}

interface VideoSearchRow {
  id: string;
  title: string;
  transcript: string | null;
  summary: string | null;
  tags: string[];
  created_at: string;
  view_count: number;
  creator: { id: string; name: string };
}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/**
 * 生成文本的 embedding（用于语义搜索）
 */
async function generateEmbedding(text: string): Promise<number[]> {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text.slice(0, 8000),
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${error}`);
  }

  const data = await response.json() as {
    data: Array<{ embedding: number[] }>;
  };

  return data.data[0]?.embedding ?? [];
}

/**
 * 语义搜索：基于 embedding 的相似度搜索
 */
async function searchSemantic(query: string, limit: number): Promise<SearchResult[]> {
  const supabase = getSupabaseAdminClient();

  try {
    const queryEmbedding = await generateEmbedding(query);

    const { data: results, error } = await supabase.rpc("search_videos_by_embedding", {
      query_embedding: JSON.stringify(queryEmbedding),
      match_limit: limit,
    });

    if (error) {
      console.warn("Semantic search failed, falling back to keyword search:", error);
      return [];
    }

    interface SemanticResultRow {
      id: string;
      title: string;
      summary: string | null;
      transcript: string | null;
      tags: string[];
      view_count: number;
      created_at: string;
      similarity: number;
      creator_id: string;
      creator_name: string;
    }

    const typedResults = (results ?? []) as unknown as SemanticResultRow[];

    return typedResults.map((r: SemanticResultRow) => ({
      video_id: r.id,
      title: r.title,
      creator_name: r.creator_name,
      creator_id: r.creator_id,
      match_type: "semantic" as const,
      snippet: r.summary ?? (r.transcript ? r.transcript.slice(0, 150) + "..." : ""),
      relevance_score: Math.round(r.similarity * 1000) / 1000,
      created_at: r.created_at,
      view_count: r.view_count,
    }));
  } catch (err) {
    console.warn("Semantic search error:", err);
    return [];
  }
}

/**
 * 关键词搜索：基于文本匹配的搜索
 */
async function searchKeyword(query: string, limit: number): Promise<SearchResult[]> {
  const supabase = getSupabaseAdminClient();

  const { data: videosRaw, error } = await supabase
    .from("videos")
    .select(
      "id, title, transcript, summary, tags, created_at, view_count, creator:creators!videos_creator_id_fkey(id, name)"
    )
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(200);

  const videos = (videosRaw ?? []) as unknown as VideoSearchRow[];

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
    let score = 0;

    // 检查 transcript
    if (video.transcript) {
      const transcriptLower = video.transcript.toLowerCase();
      if (transcriptLower.includes(queryLower)) {
        const idx = transcriptLower.indexOf(queryLower);
        const start = Math.max(0, idx - 40);
        const end = Math.min(video.transcript.length, idx + query.length + 40);
        snippet = (start > 0 ? "..." : "") + video.transcript.slice(start, end) + (end < video.transcript.length ? "..." : "");
        bestMatch = "transcript";
        score = 0.7;
      }
    }

    // 检查 summary
    if (!bestMatch && video.summary) {
      const summaryLower = video.summary.toLowerCase();
      if (summaryLower.includes(queryLower)) {
        snippet = video.summary.slice(0, 150) + (video.summary.length > 150 ? "..." : "");
        bestMatch = "summary";
        score = 0.8;
      }
    }

    // 检查 title
    if (!bestMatch && video.title.toLowerCase().includes(queryLower)) {
      snippet = video.title;
      bestMatch = "title";
      score = 0.9;
    }

    // 检查 tags
    if (!bestMatch) {
      const matchedTag = video.tags.find((tag) =>
        queryWords.some((word) => tag.toLowerCase().includes(word))
      );
      if (matchedTag) {
        snippet = `标签匹配: ${matchedTag}`;
        bestMatch = "tags";
        score = 0.5;
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
        relevance_score: score,
        created_at: video.created_at,
        view_count: video.view_count,
      });
    }
  }

  return results
    .sort((a, b) => b.relevance_score - a.relevance_score)
    .slice(0, limit);
}

/**
 * 混合搜索：结合语义搜索和关键词搜索
 * @param query 搜索查询
 * @param limit 返回结果数量
 * @returns 搜索结果列表
 */
export async function searchVideos(query: string, limit: number = 20): Promise<SearchResult[]> {
  // 同时进行语义搜索和关键词搜索
  const [semanticResults, keywordResults] = await Promise.all([
    searchSemantic(query, limit).catch((err) => {
      console.warn("Semantic search failed:", err);
      return [];
    }),
    searchKeyword(query, limit),
  ]);

  // 合并结果，去重
  const seen = new Set<string>();
  const merged: SearchResult[] = [];

  // 优先使用语义搜索结果
  for (const r of semanticResults) {
    if (!seen.has(r.video_id)) {
      seen.add(r.video_id);
      merged.push(r);
    }
  }

  // 补充关键词搜索结果
  for (const r of keywordResults) {
    if (!seen.has(r.video_id)) {
      seen.add(r.video_id);
      merged.push(r);
    }
  }

  return merged.slice(0, limit);
}
