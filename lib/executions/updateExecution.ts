import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { RecipeExecutionStatus } from "@/types/recipe";

export interface ExecutionUpdatePayload {
  status: RecipeExecutionStatus;
  progress_pct?: number;
  output_external_url?: string | null;
  output_thumbnail_url?: string | null;
  output_platform?: string | null;
  error_message?: string | null;
  command_text?: string | null;
}

function shouldMarkStarted(status: RecipeExecutionStatus): boolean {
  return status !== "pending";
}

function shouldMarkCompleted(status: RecipeExecutionStatus): boolean {
  return status === "success" || status === "failed";
}

/**
 * 统一更新 execution，兼容旧 progress 字段与新 progress_pct 字段。
 */
export async function updateExecutionById(
  executionId: string,
  payload: ExecutionUpdatePayload,
): Promise<void> {
  const admin = getSupabaseAdminClient();
  const nowIso = new Date().toISOString();
  const { data: existing, error: existingError } = await admin
    .from("recipe_executions")
    .select("id, started_at, completed_at")
    .eq("id", executionId)
    .maybeSingle();

  if (existingError) {
    throw new Error(`读取 execution 失败: ${existingError.message}`);
  }
  if (!existing) {
    throw new Error("execution 不存在");
  }

  const updatePayload: Record<string, unknown> = {
    status: payload.status,
    updated_at: nowIso,
  };

  if (payload.progress_pct !== undefined) {
    updatePayload.progress_pct = payload.progress_pct;
    updatePayload.progress = payload.progress_pct;
  }

  if (payload.output_external_url !== undefined) {
    updatePayload.output_external_url = payload.output_external_url;
  }
  if (payload.output_thumbnail_url !== undefined) {
    updatePayload.output_thumbnail_url = payload.output_thumbnail_url;
  }
  if (payload.output_platform !== undefined) {
    updatePayload.output_platform = payload.output_platform;
  }
  if (payload.error_message !== undefined) {
    updatePayload.error_message = payload.error_message;
  }
  if (payload.command_text !== undefined) {
    updatePayload.command_text = payload.command_text;
  }
  if (shouldMarkStarted(payload.status) && !existing.started_at) {
    updatePayload.started_at = nowIso;
  }
  if (shouldMarkCompleted(payload.status) && !existing.completed_at) {
    updatePayload.completed_at = nowIso;
  }

  const { error } = await admin
    .from("recipe_executions")
    .update(updatePayload)
    .eq("id", executionId);

  if (error) {
    throw new Error(`更新 execution 失败: ${error.message}`);
  }
}
