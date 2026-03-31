import { createHmac, timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { apiErrorResponse, withRateLimitHeaders } from "@/lib/api-response";
import { updateVideoStatus } from "@/lib/upload-repository";
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
      await updateVideoStatus(uid, "published", {
        durationSeconds: payload.duration ? Math.round(payload.duration) : null,
        thumbnailUrl: payload.thumbnail ?? undefined,
      });
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
