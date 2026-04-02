import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-response";
import { extractBearerToken } from "@/lib/auth";
import { hashApiKey } from "@/lib/auth";
import { verifyApiKey } from "@/lib/upload-repository";
import { createWebhook, getWebhooksByCreatorId } from "@/lib/webhooks/repository";
import { getWebhookUrlValidationError } from "@/lib/webhook-validation";
import type { ApiError } from "@/types";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const authHeader = request.headers.get("Authorization");
    const token = extractBearerToken(authHeader);

    if (!token) {
      return apiErrorResponse({
        message: "Missing API key",
        code: "AUTH_MISSING",
        status: 401,
      });
    }

    const keyHash = hashApiKey(token);
    const creator = await verifyApiKey(keyHash);

    if (!creator) {
      return apiErrorResponse({
        message: "Invalid API key",
        code: "AUTH_INVALID_KEY",
        status: 401,
      });
    }

    const body = await request.json();
    const { target_url, events, secret } = body as {
      target_url?: string;
      events?: string[];
      secret?: string;
    };

    if (!target_url) {
      return apiErrorResponse({
        message: "target_url is required",
        code: "VALIDATION_MISSING_FIELD",
        status: 400,
      });
    }

    const urlError = getWebhookUrlValidationError(target_url);
    if (urlError) {
      return apiErrorResponse({
        message: urlError,
        code: "VALIDATION_INVALID_URL",
        status: 400,
      });
    }

    const webhook = await createWebhook(creator.id, {
      target_url,
      events: events ?? ["video.published"],
      secret,
    });

    return NextResponse.json(
      {
        webhook_id: webhook.id,
        target_url: webhook.target_url,
        events: webhook.events,
        is_active: webhook.is_active,
        created_at: webhook.created_at,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("POST /api/webhooks failed:", error);
    return apiErrorResponse({
      message: "Internal server error",
      code: "INTERNAL_ERROR",
      status: 500,
    });
  }
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const authHeader = request.headers.get("Authorization");
    const token = extractBearerToken(authHeader);

    if (!token) {
      return apiErrorResponse({
        message: "Missing API key",
        code: "AUTH_MISSING",
        status: 401,
      });
    }

    const keyHash = hashApiKey(token);
    const creator = await verifyApiKey(keyHash);

    if (!creator) {
      return apiErrorResponse({
        message: "Invalid API key",
        code: "AUTH_INVALID_KEY",
        status: 401,
      });
    }

    const webhooks = await getWebhooksByCreatorId(creator.id);

    return NextResponse.json({
      webhooks: webhooks.map((wh) => ({
        id: wh.id,
        target_url: wh.target_url,
        events: wh.events,
        is_active: wh.is_active,
        last_triggered_at: wh.last_triggered_at,
        failure_count: wh.failure_count,
        created_at: wh.created_at,
      })),
    });
  } catch (error: unknown) {
    console.error("GET /api/webhooks failed:", error);
    return apiErrorResponse({
      message: "Internal server error",
      code: "INTERNAL_ERROR",
      status: 500,
    });
  }
}
