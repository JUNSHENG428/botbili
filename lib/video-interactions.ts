import { randomUUID } from "node:crypto";

import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type {
  InteractionAction,
  InteractionSummaryByViewer,
  VideoInteractionRecord,
  VideoInteractionSummary,
  ViewerType,
} from "@/types";

interface InteractionInput {
  videoId: string;
  viewerType: ViewerType;
  action: InteractionAction;
  content?: string;
  viewerLabel?: string;
}

const memoryInteractions = new Map<string, VideoInteractionRecord[]>();

function isMissingTableError(message: string): boolean {
  return message.includes("relation") && message.includes("does not exist");
}

function emptySummary(): InteractionSummaryByViewer {
  return {
    view_count: 0,
    like_count: 0,
    share_count: 0,
    comments: [],
  };
}

function buildSummary(records: VideoInteractionRecord[]): VideoInteractionSummary {
  const ai = emptySummary();
  const human = emptySummary();

  records.forEach((record) => {
    const target = record.viewer_type === "ai" ? ai : human;
    if (record.action === "view") {
      target.view_count += 1;
    } else if (record.action === "like") {
      target.like_count += 1;
    } else if (record.action === "share") {
      target.share_count += 1;
    } else if (record.action === "comment" && record.content) {
      target.comments.push({
        id: record.id,
        content: record.content,
        viewer_label: record.viewer_label,
        created_at: record.created_at,
      });
    }
  });

  return { ai, human };
}

function pushToMemory(record: VideoInteractionRecord): void {
  const list = memoryInteractions.get(record.video_id) ?? [];
  list.unshift(record);
  memoryInteractions.set(record.video_id, list);
}

export async function createVideoInteraction(input: InteractionInput): Promise<VideoInteractionRecord> {
  const record: VideoInteractionRecord = {
    id: randomUUID(),
    video_id: input.videoId,
    viewer_type: input.viewerType,
    action: input.action,
    content: input.content ?? null,
    viewer_label: input.viewerLabel ?? null,
    created_at: new Date().toISOString(),
  };

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("video_interactions")
    .insert({
      id: record.id,
      video_id: record.video_id,
      viewer_type: record.viewer_type,
      action: record.action,
      content: record.content,
      viewer_label: record.viewer_label,
    })
    .select("*")
    .single<VideoInteractionRecord>();

  if (!error && data) {
    return data;
  }

  if (error && !isMissingTableError(error.message)) {
    throw new Error(`createVideoInteraction failed: ${error.message}`);
  }

  pushToMemory(record);
  return record;
}

export async function getVideoInteractionSummary(videoId: string): Promise<VideoInteractionSummary> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("video_interactions")
    .select("*")
    .eq("video_id", videoId)
    .order("created_at", { ascending: false })
    .returns<VideoInteractionRecord[]>();

  if (!error) {
    return buildSummary(data ?? []);
  }

  if (!isMissingTableError(error.message)) {
    throw new Error(`getVideoInteractionSummary failed: ${error.message}`);
  }

  return buildSummary(memoryInteractions.get(videoId) ?? []);
}
