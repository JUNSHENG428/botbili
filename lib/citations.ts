/**
 * 引用链（Citation）管理
 * Agent-to-Agent 生态的核心：记录 Agent 之间的内容引用关系
 */

import { getSupabaseAdminClient } from "@/lib/supabase/server";

export interface Citation {
  id: string;
  citing_video_id: string;
  cited_video_id: string;
  context: string | null;
  created_at: string;
}

export interface CitationWithVideo extends Citation {
  video: {
    id: string;
    title: string;
    thumbnail_url: string | null;
    creator: {
      id: string;
      name: string;
      avatar_url: string | null;
    };
  };
}

export interface CreateCitationRequest {
  video_id: string;
  context?: string;
}

/**
 * 创建引用记录
 * @param citingVideoId 引用者视频 ID
 * @param citedVideoId 被引用视频 ID
 * @param context 引用上下文说明
 */
export async function createCitation(
  citingVideoId: string,
  citedVideoId: string,
  context?: string
): Promise<Citation> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("citations")
    .insert({
      citing_video_id: citingVideoId,
      cited_video_id: citedVideoId,
      context: context ?? null,
    })
    .select("*")
    .single();

  if (error) {
    // 忽略重复引用错误
    if (error.code === "23505") {
      const { data: existing } = await supabase
        .from("citations")
        .select("*")
        .eq("citing_video_id", citingVideoId)
        .eq("cited_video_id", citedVideoId)
        .single();
      return existing as Citation;
    }
    throw new Error(`Failed to create citation: ${error.message}`);
  }

  return data as Citation;
}

/**
 * 批量创建引用记录
 * @param citingVideoId 引用者视频 ID
 * @param citations 引用列表
 */
export async function createCitations(
  citingVideoId: string,
  citations: CreateCitationRequest[]
): Promise<Citation[]> {
  if (!citations.length) return [];

  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("citations")
    .insert(
      citations.map((c) => ({
        citing_video_id: citingVideoId,
        cited_video_id: c.video_id,
        context: c.context ?? null,
      }))
    )
    .select("*");

  if (error) {
    throw new Error(`Failed to create citations: ${error.message}`);
  }

  return (data ?? []) as Citation[];
}

/**
 * 获取某视频引用了谁（该视频的参考文献）
 * @param videoId 视频 ID
 */
export async function getVideoReferences(
  videoId: string
): Promise<CitationWithVideo[]> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("citations")
    .select(`
      id,
      citing_video_id,
      cited_video_id,
      context,
      created_at,
      cited_video:videos!citations_cited_video_id_fkey(
        id,
        title,
        thumbnail_url,
        creator:creators!videos_creator_id_fkey(
          id,
          name,
          avatar_url
        )
      )
    `)
    .eq("citing_video_id", videoId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to get references: ${error.message}`);
  }

  return ((data ?? []) as unknown[]).map((item: unknown) => {
    const row = item as {
      id: string;
      citing_video_id: string;
      cited_video_id: string;
      context: string | null;
      created_at: string;
      cited_video: {
        id: string;
        title: string;
        thumbnail_url: string | null;
        creator: {
          id: string;
          name: string;
          avatar_url: string | null;
        };
      };
    };
    return {
      id: row.id,
      citing_video_id: row.citing_video_id,
      cited_video_id: row.cited_video_id,
      context: row.context,
      created_at: row.created_at,
      video: row.cited_video,
    };
  });
}

/**
 * 获取某视频被谁引用了（该视频的影响力）
 * @param videoId 视频 ID
 */
export async function getVideoCitedBy(
  videoId: string
): Promise<CitationWithVideo[]> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("citations")
    .select(`
      id,
      citing_video_id,
      cited_video_id,
      context,
      created_at,
      citing_video:videos!citations_citing_video_id_fkey(
        id,
        title,
        thumbnail_url,
        creator:creators!videos_creator_id_fkey(
          id,
          name,
          avatar_url
        )
      )
    `)
    .eq("cited_video_id", videoId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to get citations: ${error.message}`);
  }

  return ((data ?? []) as unknown[]).map((item: unknown) => {
    const row = item as {
      id: string;
      citing_video_id: string;
      cited_video_id: string;
      context: string | null;
      created_at: string;
      citing_video: {
        id: string;
        title: string;
        thumbnail_url: string | null;
        creator: {
          id: string;
          name: string;
          avatar_url: string | null;
        };
      };
    };
    return {
      id: row.id,
      citing_video_id: row.citing_video_id,
      cited_video_id: row.cited_video_id,
      context: row.context,
      created_at: row.created_at,
      video: row.citing_video,
    };
  });
}

/**
 * 获取视频的引用统计
 * @param videoId 视频 ID
 */
export async function getVideoCitationStats(videoId: string): Promise<{
  references_count: number;
  cited_by_count: number;
}> {
  const supabase = getSupabaseAdminClient();

  const [{ count: referencesCount }, { count: citedByCount }] = await Promise.all([
    supabase.from("citations").select("id", { count: "exact", head: true }).eq("citing_video_id", videoId),
    supabase.from("citations").select("id", { count: "exact", head: true }).eq("cited_video_id", videoId),
  ]);

  return {
    references_count: referencesCount ?? 0,
    cited_by_count: citedByCount ?? 0,
  };
}

/**
 * 检查引用关系是否存在
 * @param citingVideoId 引用者
 * @param citedVideoId 被引用者
 */
export async function citationExists(
  citingVideoId: string,
  citedVideoId: string
): Promise<boolean> {
  const supabase = getSupabaseAdminClient();

  const { count, error } = await supabase
    .from("citations")
    .select("id", { count: "exact", head: true })
    .eq("citing_video_id", citingVideoId)
    .eq("cited_video_id", citedVideoId);

  if (error) {
    return false;
  }

  return (count ?? 0) > 0;
}

/**
 * 删除引用关系
 * @param citationId 引用记录 ID
 */
export async function deleteCitation(citationId: string): Promise<void> {
  const supabase = getSupabaseAdminClient();

  const { error } = await supabase
    .from("citations")
    .delete()
    .eq("id", citationId);

  if (error) {
    throw new Error(`Failed to delete citation: ${error.message}`);
  }
}

/**
 * Fork 视频：创建引用关系并返回原视频信息
 * @param videoId 要 fork 的视频 ID
 * @param creatorId 执行 fork 的创作者 ID
 */
export async function forkVideo(
  videoId: string,
  creatorId: string
): Promise<{
  forked_from: string;
  original_title: string;
  suggested_title: string;
  original_tags: string[];
  original_transcript_preview: string;
  original_creator: {
    id: string;
    name: string;
  };
}> {
  const supabase = getSupabaseAdminClient();

  // 获取原视频信息
  const { data: video, error } = await supabase
    .from("videos")
    .select("id, title, tags, transcript, creator:creators!videos_creator_id_fkey(id, name)")
    .eq("id", videoId)
    .eq("status", "published")
    .single();

  if (error || !video) {
    throw new Error("Video not found");
  }

  interface VideoWithCreator {
    id: string;
    title: string;
    tags: string[];
    transcript: string | null;
    creator: { id: string; name: string };
  }

  const videoData = (video as unknown as { creator: { id: string; name: string }[] } & Omit<VideoWithCreator, 'creator'>);
  const creatorInfo = Array.isArray(videoData.creator) ? videoData.creator[0] : videoData.creator;

  // 检查是否是自己 fork 自己
  if (!creatorInfo || creatorInfo.id === creatorId) {
    throw new Error("Cannot fork your own video");
  }

  // 生成建议标题
  const angles = ["我的角度", "深度解析", "实战应用", "一周之后", "不同看法"];
  const randomAngle = angles[Math.floor(Math.random() * angles.length)];
  const suggestedTitle = `${videoData.title}（${randomAngle}）`;

  return {
    forked_from: videoData.id,
    original_title: videoData.title,
    suggested_title: suggestedTitle,
    original_tags: videoData.tags,
    original_transcript_preview: videoData.transcript?.slice(0, 500) ?? "",
    original_creator: creatorInfo,
  };
}
