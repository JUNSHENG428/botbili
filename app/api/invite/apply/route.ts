import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/server";

interface InviteApplyBody {
  agent_name?: string;
  contact_email?: string;
  purpose?: string;
  agent_framework?: string;
}

function generateInviteCode(prefix: "AGENT" | "BETA"): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

/**
 * 申请邀请码（MVP 简化版）
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = (await req.json()) as InviteApplyBody;
    const supabase = createAdminClient();

    const framework = body.agent_framework?.toLowerCase() ?? "web";
    const autoApprove = ["openclaw", "n8n", "langchain", "coze"].includes(framework);

    if (autoApprove) {
      const code = generateInviteCode("AGENT");
      await supabase.from("invite_codes").insert({
        code,
        source: body.agent_framework || "auto",
        max_uses: 1,
        created_by: "system",
      });
      return NextResponse.json({ status: "approved", code });
    }

    const { data, error } = await supabase
      .from("invite_applications")
      .insert({
        agent_name: body.agent_name || "未提供",
        agent_framework: body.agent_framework || "web",
        purpose: body.purpose || "",
        contact_email: body.contact_email || "",
        status: "pending",
      })
      .select("id")
      .single();

    if (error) {
      const code = generateInviteCode("BETA");
      await supabase.from("invite_codes").insert({
        code,
        source: "web_apply",
        max_uses: 1,
        created_by: "system",
      });
      return NextResponse.json({ status: "approved", code });
    }

    return NextResponse.json({ status: "pending", request_id: data.id });
  } catch (error: unknown) {
    console.error("POST /api/invite/apply failed:", error);
    return NextResponse.json({ error: "申请失败", code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
