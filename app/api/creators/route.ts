import { NextResponse } from "next/server";

import { apiErrorResponse, withRateLimitHeaders } from "@/lib/api-response";
import { generateApiKey } from "@/lib/auth";
import { isAgentRequest } from "@/lib/request-utils";
import { createClientForServer } from "@/lib/supabase/server";
import { createCreator } from "@/lib/upload-repository";
import { isHttpUrl } from "@/lib/utils";
import type { ApiError, CreateCreatorRequest, CreateCreatorResponse } from "@/types";

/**
 * POST /api/creators
 *
 * 双路径：
 *   Agent（curl / OpenClaw）→ 返回含 api_key 的完整信息
 *   人类（网页）→ 返回 creator_id + channel_url，不暴露 api_key
 *
 * curl -X POST http://localhost:3000/api/creators \
 *   -H "Content-Type: application/json" \
 *   -H "X-BotBili-Client: agent" \
 *   -d '{"name":"AI科技日报","niche":"科技"}'
 */
export async function POST(
  request: Request,
): Promise<NextResponse<ApiError | CreateCreatorResponse>> {
  try {
    const supabase = await createClientForServer();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return apiErrorResponse({
        message: "Unauthorized",
        code: "AUTH_UNAUTHORIZED",
        status: 401,
      });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiErrorResponse({
        message: "Invalid JSON body",
        code: "VALIDATION_JSON_INVALID",
        status: 400,
      });
    }

    if (!body || typeof body !== "object") {
      return apiErrorResponse({
        message: "Invalid request body",
        code: "VALIDATION_REQUEST_BODY_INVALID",
        status: 400,
      });
    }

    const payload = body as Partial<CreateCreatorRequest>;
    if (typeof payload.name !== "string" || payload.name.trim().length === 0) {
      return apiErrorResponse({
        message: "Invalid name",
        code: "VALIDATION_NAME_INVALID",
        status: 400,
      });
    }
    if (payload.avatar_url && !isHttpUrl(payload.avatar_url)) {
      return apiErrorResponse({
        message: "Invalid avatar_url",
        code: "VALIDATION_AVATAR_URL_INVALID",
        status: 400,
      });
    }

    const keyPair = generateApiKey();
    const creator = await createCreator(
      user.id,
      {
        name: payload.name.trim(),
        niche: payload.niche?.trim(),
        bio: payload.bio?.trim(),
        style: payload.style?.trim(),
        avatar_url: payload.avatar_url?.trim(),
      },
      keyPair.hash,
    );

    const channelUrl = `/c/${creator.id}`;

    return withRateLimitHeaders(
      NextResponse.json(
        {
          creator_id: creator.id,
          name: creator.name,
          api_key: keyPair.plain,
          channel_url: channelUrl,
          message: "API Key 仅此一次，请立即保存",
        },
        { status: 201 },
      ),
    );
  } catch (error: unknown) {
    console.error("POST /api/creators failed:", error);
    const message = error instanceof Error ? error.message : "";
    if (message.includes("duplicate key value")) {
      return apiErrorResponse({
        message: "Creator name already exists",
        code: "RESOURCE_CONFLICT",
        status: 409,
      });
    }
    return apiErrorResponse({
      message: "Internal server error",
      code: "INTERNAL_ERROR",
      status: 500,
    });
  }
}
