import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { checkAndIncrementQuota as checkAndIncrementMonthlyQuota } from "@/lib/upload-repository";

export const HOURLY_LIMIT = 10;
const HOUR_MS = 60 * 60 * 1000;

export interface HourlyQuotaResult {
  allowed: boolean;
  remaining: number;
  resetAtUnix: number;
}

interface HourlyLimitRow {
  key_hash: string;
  count: number;
  reset_at: string;
}

async function cleanupExpiredLimits(): Promise<void> {
  const supabase = getSupabaseAdminClient();
  await supabase
    .from("hourly_upload_limits")
    .delete()
    .lt("reset_at", new Date().toISOString());
}

export async function consumeHourlyUploadLimit(keyHash: string): Promise<HourlyQuotaResult> {
  const supabase = getSupabaseAdminClient();
  const now = Date.now();

  await cleanupExpiredLimits();

  const { data, error } = await supabase
    .from("hourly_upload_limits")
    .select("key_hash, count, reset_at")
    .eq("key_hash", keyHash)
    .maybeSingle<HourlyLimitRow>();

  if (error) {
    throw new Error(`consumeHourlyUploadLimit query failed: ${error.message}`);
  }

  const resetAt = Math.floor((now + HOUR_MS) / 1000);

  if (!data || new Date(data.reset_at) <= new Date(now)) {
    const { error: insertError } = await supabase
      .from("hourly_upload_limits")
      .upsert({
        key_hash: keyHash,
        count: 1,
        reset_at: new Date(now + HOUR_MS).toISOString(),
      });

    if (insertError) {
      throw new Error(`consumeHourlyUploadLimit upsert failed: ${insertError.message}`);
    }

    return { allowed: true, remaining: HOURLY_LIMIT - 1, resetAtUnix: resetAt };
  }

  if (data.count >= HOURLY_LIMIT) {
    return {
      allowed: false,
      remaining: 0,
      resetAtUnix: Math.floor(new Date(data.reset_at).getTime() / 1000),
    };
  }

  const { error: updateError } = await supabase
    .from("hourly_upload_limits")
    .update({ count: data.count + 1 })
    .eq("key_hash", keyHash);

  if (updateError) {
    throw new Error(`consumeHourlyUploadLimit update failed: ${updateError.message}`);
  }

  const nextCount = data.count + 1;
  return {
    allowed: true,
    remaining: Math.max(0, HOURLY_LIMIT - nextCount),
    resetAtUnix: Math.floor(new Date(data.reset_at).getTime() / 1000),
  };
}

export async function checkAndIncrementHourlyUploadLimit(keyHash: string): Promise<boolean> {
  return (await consumeHourlyUploadLimit(keyHash)).allowed;
}

export async function checkAndIncrementQuota(creatorId: string): Promise<boolean> {
  return checkAndIncrementMonthlyQuota(creatorId);
}
