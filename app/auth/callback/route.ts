import { NextRequest, NextResponse } from "next/server";

import { createClientForServer } from "@/lib/supabase/server";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get("code");
    const nextPath = requestUrl.searchParams.get("next");
    const redirectPath = nextPath && nextPath.startsWith("/") ? nextPath : "/";

    if (code) {
      const supabase = await createClientForServer();
      await supabase.auth.exchangeCodeForSession(code);
    }

    return NextResponse.redirect(new URL(redirectPath, request.url));
  } catch (error: unknown) {
    console.error("GET /auth/callback failed:", error);
    return NextResponse.redirect(new URL("/login", request.url));
  }
}
