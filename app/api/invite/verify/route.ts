import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/server";

interface VerifyBody {
  code?: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const { code } = (await req.json()) as VerifyBody;

    if (!code?.trim()) {
      return NextResponse.json({ valid: false, error: "请输入邀请码" }, { status: 400 });
    }

    const normalized = code.trim().toUpperCase();
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("invite_codes")
      .select("id, code, max_uses, used_count, is_active, expires_at")
      .eq("code", normalized)
      .single();

    if (error) {
      console.error("Invite verify query error:", error);
      if (error.code === "42P01") {
        return NextResponse.json(
          { valid: false, error: "邀请码系统未就绪，请联系管理员" },
          { status: 500 },
        );
      }
      return NextResponse.json({ valid: false, error: "邀请码无效" }, { status: 404 });
    }

    if (!data) {
      return NextResponse.json({ valid: false, error: "邀请码无效" }, { status: 404 });
    }

    if (!data.is_active) {
      return NextResponse.json({ valid: false, error: "邀请码已停用" }, { status: 403 });
    }

    if (data.used_count >= data.max_uses) {
      return NextResponse.json({ valid: false, error: "邀请码已用完" }, { status: 403 });
    }

    if (data.expires_at && new Date(data.expires_at as string) < new Date()) {
      return NextResponse.json({ valid: false, error: "邀请码已过期" }, { status: 403 });
    }

    return NextResponse.json({ valid: true, code_id: data.id });
  } catch {
    return NextResponse.json({ valid: false, error: "验证失败" }, { status: 500 });
  }
}
