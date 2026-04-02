import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { checkAndIncrementQuota as checkAndIncrementMonthlyQuota } from "@/lib/upload-repository";

export const HOURLY_LIMIT = 10;

export interface HourlyQuotaResult {
  allowed: boolean;
  remaining: number;
  resetAtUnix: number;
}

/**
 * 消耗小时上传限额，使用原子 RPC 避免并发竞态。
 */
export async function consumeHourlyUploadLimit(keyHash: string): Promise<HourlyQuotaResult> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase.rpc("consume_hourly_limit", {
    p_key_hash: keyHash,
    p_limit: HOURLY_LIMIT,
  });

  if (error) {
    throw new Error(`consumeHourlyUploadLimit RPC failed: ${error.message}`);
  }

  const result = data as { allowed: boolean; current_count: number; reset_at_unix: number } | null;
  if (!result) {
    throw new Error("consumeHourlyUploadLimit RPC returned no data");
  }

  const remaining = result.allowed
    ? Math.max(0, HOURLY_LIMIT - result.current_count)
    : 0;

  return {
    allowed: result.allowed,
    remaining,
    resetAtUnix: result.reset_at_unix,
  };
}

export async function checkAndIncrementHourlyUploadLimit(keyHash: string): Promise<boolean> {
  return (await consumeHourlyUploadLimit(keyHash)).allowed;
}

export async function checkAndIncrementQuota(creatorId: string): Promise<boolean> {
  return checkAndIncrementMonthlyQuota(creatorId);
}
