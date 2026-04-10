import { NextResponse } from "next/server";

import {
  deleteCredential,
  getCreatorCredentials,
  isValidPlatform,
  saveCredential,
  type Platform,
} from "@/lib/credentials";
import { createClientForServer } from "@/lib/supabase/server";
import type { ApiError } from "@/types";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/creators/[id]/credentials
 * 返回该 creator 的所有平台配置（不包含 cookie 明文）
 */
export async function GET(
  _request: Request,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const { id: creatorId } = await context.params;

    // 验证当前用户是否拥有该 creator
    const supabase = await createClientForServer();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: { code: "AUTH_REQUIRED", message: "请先登录" } },
        { status: 401 }
      );
    }

    // 验证 creator 所有权
    const { data: creator } = await supabase
      .from("creators")
      .select("owner_id")
      .eq("id", creatorId)
      .maybeSingle();

    if (!creator || creator.owner_id !== user.id) {
      return NextResponse.json(
        { error: { code: "AUTH_FORBIDDEN", message: "无权访问该创作者的凭证" } },
        { status: 403 }
      );
    }

    const credentials = await getCreatorCredentials(creatorId);

    return NextResponse.json({ success: true, data: credentials });
  } catch (error) {
    console.error("GET /api/creators/[id]/credentials failed:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "服务器内部错误" } },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/creators/[id]/credentials
 * 新增或更新某平台的 Cookie
 * Body: { platform, cookie, note?, expires_at? }
 */
export async function PUT(
  request: Request,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const { id: creatorId } = await context.params;

    // 验证当前用户是否拥有该 creator
    const supabase = await createClientForServer();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: { code: "AUTH_REQUIRED", message: "请先登录" } },
        { status: 401 }
      );
    }

    // 验证 creator 所有权
    const { data: creator } = await supabase
      .from("creators")
      .select("owner_id")
      .eq("id", creatorId)
      .maybeSingle();

    if (!creator || creator.owner_id !== user.id) {
      return NextResponse.json(
        { error: { code: "AUTH_FORBIDDEN", message: "无权访问该创作者的凭证" } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { platform, cookie, note, expires_at } = body as {
      platform: string;
      cookie: string;
      note?: string;
      expires_at?: string;
    };

    // 验证参数
    if (!platform || !cookie) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "platform 和 cookie 不能为空" } },
        { status: 400 }
      );
    }

    if (!isValidPlatform(platform)) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: `不支持的平台: ${platform}` } },
        { status: 400 }
      );
    }

    const saved = await saveCredential(
      creatorId,
      platform as Platform,
      cookie,
      note,
      expires_at
    );

    return NextResponse.json({ success: true, data: saved });
  } catch (error) {
    console.error("PUT /api/creators/[id]/credentials failed:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "服务器内部错误" } },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/creators/[id]/credentials?platform=bilibili
 * 删除某平台配置
 */
export async function DELETE(
  request: Request,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const { id: creatorId } = await context.params;
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get("platform");

    // 验证当前用户是否拥有该 creator
    const supabase = await createClientForServer();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: { code: "AUTH_REQUIRED", message: "请先登录" } },
        { status: 401 }
      );
    }

    // 验证 creator 所有权
    const { data: creator } = await supabase
      .from("creators")
      .select("owner_id")
      .eq("id", creatorId)
      .maybeSingle();

    if (!creator || creator.owner_id !== user.id) {
      return NextResponse.json(
        { error: { code: "AUTH_FORBIDDEN", message: "无权访问该创作者的凭证" } },
        { status: 403 }
      );
    }

    if (!platform || !isValidPlatform(platform)) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "无效的平台参数" } },
        { status: 400 }
      );
    }

    await deleteCredential(creatorId, platform as Platform);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/creators/[id]/credentials failed:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "服务器内部错误" } },
      { status: 500 }
    );
  }
}