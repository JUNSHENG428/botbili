import { randomBytes } from "crypto";

import { NextResponse } from "next/server";

import { createAdminClient, createClientForServer } from "@/lib/supabase/server";

const ADMIN_EMAIL = "majunsheng0428@gmail.com";

interface GenerateBody {
  count?: number;
  source?: string;
  max_uses?: number;
  prefix?: string;
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const serverClient = await createClientForServer();
    const {
      data: { user },
    } = await serverClient.auth.getUser();

    if (user?.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }

    const body = (await request.json()) as GenerateBody;
    const count = Math.min(body.count ?? 5, 50);
    const source = body.source ?? "manual";
    const maxUses = body.max_uses ?? 1;
    const prefix = body.prefix ?? "SEED";

    const codes = Array.from({ length: count }, () => {
      const rand = randomBytes(3).toString("hex").toUpperCase();
      return `${prefix}-${rand}`;
    });

    const rows = codes.map((code) => ({
      code,
      source,
      max_uses: maxUses,
      created_by: ADMIN_EMAIL,
    }));

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("invite_codes")
      .insert(rows)
      .select("code, max_uses");

    if (error) {
      console.error("Generate invite codes error:", error);
      return NextResponse.json({ error: "生成失败" }, { status: 500 });
    }

    return NextResponse.json({ codes: data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "生成失败" }, { status: 500 });
  }
}
