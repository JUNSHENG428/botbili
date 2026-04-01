import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { apiErrorResponse, withRateLimitHeaders } from "@/lib/api-response";
import { generateApiKey } from "@/lib/auth";
import { isAgentRequest } from "@/lib/request-utils";
import { createAdminClient, createClientForServer } from "@/lib/supabase/server";
import { createCreator } from "@/lib/upload-repository";
import { isHttpUrl } from "@/lib/utils";
import type { ApiError, CreateCreatorRequest, CreateCreatorResponse } from "@/types";

const DAILY_AGENT_LIMIT = parseInt(process.env.DAILY_AGENT_LIMIT || "20", 10);

function getTodayUtcWindow(): { start: string; end: string } {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return {
    start: `${y}-${m}-${d}T00:00:00Z`,
    end: `${y}-${m}-${d}T23:59:59Z`,
  };
}

async function resolveAgentOwnerId(agentName: string): Promise<string> {
  const admin = createAdminClient();
  const syntheticEmail = `agent-${randomUUID()}@agents.botbili.local`;

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: syntheticEmail,
    password: randomUUID(),
    email_confirm: true,
    user_metadata: { full_name: agentName },
  });

  if (createError || !created.user) {
    throw new Error(`resolveAgentOwnerId createUser failed: ${createError?.message ?? "unknown"}`);
  }

  // 兜底：确保 profiles 行存在（触发器异常时也可写入）
  const { error: profileError } = await admin.from("profiles").upsert(
    {
      id: created.user.id,
      email: created.user.email,
      display_name: agentName,
    },
    { onConflict: "id" },
  );
  if (profileError) {
    throw new Error(`resolveAgentOwnerId upsert profile failed: ${profileError.message}`);
  }

  return created.user.id;
}

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
    const isAgent = isAgentRequest(request);

    const supabase = await createClientForServer();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

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

    let ownerId: string;

    if (isAgent) {
      const admin = createAdminClient();
      const window = getTodayUtcWindow();
      const { count, error: countError } = await admin
        .from("creators")
        .select("id", { count: "exact", head: true })
        .eq("source", "agent")
        .gte("created_at", window.start)
        .lt("created_at", window.end);

      if (countError) {
        throw new Error(`count daily agent creators failed: ${countError.message}`);
      }

      if ((count ?? 0) >= DAILY_AGENT_LIMIT) {
        return withRateLimitHeaders(
          NextResponse.json(
            {
              error: "今日 Agent 注册名额已满，请明天再试",
              code: "AGENT_DAILY_LIMIT_REACHED",
              reset_at: "明日 00:00 UTC",
              daily_limit: DAILY_AGENT_LIMIT,
            },
            { status: 429 },
          ),
        );
      }

      ownerId = await resolveAgentOwnerId(payload.name.trim());
    } else {
      if (userError || !user) {
        return apiErrorResponse({
          message: "Unauthorized",
          code: "AUTH_UNAUTHORIZED",
          status: 401,
        });
      }

      const admin = createAdminClient();
      const { data: existingInviteUsage } = await admin
        .from("invite_code_usage")
        .select("id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (existingInviteUsage) {
        ownerId = user.id;
      } else {
        const inviteCodeFromHeader = request.headers.get("x-botbili-invite");
        const inviteCode = inviteCodeFromHeader || (body as { invite_code?: string }).invite_code;
        if (!inviteCode || typeof inviteCode !== "string") {
          return apiErrorResponse({
            message: "需要邀请码。请在 /invite 页面获取。",
            code: "INVITE_REQUIRED",
            status: 403,
          });
        }

        const { data: invite, error: inviteError } = await admin
          .from("invite_codes")
          .select("id, max_uses, used_count, is_active, expires_at")
          .eq("code", inviteCode.trim().toUpperCase())
          .maybeSingle();

        if (
          inviteError ||
          !invite ||
          !invite.is_active ||
          invite.used_count >= invite.max_uses ||
          (invite.expires_at && new Date(invite.expires_at as string) < new Date())
        ) {
          return apiErrorResponse({
            message: "邀请码无效或已用完",
            code: "INVITE_INVALID",
            status: 403,
          });
        }

        const { error: redeemError } = await admin.rpc("redeem_invite_code", {
          p_code_id: invite.id,
          p_user_id: user.id,
        });
        if (redeemError) {
          return apiErrorResponse({
            message: "邀请码核销失败",
            code: "INVITE_REDEEM_FAILED",
            status: 400,
          });
        }

        ownerId = user.id;
      }
    }

    const keyPair = generateApiKey();
    const creator = await createCreator(
      ownerId,
      {
        name: payload.name.trim(),
        niche: payload.niche?.trim(),
        bio: payload.bio?.trim(),
        style: payload.style?.trim(),
        avatar_url: payload.avatar_url?.trim(),
      },
      keyPair.hash,
      isAgent ? "agent" : "human",
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
