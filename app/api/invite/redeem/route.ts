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

    // 先尝试 RPC 原子核销
    const { error: rpcError } = await admin.rpc("redeem_invite_code", {
      p_code_id: code_id,
      p_user_id: user.id,
    });

    if (rpcError) {
      console.error("Redeem RPC error:", rpcError);

      // RPC 不存在时回退到手动核销
      if (rpcError.message?.includes("function") || rpcError.code === "42883") {
        console.warn("RPC redeem_invite_code not found, falling back to manual redeem");
        return await manualRedeem(admin, code_id, user.id);
      }

      return NextResponse.json(
        { error: "核销失败，邀请码可能已失效" },
        { status: 400 },
      );
    }

    return NextResponse.json({ message: "验证成功" }, { status: 200 });
  } catch (err) {
    console.error("Redeem unexpected error:", err);
    return NextResponse.json({ error: "核销失败，请重试" }, { status: 500 });
  }
}

async function manualRedeem(
  admin: ReturnType<typeof createAdminClient>,
  codeId: string,
  userId: string,
): Promise<NextResponse> {
  // 检查邀请码是否可用
  const { data: code, error: codeErr } = await admin
    .from("invite_codes")
    .select("id, max_uses, used_count, is_active, expires_at")
    .eq("id", codeId)
    .single();

  if (codeErr || !code) {
    return NextResponse.json({ error: "邀请码无效" }, { status: 400 });
  }

  if (!code.is_active || code.used_count >= code.max_uses) {
    return NextResponse.json({ error: "邀请码已用完或已停用" }, { status: 400 });
  }

  if (code.expires_at && new Date(code.expires_at as string) < new Date()) {
    return NextResponse.json({ error: "邀请码已过期" }, { status: 400 });
  }

  // 更新使用次数
  const { error: updateErr } = await admin
    .from("invite_codes")
    .update({ used_count: code.used_count + 1 })
    .eq("id", codeId);

  if (updateErr) {
    console.error("Manual redeem update error:", updateErr);
    return NextResponse.json({ error: "核销失败" }, { status: 500 });
  }

  // 插入使用记录
  const { error: insertErr } = await admin
    .from("invite_code_usage")
    .insert({ code_id: codeId, user_id: userId });

  if (insertErr) {
    console.error("Manual redeem insert error:", insertErr);
    return NextResponse.json({ error: "核销失败" }, { status: 500 });
  }

  return NextResponse.json({ message: "验证成功" }, { status: 200 });
}
