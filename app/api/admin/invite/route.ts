import { NextResponse } from "next/server";

import { createAdminClient, createClientForServer } from "@/lib/supabase/server";

const ADMIN_EMAIL = "majunsheng0428@gmail.com";

export async function GET(): Promise<NextResponse> {
  try {
    const serverClient = await createClientForServer();
    const {
      data: { user },
    } = await serverClient.auth.getUser();

    if (user?.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }

    const admin = createAdminClient();

    const { data: codes, error: codesErr } = await admin
      .from("invite_codes")
      .select("id, code, source, max_uses, used_count, is_active, created_at, expires_at")
      .order("created_at", { ascending: false });

    if (codesErr) {
      return NextResponse.json({ error: "查询失败" }, { status: 500 });
    }

    const { data: usages, error: usageErr } = await admin
      .from("invite_code_usage")
      .select("code_id, user_id, used_at")
      .order("used_at", { ascending: false });

    if (usageErr) {
      return NextResponse.json({ error: "查询使用记录失败" }, { status: 500 });
    }

    const userIds = [...new Set((usages ?? []).map((u) => u.user_id))];
    let profileMap: Record<string, string> = {};

    if (userIds.length > 0) {
      const { data: profiles } = await admin
        .from("profiles")
        .select("id, email")
        .in("id", userIds);

      if (profiles) {
        profileMap = Object.fromEntries(
          profiles.map((p) => [p.id, p.email ?? "未知"]),
        );
      }
    }

    const usagesWithEmail = (usages ?? []).map((u) => ({
      ...u,
      email: profileMap[u.user_id] ?? "未知",
    }));

    return NextResponse.json({ codes: codes ?? [], usages: usagesWithEmail });
  } catch {
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
