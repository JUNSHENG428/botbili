import { NextRequest, NextResponse } from "next/server";

import { withRateLimitHeaders } from "@/lib/api-response";
import { extractBearerToken, hashApiKey, verifyApiKey } from "@/lib/auth";
import { createDirectUpload } from "@/lib/cloudflare";
import { consumeHourlyUploadLimit, HOURLY_LIMIT } from "@/lib/quota";
import { createVideo } from "@/lib/upload-repository";
import { buildApiErrorWithMeta } from "@/lib/utils";
import type { ApiError } from "@/types";

/**
 * POST /api/upload/direct
 *
 * 两步上传流程（解决 video_url 不支持 HEAD/Range 的问题）：
 *
 * Step 1: Agent 调用此端点，获取一次性上传 URL
 *   POST /api/upload/direct
 *   Authorization: Bearer bb_xxx
 *   Body: { "title": "...", "transcript": "...", ... }
 *   → 返回 { upload_url, video_id, uid }
 *
 * Step 2: Agent 用 upload_url 直接上传文件到 Cloudflare
 *   curl -X POST "${upload_url}" -F file=@video.mp4
 *   → 文件上传完成，Cloudflare 自动转码
 *
 * 示例：
 *   # Step 1
 *   RESP=$(curl -s -X POST https://botbili.com/api/upload/direct \
 *     -H "Authorization: Bearer bb_xxx" \
 *     -H "Content-Type: application/json" \
 *     -d '{"title":"我的视频","transcript":"...","tags":["AI"]}')
 *   UPLOAD_URL=$(echo $RESP | jq -r '.upload_url')
 *   VIDEO_ID=$(echo $RESP | jq -r '.video_id')
 *
 *   # Step 2
 *   curl -X POST "$UPLOAD_URL" -F file=@/path/to/video.mp4
 */

interface DirectUploadBody {
  title?: string;
  transcript?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  language?: string;
  thumbnail_url?: string;
  max_duration_seconds?: number;
}

function errorResponse(
  message: string,
  code: string,
  status: number,
): NextResponse<ApiError> {
  return withRateLimitHeaders(
    NextResponse.json(
      buildApiErrorWithMeta(message, code, {
        current: 0,
        limit: HOURLY_LIMIT,
        reset_at: new Date(Date.now() + 3600000).toISOString(),
        docs_url: "https://botbili.com/llms-full.txt",
      }),
      { status },
    ),
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // ── 认证 ──
    const token = extractBearerToken(request);
    if (!token) {
      return errorResponse("Missing or invalid API key", "AUTH_INVALID_KEY", 401);
    }

    const tokenHash = hashApiKey(token);
    const creator = await verifyApiKey(tokenHash);
    if (!creator) {
      return errorResponse("Invalid API key", "AUTH_INVALID_KEY", 401);
    }

    // ── 解析 body ──
    let body: DirectUploadBody;
    try {
      body = (await request.json()) as DirectUploadBody;
    } catch {
      return errorResponse("Invalid JSON body", "VALIDATION_JSON_INVALID", 400);
    }

    if (!body.title || typeof body.title !== "string" || body.title.trim().length === 0) {
      return errorResponse("title is required", "VALIDATION_TITLE_REQUIRED", 400);
    }

    if (body.title.length > 200) {
      return errorResponse("title too long (max 200)", "VALIDATION_TITLE_TOO_LONG", 400);
    }

    // ── 频率限制 ──
    const hourlyLimit = await consumeHourlyUploadLimit(tokenHash);
    if (!hourlyLimit.allowed) {
      return errorResponse(
        "Hourly upload limit reached",
        "RATE_LIMITED",
        429,
      );
    }

    // ── 创建 Cloudflare Direct Upload ──
    const maxDuration = body.max_duration_seconds ?? 600;
    const directUpload = await createDirectUpload(maxDuration);

    // ── 创建视频记录（状态 processing） ──
    const video = await createVideo(creator.id, {
      title: body.title.trim(),
      description: body.description ?? "",
      tags: body.tags ?? [],
      video_url: `cloudflare-direct://${directUpload.uid}`,
      thumbnail_url: body.thumbnail_url ?? undefined,
      transcript: body.transcript ?? undefined,
      summary: body.summary ?? undefined,
      language: body.language ?? "zh-CN",
    }, directUpload.uid, directUpload.playbackUrl);

    return withRateLimitHeaders(
      NextResponse.json(
        {
          video_id: video.id,
          uid: directUpload.uid,
          upload_url: directUpload.uploadURL,
          playback_url: directUpload.playbackUrl,
          status: "processing",
          message: "用 upload_url 上传文件：curl -X POST \"${upload_url}\" -F file=@video.mp4",
          next_step: "POST upload_url with multipart/form-data, field name: file",
        },
        { status: 201 },
      ),
    );
  } catch (error: unknown) {
    console.error("POST /api/upload/direct failed:", error);
    const message = error instanceof Error ? error.message : "";

    if (message.startsWith("Missing required env:")) {
      return errorResponse("Server configuration error", "INTERNAL_ERROR", 500);
    }

    return errorResponse("Internal server error", "INTERNAL_ERROR", 500);
  }
}
