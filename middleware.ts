import { NextResponse, type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

const AUTH_ROUTES = ["/create", "/dashboard", "/settings"];
const INVITE_ROUTES = ["/create", "/dashboard"];

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { supabaseResponse, user } = await updateSession(request);

  const pathname = request.nextUrl.pathname;

  if (user && pathname === "/login") {
    return NextResponse.redirect(new URL("/feed", request.url));
  }

  const needsAuth = AUTH_ROUTES.some((route) => pathname.startsWith(route));
  if (!user && needsAuth) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const needsInvite = INVITE_ROUTES.some((route) => pathname.startsWith(route));
  if (user && needsInvite) {
    // TODO: 接入邀请码系统后，在这里校验 invite_code_usage。
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|json|md)$).*)",
  ],
};
