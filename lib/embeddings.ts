/**
 * OpenAI Embeddings 封装
 * 用于语义搜索，将文本转换为向量
 */

import type { VideoWithCreator } from "@/types";

import { getSupabaseAdminClient } from "./supabase/server";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/**
 * 使用 OpenAI API 生成文本的 embedding
 * @param text 输入文本（会被截断到 8000 字符）
 * @returns 1536 维的向量数组
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const truncatedText = text.slice(0, 8000);

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: truncatedText,
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
 * 为视频生成 embedding 并保存到数据库
 * 组合使用：title + summary + transcript + tags
 * @param videoId 视频 ID
 */
export async function generateVideoEmbedding(videoId: string): Promise<void> {
  const supabase = getSupabaseAdminClient();

  const { data: video } = await supabase
    .from("videos")
    .select("title, summary, transcript, tags")
    .eq("id", videoId)
    .maybeSingle<{
      title: string;
      summary: string | null;
      transcript: string | null;
      tags: string[];
    }>();

  if (!video) {
    throw new Error(`Video ${videoId} not found`);
  }

  // 组合文本：标题权重最高，其次是摘要，然后是正文，最后是标签
  const combinedText = [
    video.title,
    video.title, // 标题重复一次增加权重
    video.summary ?? "",
    video.transcript ?? "",
    ...(video.tags ?? []),
  ].filter(Boolean).join("\n\n");

  if (!combinedText.trim()) {
    console.warn(`Video ${videoId} has no content to embed`);
    return;
  }

  const embedding = await generateEmbedding(combinedText);

  if (embedding.length === 0) {
    throw new Error("Failed to generate embedding");
  }

  // 保存到数据库
  const { error } = await supabase
    .from("videos")
    .update({ embedding: JSON.stringify(embedding) })
    .eq("id", videoId);

  if (error) {
    throw new Error(`Failed to save embedding: ${error.message}`);
  }
}

/**
 * 语义搜索视频
 * 使用 pgvector 进行余弦相似度搜索
 * @param query 搜索查询
 * @param limit 返回结果数量
 * @returns 搜索结果列表（包含相似度分数）
 */
export async function searchVideosSemantic(
  query: string,
  limit: number = 10,
): Promise<Array<{
  video: VideoWithCreator;
  similarity: number;
  highlight: string;
}>> {
  const supabase = getSupabaseAdminClient();

  const queryEmbedding = await generateEmbedding(query);

  // 调用 RPC 函数进行向量搜索
  const { data: results, error } = await supabase
    .rpc("search_videos_by_embedding", {
      query_embedding: JSON.stringify(queryEmbedding),
      match_limit: limit,
    })
    .returns<Array<{
      id: string;
      title: string;
      summary: string | null;
      transcript: string | null;
      similarity: number;
      creator: {
        id: string;
        name: string;
        slug: string;
        avatar_url: string | null;
      };
    }>>();

  if (error) {
    throw new Error(`Semantic search failed: ${error.message}`);
  }

  return (results ?? []).map((r) => ({
    video: {
      id: r.id,
      title: r.title,
      creator: r.creator,
    } as unknown as VideoWithCreator,
    similarity: Math.round(r.similarity * 100) / 100,
    highlight: r.summary ?? r.transcript?.slice(0, 200) ?? "",
  }));
}

/**
 * 混合搜索：结合语义搜索和关键词搜索
 * @param query 搜索查询
 * @param limit 返回结果数量
 * @returns 合并后的搜索结果
 */
export async function searchVideosHybrid(
  query: string,
  limit: number = 10,
): Promise<Array<{
  video_id: string;
  title: string;
  creator_name: string;
  creator_id: string;
  match_type: "semantic" | "transcript" | "summary" | "title" | "tags";
  snippet: string;
  relevance_score: number;
  created_at: string;
  view_count: number;
}>> {
  // 先尝试语义搜索
  const semanticResults = await searchVideosSemantic(query, limit);

  // 转换为统一格式
  return semanticResults.map((r) => ({
    video_id: r.video.id,
    title: r.video.title,
    creator_name: r.video.creator?.name ?? "",
    creator_id: r.video.creator?.id ?? "",
    match_type: "semantic" as const,
    snippet: r.highlight,
    relevance_score: r.similarity,
    created_at: (r.video as unknown as { created_at?: string }).created_at ?? "",
    view_count: (r.video as unknown as { view_count?: number }).view_count ?? 0,
  }));
}
