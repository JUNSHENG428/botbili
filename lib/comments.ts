import { randomUUID } from "node:crypto";

import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { ViewerType } from "@/types";

export interface CommentRecord {
  id: string;
  video_id: string;
  user_id: string | null;
  agent_key_hash: string | null;
  content: string;
  viewer_type: ViewerType;
  viewer_label: string | null;
  created_at: string;
}

export interface CommentWithProfile extends CommentRecord {
  display_name: string | null;
  avatar_url: string | null;
}

interface CreateCommentInput {
  videoId: string;
  userId?: string;
  agentKeyHash?: string;
  content: string;
  viewerType: ViewerType;
  viewerLabel?: string;
}

interface ListCommentsOptions {
  videoId: string;
  page: number;
  viewerType?: ViewerType | "all";
  pageSize?: number;
}

interface CommentsPage {
  data: CommentWithProfile[];
  total: number;
  page: number;
  hasMore: boolean;
}

function isMissingTableError(message: string): boolean {
  return message.includes("relation") && message.includes("does not exist");
}

export async function createComment(input: CreateCommentInput): Promise<CommentRecord> {
  const supabase = getSupabaseAdminClient();
  const id = randomUUID();

  const row = {
    id,
    video_id: input.videoId,
    user_id: input.userId ?? null,
    agent_key_hash: input.agentKeyHash ?? null,
    content: input.content,
    viewer_type: input.viewerType,
    viewer_label: input.viewerLabel ?? null,
  };

  const { data, error } = await supabase
    .from("comments")
    .insert(row)
    .select("*")
    .single<CommentRecord>();

  if (error) {
    if (isMissingTableError(error.message)) {
      return { ...row, created_at: new Date().toISOString() };
    }
    throw new Error(`createComment failed: ${error.message}`);
  }

  // comment_count 递增（直接 SQL 更新，不依赖 rpc）
  try {
    const { data: videoRow } = await supabase
      .from("videos")
      .select("comment_count")
      .eq("id", input.videoId)
      .single<{ comment_count: number }>();
    if (videoRow) {
      await supabase
        .from("videos")
        .update({ comment_count: (videoRow.comment_count ?? 0) + 1 })
        .eq("id", input.videoId);
    }
  } catch {
    // 计数更新失败不阻塞评论创建
  }

  return data;
}

export async function listComments(options: ListCommentsOptions): Promise<CommentsPage> {
  const { videoId, page, viewerType = "all", pageSize = 20 } = options;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const supabase = getSupabaseAdminClient();

  let query = supabase
    .from("comments")
    .select("*, profiles:user_id(display_name, avatar_url)", { count: "exact" })
    .eq("video_id", videoId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (viewerType !== "all") {
    query = query.eq("viewer_type", viewerType);
  }

  const { data, count, error } = await query;

  if (error) {
    if (isMissingTableError(error.message)) {
      return { data: [], total: 0, page, hasMore: false };
    }
    throw new Error(`listComments failed: ${error.message}`);
  }

  const total = count ?? 0;
  const comments: CommentWithProfile[] = (data ?? []).map((row: Record<string, unknown>) => {
    const profile = row.profiles as { display_name?: string; avatar_url?: string } | null;
    return {
      id: row.id as string,
      video_id: row.video_id as string,
      user_id: row.user_id as string | null,
      agent_key_hash: row.agent_key_hash as string | null,
      content: row.content as string,
      viewer_type: row.viewer_type as ViewerType,
      viewer_label: row.viewer_label as string | null,
      created_at: row.created_at as string,
      display_name: profile?.display_name ?? null,
      avatar_url: profile?.avatar_url ?? null,
    };
  });

  return {
    data: comments,
    total,
    page,
    hasMore: from + comments.length < total,
  };
}
