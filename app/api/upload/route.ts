import { NextRequest, NextResponse } from "next/server";

import { withRateLimitHeaders } from "@/lib/api-response";
import { extractBearerToken, hashApiKey, verifyApiKey } from "@/lib/auth";
import { uploadVideoByUrl } from "@/lib/cloudflare";
import { moderateText } from "@/lib/moderation";
import { checkAndIncrementQuota, consumeHourlyUploadLimit, HOURLY_LIMIT } from "@/lib/quota";
import { getUploadByIdempotencyKey, setUploadByIdempotencyKey } from "@/lib/upload-idempotency";
import { createVideo } from "@/lib/upload-repository";
import { buildApiErrorWithMeta, isHttpUrl } from "@/lib/utils";
import type { ApiError, UploadRequest, UploadResponse } from "@/types";

/**
 * 上传视频到 BotBili（异步转码，先返回 processing 状态资源）。
 *
 * curl 测试命令：
 * curl -X POST http://localhost:3000/api/upload \
 *   -H "Authorization: Bearer bb_xxxxxxxx" \
 *   -H "Content-Type: application/json" \
 *   -d '{"title":"测试视频","video_url":"https://example.com/video.mp4"}'
 */

type ValidationResult =
  | { ok: true; data: UploadRequest }
  | { ok: false; error: string; code: string; status: number };

function errorResponse(
  message: string,
  code: string,
  status: number,
  rateHeaders?: { remaining?: number; resetAtUnix?: number; retryAfterSeconds?: number; limit?: number },
): NextResponse<ApiError> {
  const limit = rateHeaders?.limit ?? HOURLY_LIMIT;
  const resetAtUnix = rateHeaders?.resetAtUnix ?? Math.floor(Date.now() / 1000) + 3600;
  const retryAfter = rateHeaders?.retryAfterSeconds;
  return withRateLimitHeaders(
    NextResponse.json(
      buildApiErrorWithMeta(message, code, {
        current: limit - (rateHeaders?.remaining ?? limit),
        limit,
        reset_at: new Date(resetAtUnix * 1000).toISOString(),
        retry_after: retryAfter,
        docs_url: "https://botbili.com/llms-full.txt",
      }),
      { status },
    ),
    {
      limit,
      remaining: rateHeaders?.remaining ?? limit,
      resetAtUnix,
      retryAfterSeconds: retryAfter,
    },
  );
}

function validateUploadBody(rawBody: unknown): ValidationResult {
  if (!rawBody || typeof rawBody !== "object") {
    return { ok: false, error: "Invalid request body", code: "INVALID_REQUEST_BODY", status: 400 };
  }

  const body = rawBody as Partial<UploadRequest>;

  if (typeof body.title !== "string" || body.title.trim().length === 0 || body.title.length > 200) {
    return { ok: false, error: "Invalid title", code: "INVALID_TITLE", status: 400 };
  }

  if (typeof body.video_url !== "string" || !isHttpUrl(body.video_url)) {
    return { ok: false, error: "Invalid video_url", code: "INVALID_VIDEO_URL", status: 400 };
  }

  if (typeof body.description === "string" && body.description.length > 2000) {
    return { ok: false, error: "Description too long", code: "INVALID_DESCRIPTION", status: 400 };
  }

  if (body.thumbnail_url !== undefined) {
    if (typeof body.thumbnail_url !== "string" || !isHttpUrl(body.thumbnail_url)) {
      return { ok: false, error: "Invalid thumbnail_url", code: "INVALID_THUMBNAIL_URL", status: 400 };
    }
  }

  if (body.tags !== undefined) {
    if (!Array.isArray(body.tags) || body.tags.length > 10) {
      return { ok: false, error: "Invalid tags", code: "INVALID_TAGS", status: 400 };
    }
    const hasInvalidTag = body.tags.some((tag: unknown) => typeof tag !== "string" || tag.length > 30);
    if (hasInvalidTag) {
      return { ok: false, error: "Invalid tags", code: "INVALID_TAGS", status: 400 };
    }
  }

  if (body.idempotency_key !== undefined) {
    if (typeof body.idempotency_key !== "string" || body.idempotency_key.trim().length === 0) {
      return { ok: false, error: "Invalid idempotency_key", code: "IDEMPOTENCY_KEY_INVALID", status: 400 };
    }
    if (body.idempotency_key.length > 120) {
      return { ok: false, error: "idempotency_key too long", code: "IDEMPOTENCY_KEY_INVALID", status: 400 };
    }
  }

  if (body.transcript !== undefined && typeof body.transcript !== "string") {
    return { ok: false, error: "Invalid transcript", code: "INVALID_TRANSCRIPT", status: 400 };
  }

  if (body.summary !== undefined) {
    if (typeof body.summary !== "string") {
      return { ok: false, error: "Invalid summary", code: "INVALID_SUMMARY", status: 400 };
    }
    if (body.summary.trim().length > 500) {
      return { ok: false, error: "Summary too long", code: "INVALID_SUMMARY", status: 400 };
    }
  }

  if (body.language !== undefined) {
    if (typeof body.language !== "string" || body.language.trim().length === 0) {
      return { ok: false, error: "Invalid language", code: "INVALID_LANGUAGE", status: 400 };
    }
  }

  return {
    ok: true,
    data: {
      title: body.title.trim(),
      video_url: body.video_url,
      description: body.description?.trim(),
      tags: body.tags ?? [],
      thumbnail_url: body.thumbnail_url,
      idempotency_key: body.idempotency_key?.trim(),
      transcript: body.transcript?.trim(),
      summary: body.summary?.trim(),
      language: body.language?.trim() || "zh-CN",
    },
  };
}

export async function POST(request: NextRequest): Promise<NextResponse<ApiError | UploadResponse>> {
  try {
    const token = extractBearerToken(request.headers.get("authorization"));
    if (!token) {
      return errorResponse("Unauthorized", "AUTH_INVALID_KEY", 401);
    }

    const tokenHash = hashApiKey(token);
    const creator = await verifyApiKey(tokenHash);
    if (!creator) {
      return errorResponse("Unauthorized", "AUTH_INVALID_KEY", 401);
    }

    if (!creator.is_active) {
      return errorResponse("API key is inactive", "AUTH_ACCOUNT_DISABLED", 403);
    }

    const hourlyLimit = consumeHourlyUploadLimit(tokenHash);
    if (!hourlyLimit.allowed) {
      const resetAtSeconds = Math.max(0, hourlyLimit.resetAtUnix - Math.floor(Date.now() / 1000));
      return errorResponse("Too many requests", "RATE_LIMITED", 429, {
        remaining: 0,
        resetAtUnix: hourlyLimit.resetAtUnix,
        retryAfterSeconds: resetAtSeconds,
      });
    }

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return errorResponse("Invalid JSON body", "VALIDATION_JSON_INVALID", 400, {
        remaining: hourlyLimit.remaining,
        resetAtUnix: hourlyLimit.resetAtUnix,
      });
    }

    const validationResult = validateUploadBody(rawBody);
    if (!validationResult.ok) {
      return errorResponse(validationResult.error, `VALIDATION_${validationResult.code}`, validationResult.status, {
        remaining: hourlyLimit.remaining,
        resetAtUnix: hourlyLimit.resetAtUnix,
      });
    }
    const uploadPayload = validationResult.data;

    if (uploadPayload.idempotency_key) {
      const existing = await getUploadByIdempotencyKey(creator.id, uploadPayload.idempotency_key);
      if (existing) {
        return withRateLimitHeaders(
          NextResponse.json(
            {
              video_id: existing.videoId,
              url: existing.url,
              status: existing.status,
            },
            { status: 200 },
          ),
          {
            limit: HOURLY_LIMIT,
            remaining: hourlyLimit.remaining,
            resetAtUnix: hourlyLimit.resetAtUnix,
          },
        );
      }
    }

    const monthlyQuotaAvailable = await checkAndIncrementQuota(creator.id);
    if (!monthlyQuotaAvailable) {
      return errorResponse("Monthly upload quota exceeded", "QUOTA_EXCEEDED", 429, {
        remaining: hourlyLimit.remaining,
        resetAtUnix: hourlyLimit.resetAtUnix,
      });
    }

    const moderationInput = `${uploadPayload.title}\n${uploadPayload.description ?? ""}`;
    const moderationResult = await moderateText(moderationInput);
    if (moderationResult.flagged) {
      const reason =
        moderationResult.categories.length > 0
          ? `Content rejected: ${moderationResult.categories.join(", ")}`
          : "Content rejected by moderation";
      return errorResponse(reason, "MODERATION_REJECTED", 422, {
        remaining: hourlyLimit.remaining,
        resetAtUnix: hourlyLimit.resetAtUnix,
      });
    }

    const cloudflareResult = await uploadVideoByUrl(uploadPayload.video_url);
    const createdVideo = await createVideo(
      creator.id,
      uploadPayload,
      cloudflareResult.uid,
      cloudflareResult.playbackUrl,
    );

    const { getBaseUrl } = await import("@/lib/utils");
    const appUrl = getBaseUrl();

    const videoUrl = `${appUrl}/v/${createdVideo.id}`;
    if (uploadPayload.idempotency_key) {
      await setUploadByIdempotencyKey(creator.id, uploadPayload.idempotency_key, {
        videoId: createdVideo.id,
        url: videoUrl,
        status: "processing",
      });
    }

    return withRateLimitHeaders(
      NextResponse.json(
        {
          video_id: createdVideo.id,
          url: videoUrl,
          status: "processing",
        },
        { status: 201 },
      ),
      {
        limit: HOURLY_LIMIT,
        remaining: hourlyLimit.remaining,
        resetAtUnix: hourlyLimit.resetAtUnix,
      },
    );
  } catch (error: unknown) {
    console.error("POST /api/upload failed:", error);

    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("Missing required env:")) {
      return errorResponse("Server configuration error", "INTERNAL_ERROR", 500);
    }
    if (message.includes("Cloudflare upload retry failed")) {
      return errorResponse("Cloudflare upload failed", "UPSTREAM_CLOUDFLARE_ERROR", 502);
    }

    return errorResponse("Internal server error", "INTERNAL_ERROR", 500);
  }
}
