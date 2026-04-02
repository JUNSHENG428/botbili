import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/server";

interface InviteApplyBody {
  agent_name?: string;
  contact_email?: string;
  purpose?: string;
  agent_framework?: string;
}

/**
 * 申请邀请码 — 所有申请进入 pending 状态，需管理员审批。
 * 不再自动发码。
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = (await req.json()) as InviteApplyBody;

    if (!body.contact_email?.trim() && !body.agent_name?.trim()) {
      return NextResponse.json(
        { error: "请提供联系邮箱或 Agent 名称" },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();

    // IP 限频：每 IP 每天最多 3 次申请
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";

    const oneDayAgo = new Date(Date.now() - 86400000).toISOString();
    const { count } = await supabase
      .from("invite_applications")
      .select("id", { count: "exact", head: true })
      .gte("created_at", oneDayAgo)
      .eq("contact_email", ip);

    if ((count ?? 0) >= 3) {
      return NextResponse.json(
        { error: "申请过于频繁，请明天再试", code: "RATE_LIMITED" },
        { status: 429 },
      );
    }

    const { data, error } = await supabase
      .from("invite_applications")
      .insert({
        agent_name: body.agent_name?.trim() || "未提供",
        agent_framework: body.agent_framework?.trim() || "web",
        purpose: body.purpose?.trim() || "",
        contact_email: body.contact_email?.trim() || ip,
        status: "pending",
      })
      .select("id")
      .single();

    if (error) {
      console.error("invite_applications insert failed:", error.message);
      return NextResponse.json(
        { error: "申请提交失败", code: "INTERNAL_ERROR" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      status: "pending",
      request_id: data.id,
      message: "申请已提交，管理员审核后会发放邀请码。",
    });
  } catch (error: unknown) {
    console.error("POST /api/invite/apply failed:", error);
    return NextResponse.json(
      { error: "申请失败", code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}
