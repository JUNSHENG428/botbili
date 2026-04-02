import { createHmac, timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { apiErrorResponse, withRateLimitHeaders } from "@/lib/api-response";
import { logModerationResult, moderateImage } from "@/lib/moderation";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { updateVideoStatus } from "@/lib/upload-repository";
import { dispatchWebhooks } from "@/lib/webhooks/dispatch";
import type { ApiError } from "@/types";

interface CloudflareWebhookPayload {
  uid?: string;
  readyToStream?: boolean;
  status?: { state?: string };
  duration?: number;
  thumbnail?: string;
}

function verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.CLOUDFLARE_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) {
    return false;
  }

  const pairList = signatureHeader.split(",");
  const timePart = pairList.find((item: string) => item.startsWith("time="));
  const sigPart = pairList.find((item: string) => item.startsWith("sig1="));
  if (!timePart || !sigPart) {
    return false;
  }

  const time = timePart.replace("time=", "");
  const timeSec = parseInt(time, 10);
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - timeSec) > 300) {
    return false;
  }

  const receivedSig = sigPart.replace("sig1=", "");
  const signedPayload = `${time}.${rawBody}`;
  const expectedSig = createHmac("sha256", secret).update(signedPayload, "utf8").digest("hex");

  const receivedBuffer = Buffer.from(receivedSig, "hex");
  const expectedBuffer = Buffer.from(expectedSig, "hex");
  if (receivedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(receivedBuffer, expectedBuffer);
}

export async function POST(request: Request): Promise<NextResponse<ApiError | { ok: true }>> {
  try {
    const rawBody = await request.text();
    const signatureHeader = request.headers.get("Webhook-Signature");
    if (!verifyWebhookSignature(rawBody, signatureHeader)) {
      return apiErrorResponse({
        message: "Invalid webhook signature",
        code: "AUTH_SIGNATURE_INVALID",
        status: 403,
      });
    }

    const payload = JSON.parse(rawBody) as CloudflareWebhookPayload;
    const uid = payload.uid;
    if (!uid) {
      return apiErrorResponse({
        message: "Invalid webhook payload",
        code: "VALIDATION_PAYLOAD_INVALID",
        status: 400,
      });
    }

    const state = payload.status?.state;
    if (payload.readyToStream && state === "ready") {
      // 如果 Cloudflare 自动生成了缩略图，先对其进行图像审核
      let finalStatus: "published" | "rejected" = "published";

      if (payload.thumbnail) {
        let thumbnailModerationResult;
        try {
          thumbnailModerationResult = await moderateImage(payload.thumbnail);
        } catch (err) {
          console.error("Cloudflare thumbnail moderation failed:", err);
        }

        if (thumbnailModerationResult?.flagged) {
          finalStatus = "rejected";
        }

        // 获取视频 id 以便记录日志
        if (thumbnailModerationResult) {
          const supabaseForLog = getSupabaseAdminClient();
          const { data: videoForLog } = await supabaseForLog
            .from("videos")
            .select("id")
            .eq("cloudflare_video_id", uid)
            .maybeSingle<{ id: string }>();

          if (videoForLog) {
            logModerationResult(videoForLog.id, "cloudflare_thumbnail", thumbnailModerationResult).catch(
              (err) => console.error("logModerationResult failed:", err),
            );
          }
        }
      }

      await updateVideoStatus(uid, finalStatus, {
        durationSeconds: payload.duration ? Math.round(payload.duration) : null,
        thumbnailUrl: payload.thumbnail ?? undefined,
      });

      if (finalStatus === "published") {
        const supabase = getSupabaseAdminClient();
        const { data: video } = await supabase
          .from("videos")
          .select("id, creator_id")
          .eq("cloudflare_video_id", uid)
          .maybeSingle<{ id: string; creator_id: string }>();

        if (video) {
          dispatchWebhooks(video.id, video.creator_id).catch((err) => {
            console.error("dispatchWebhooks failed:", err);
          });
        }
      }
    } else if (state === "error") {
      await updateVideoStatus(uid, "failed");
    }

    return withRateLimitHeaders(NextResponse.json({ ok: true }));
  } catch (error: unknown) {
    console.error("POST /api/webhooks/cloudflare failed:", error);
    return apiErrorResponse({
      message: "Internal server error",
      code: "INTERNAL_ERROR",
      status: 500,
    });
  }
}
