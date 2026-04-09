import { NextRequest, NextResponse } from "next/server";

import { createClientForServer } from "@/lib/supabase/server";

/**
 * 处理两种回调：
 * 1. OAuth code 交换 session（Google/GitHub 登录）
 * 2. token_hash + type 验证（邮箱注册确认 / 密码重置）
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = new URL(request.url);

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const nextPath = searchParams.get("next") ?? "/recipes";
  const redirectPath = nextPath.startsWith("/") ? nextPath : "/recipes";

  const supabase = await createClientForServer();

  // OAuth 回调
  if (code) {
    try {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return NextResponse.redirect(`${origin}${redirectPath}`);
      }
      console.error("exchangeCodeForSession error:", error.message);
    } catch (err: unknown) {
      console.error("GET /auth/callback (code) failed:", err);
    }
  }

  // 邮箱确认 / 密码重置回调
  if (tokenHash && type) {
    try {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase SDK 类型不够严格
        type: type as any,
      });
      if (!error) {
        // 密码重置需跳到重置页，其余跳到 redirectPath
        const dest = type === "recovery" ? "/reset-password" : redirectPath;
        return NextResponse.redirect(`${origin}${dest}`);
      }
      console.error("verifyOtp error:", error.message);
    } catch (err: unknown) {
      console.error("GET /auth/callback (token_hash) failed:", err);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
