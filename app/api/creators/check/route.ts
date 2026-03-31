import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/server";

/**
 * GET /api/creators/check?name=xxx
 * 检查频道名是否可用（无需认证）。
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const name = req.nextUrl.searchParams.get("name")?.trim();

  if (!name || name.length === 0) {
    return NextResponse.json({ available: false });
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("creators")
      .select("id")
      .ilike("name", name)
      .limit(1);

    if (error) {
      console.error("check creator name error:", error);
      return NextResponse.json({ available: false }, { status: 500 });
    }

    return NextResponse.json({ available: !data || data.length === 0 });
  } catch (err) {
    console.error("check creator name unexpected error:", err);
    return NextResponse.json({ available: false }, { status: 500 });
  }
}
