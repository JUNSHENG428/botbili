import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-response";
import { extractBearerToken } from "@/lib/auth";
import { hashApiKey } from "@/lib/auth";
import { verifyApiKey } from "@/lib/upload-repository";
import { deleteWebhook, updateWebhook, getWebhookById } from "@/lib/webhooks/repository";
import type { ApiError } from "@/types";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = await params;

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

    const webhook = await getWebhookById(id);

    if (!webhook) {
      return apiErrorResponse({
        message: "Webhook not found",
        code: "WEBHOOK_NOT_FOUND",
        status: 404,
      });
    }

    if (webhook.creator_id !== creator.id) {
      return apiErrorResponse({
        message: "Not authorized to update this webhook",
        code: "AUTH_FORBIDDEN",
        status: 403,
      });
    }

    const body = await request.json();
    const { target_url, events, secret, is_active } = body as {
      target_url?: string;
      events?: string[];
      secret?: string;
      is_active?: boolean;
    };

    if (target_url) {
      try {
        new URL(target_url);
      } catch {
        return apiErrorResponse({
          message: "Invalid target_url format",
          code: "VALIDATION_INVALID_URL",
          status: 400,
        });
      }
    }

    const updated = await updateWebhook(id, {
      ...(target_url !== undefined && { target_url }),
      ...(events !== undefined && { events }),
      ...(secret !== undefined && { secret }),
      ...(is_active !== undefined && { is_active }),
    });

    return NextResponse.json({
      webhook_id: updated.id,
      target_url: updated.target_url,
      events: updated.events,
      is_active: updated.is_active,
      updated_at: new Date().toISOString(),
    });
  } catch (error: unknown) {
    console.error("PATCH /api/webhooks/[id] failed:", error);
    return apiErrorResponse({
      message: "Internal server error",
      code: "INTERNAL_ERROR",
      status: 500,
    });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = await params;

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

    const webhook = await getWebhookById(id);

    if (!webhook) {
      return apiErrorResponse({
        message: "Webhook not found",
        code: "WEBHOOK_NOT_FOUND",
        status: 404,
      });
    }

    if (webhook.creator_id !== creator.id) {
      return apiErrorResponse({
        message: "Not authorized to delete this webhook",
        code: "AUTH_FORBIDDEN",
        status: 403,
      });
    }

    await deleteWebhook(id);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("DELETE /api/webhooks/[id] failed:", error);
    return apiErrorResponse({
      message: "Internal server error",
      code: "INTERNAL_ERROR",
      status: 500,
    });
  }
}
