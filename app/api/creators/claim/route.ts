import { NextResponse } from "next/server";

import { hashApiKey } from "@/lib/auth";
import { createClientForServer, getSupabaseAdminClient } from "@/lib/supabase/server";

/**
 * POST /api/creators/claim
 *
 * 人类用户通过输入 Agent 频道的 API Key 认领该频道为自己监护。
 *
 * Body: { api_key: "bb_xxx" }
 *
 * 规则：
 * - Key 必须对应一个 source=agent 的频道
 * - 该频道的 guardian_id 必须为空（待认领）
 * - 认领后 guardian_id 设为当前用户
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    // 1. 验证登录
    const userSupabase = await createClientForServer();
    const {
      data: { user },
    } = await userSupabase.auth.getUser();

    if (!user?.id) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    // 2. 读取 body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "请求格式不正确" }, { status: 400 });
    }

    const { api_key } = (body ?? {}) as { api_key?: string };
    if (!api_key || typeof api_key !== "string" || !api_key.startsWith("bb_")) {
      return NextResponse.json(
        { error: "请输入有效的 API Key（以 bb_ 开头）" },
        { status: 400 },
      );
    }

    // 3. 哈希 Key 并查找频道
    const keyHash = hashApiKey(api_key.trim());
    const supabase = getSupabaseAdminClient();

    const { data: creator, error: findErr } = await supabase
      .from("creators")
      .select("id, name, source, guardian_id, owner_id, is_active")
      .eq("agent_key_hash", keyHash)
      .maybeSingle();

    if (findErr || !creator) {
      return NextResponse.json(
        { error: "API Key 无效或频道不存在" },
        { status: 404 },
      );
    }

    // 4. 检查是否可认领
    if (creator.source !== "agent") {
      return NextResponse.json(
        { error: "这是人类创建的频道，不需要认领" },
        { status: 400 },
      );
    }

    if (creator.guardian_id) {
      if (creator.guardian_id === user.id) {
        return NextResponse.json(
          { error: "你已经是这个频道的监护人了" },
          { status: 400 },
        );
      }
      return NextResponse.json(
        { error: "该频道已被其他用户认领" },
        { status: 409 },
      );
    }

    // 5. 绑定监护人
    const { error: updateErr } = await supabase
      .from("creators")
      .update({ guardian_id: user.id })
      .eq("id", creator.id);

    if (updateErr) {
      console.error("claim creator update failed:", updateErr);
      return NextResponse.json(
        { error: "认领失败，请重试" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      creator_id: creator.id,
      creator_name: creator.name,
      message: `你已成为「${creator.name}」的监护人`,
    });
  } catch (err) {
    console.error("POST /api/creators/claim failed:", err);
    return NextResponse.json(
      { error: "服务暂时不可用" },
      { status: 500 },
    );
  }
}
