import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-response";
import { generateApiKey } from "@/lib/auth";
import { createClientForServer, getSupabaseAdminClient } from "@/lib/supabase/server";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/creators/[id]/regenerate-key
 *
 * 重新生成 API Key。旧 Key 立即失效，新 Key 仅返回一次。
 * 仅频道 owner 可操作。
 */
export async function POST(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const { id } = await context.params;

    // 验证登录用户
    const supabase = await createClientForServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return apiErrorResponse({
        message: "Unauthorized",
        code: "AUTH_UNAUTHORIZED",
        status: 401,
      });
    }

    // 验证所有权
    const admin = getSupabaseAdminClient();
    const { data: creator } = await admin
      .from("creators")
      .select("id, owner_id, name")
      .eq("id", id)
      .maybeSingle();

    if (!creator) {
      return apiErrorResponse({
        message: "Not found",
        code: "RESOURCE_NOT_FOUND",
        status: 404,
      });
    }
    if (creator.owner_id !== user.id) {
      return apiErrorResponse({
        message: "Forbidden",
        code: "AUTH_FORBIDDEN",
        status: 403,
      });
    }

    // 生成新 Key，覆盖旧 hash
    const keyPair = generateApiKey();
    const { error } = await admin
      .from("creators")
      .update({ agent_key_hash: keyPair.hash })
      .eq("id", id);

    if (error) {
      return apiErrorResponse({
        message: error.message,
        code: "INTERNAL_ERROR",
        status: 500,
      });
    }

    return NextResponse.json({
      api_key: keyPair.plain,
      channel_name: creator.name,
      message:
        "新 API Key 已生成，旧 Key 立即失效。请立即保存，关闭后无法再次查看。",
    });
  } catch (error: unknown) {
    console.error("POST /api/creators/[id]/regenerate-key failed:", error);
    return apiErrorResponse({
      message: "Internal server error",
      code: "INTERNAL_ERROR",
      status: 500,
    });
  }
}
