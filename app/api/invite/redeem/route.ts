import { NextResponse } from "next/server";

import { createAdminClient, createClientForServer } from "@/lib/supabase/server";

interface RedeemBody {
  code_id?: string;
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const serverClient = await createClientForServer();
    const {
      data: { user },
    } = await serverClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const { code_id } = (await request.json()) as RedeemBody;

    if (!code_id) {
      return NextResponse.json({ error: "缺少 code_id" }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: existing } = await admin
      .from("invite_code_usage")
      .select("id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ message: "已验证过" }, { status: 200 });
    }

    const { error: rpcError } = await admin.rpc("redeem_invite_code", {
      p_code_id: code_id,
      p_user_id: user.id,
    });

    if (rpcError) {
      console.error("Redeem RPC error:", rpcError);
      return NextResponse.json({ error: "核销失败，邀请码可能已失效" }, { status: 500 });
    }

    return NextResponse.json({ message: "验证成功" }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "核销失败，请重试" }, { status: 500 });
  }
}
