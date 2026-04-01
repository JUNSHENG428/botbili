import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const AUTH_ROUTES = ["/create", "/dashboard", "/settings", "/onboarding", "/admin"];
const INVITE_ROUTES = ["/create", "/dashboard", "/onboarding"];
const ADMIN_ROUTES = ["/admin"];
const ADMIN_EMAIL = "majunsheng0428@gmail.com";

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    getEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Agent API 请求不走邀请码页面拦截，交给各 API Route 自行处理。
  if (pathname.startsWith("/api/")) {
    return response;
  }

  if (user && pathname === "/login") {
    return NextResponse.redirect(new URL("/feed", request.url));
  }

  const needsAuth = AUTH_ROUTES.some((r) => pathname.startsWith(r));
  if (!user && needsAuth) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user && ADMIN_ROUTES.some((r) => pathname.startsWith(r)) && user.email !== ADMIN_EMAIL) {
    return NextResponse.redirect(new URL("/feed", request.url));
  }

  if (user && pathname !== "/invite" && INVITE_ROUTES.some((r) => pathname.startsWith(r))) {
    const { data: usage } = await supabase
      .from("invite_code_usage")
      .select("id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (!usage) {
      return NextResponse.redirect(new URL("/invite", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|json|xml|md)$).*)",
  ],
};
