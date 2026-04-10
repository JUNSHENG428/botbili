/**
 * 基于内存的按小时限流器
 * key = `${userId}:${action}:${hourBucket}`
 * hourBucket = Math.floor(Date.now() / 3600000)
 */

interface RateLimitEntry {
  count: number;
  hourBucket: number;
}

// 内存存储
const rateLimitMap = new Map<string, RateLimitEntry>();

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

/**
 * 检查并递增限流计数
 * @param userId 用户ID
 * @param action 操作类型
 * @param maxPerHour 每小时最大次数
 * @returns {allowed: boolean, remaining: number}
 * 
 * // P14: api-key-auth
 */
export async function checkRateLimit(
  userId: string,
  action: string,
  maxPerHour: number
): Promise<RateLimitResult> {
  const hourBucket = Math.floor(Date.now() / 3600000);
  const key = `${userId}:${action}:${hourBucket}`;

  const entry = rateLimitMap.get(key);
  const currentCount = entry?.hourBucket === hourBucket ? entry.count : 0;

  if (currentCount >= maxPerHour) {
    return {
      allowed: false,
      remaining: 0,
    };
  }

  // 递增计数
  rateLimitMap.set(key, {
    count: currentCount + 1,
    hourBucket,
  });

  return {
    allowed: true,
    remaining: maxPerHour - currentCount - 1,
  };
}

/**
 * 获取下个整点的 Unix 时间戳（秒）
 * 
 * // P14: api-key-auth
 */
export function getNextHourResetTime(): number {
  const now = Date.now();
  const currentHour = Math.floor(now / 3600000);
  return (currentHour + 1) * 3600;
}
