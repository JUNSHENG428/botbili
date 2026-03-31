import { NextRequest, NextResponse } from "next/server";

import { createClientForServer } from "@/lib/supabase/server";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextPath = searchParams.get("next") ?? "/feed";
  const redirectPath = nextPath.startsWith("/") ? nextPath : "/feed";

  if (code) {
    try {
      const supabase = await createClientForServer();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return NextResponse.redirect(`${origin}${redirectPath}`);
      }
    } catch (error: unknown) {
      console.error("GET /auth/callback failed:", error);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
