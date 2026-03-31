import { NextResponse } from "next/server";

import type { ApiError } from "@/types";
import { buildApiErrorWithMeta } from "@/lib/utils";

export interface RateLimitHeaderMeta {
  limit: number;
  remaining: number;
  resetAtUnix: number;
  retryAfterSeconds?: number;
}

const DEFAULT_LIMIT = 10;

function getDefaultRateLimitMeta(): RateLimitHeaderMeta {
  return {
    limit: DEFAULT_LIMIT,
    remaining: DEFAULT_LIMIT,
    resetAtUnix: Math.floor(Date.now() / 1000) + 3600,
  };
}

export function withRateLimitHeaders<T>(
  response: NextResponse<T>,
  meta?: Partial<RateLimitHeaderMeta>,
): NextResponse<T> {
  const merged = { ...getDefaultRateLimitMeta(), ...meta };
  response.headers.set("X-RateLimit-Limit", String(merged.limit));
  response.headers.set("X-RateLimit-Remaining", String(Math.max(0, merged.remaining)));
  response.headers.set("X-RateLimit-Reset", String(merged.resetAtUnix));
  if (merged.retryAfterSeconds !== undefined) {
    response.headers.set("Retry-After", String(Math.max(0, merged.retryAfterSeconds)));
  }
  return response;
}

interface ApiErrorResponseOptions {
  message: string;
  code: string;
  status: number;
  rate?: Partial<RateLimitHeaderMeta>;
  meta?: Omit<ApiError, "error" | "code" | "message">;
}

/**
 * 统一 API 错误响应：增强错误体 + 标准限流响应头。
 */
export function apiErrorResponse(options: ApiErrorResponseOptions): NextResponse<ApiError> {
  const defaults = getDefaultRateLimitMeta();
  const mergedRate = { ...defaults, ...(options.rate ?? {}) };
  const payload = buildApiErrorWithMeta(options.message, options.code, {
    current: Math.max(0, mergedRate.limit - mergedRate.remaining),
    limit: mergedRate.limit,
    reset_at: new Date(mergedRate.resetAtUnix * 1000).toISOString(),
    retry_after: mergedRate.retryAfterSeconds,
    docs_url: "https://botbili.com/llms-full.txt",
    ...(options.meta ?? {}),
  });

  return withRateLimitHeaders(NextResponse.json(payload, { status: options.status }), mergedRate);
}
