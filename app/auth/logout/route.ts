import { NextRequest, NextResponse } from "next/server";

import { createClientForServer } from "@/lib/supabase/server";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClientForServer();
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/", request.url));
  } catch (error: unknown) {
    console.error("POST /auth/logout failed:", error);
    return NextResponse.redirect(new URL("/", request.url));
  }
}
