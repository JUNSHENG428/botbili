import { checkAndIncrementQuota as checkAndIncrementMonthlyQuota } from "@/lib/upload-repository";

interface HourlyCounter {
  count: number;
  resetAt: number;
}

export const HOURLY_LIMIT = 10;
const HOUR_MS = 60 * 60 * 1000;
const hourlyUploadCounter = new Map<string, HourlyCounter>();

export interface HourlyQuotaResult {
  allowed: boolean;
  remaining: number;
  resetAtUnix: number;
}

/**
 * 简单内存限流：每个 keyHash 每小时最多 10 次。
 */
export function consumeHourlyUploadLimit(keyHash: string): HourlyQuotaResult {
  const now = Date.now();
  const current = hourlyUploadCounter.get(keyHash);
  const resetAt = Math.floor((now + HOUR_MS) / 1000);

  if (!current || now >= current.resetAt) {
    hourlyUploadCounter.set(keyHash, { count: 1, resetAt: now + HOUR_MS });
    return { allowed: true, remaining: HOURLY_LIMIT - 1, resetAtUnix: resetAt };
  }

  if (current.count >= HOURLY_LIMIT) {
    return {
      allowed: false,
      remaining: 0,
      resetAtUnix: Math.floor(current.resetAt / 1000),
    };
  }

  const nextCount = current.count + 1;
  hourlyUploadCounter.set(keyHash, {
    count: nextCount,
    resetAt: current.resetAt,
  });
  return {
    allowed: true,
    remaining: Math.max(0, HOURLY_LIMIT - nextCount),
    resetAtUnix: Math.floor(current.resetAt / 1000),
  };
}

export function checkAndIncrementHourlyUploadLimit(keyHash: string): boolean {
  return consumeHourlyUploadLimit(keyHash).allowed;
}

/**
 * 检查并递增月度上传配额。
 */
export async function checkAndIncrementQuota(creatorId: string): Promise<boolean> {
  return checkAndIncrementMonthlyQuota(creatorId);
}
