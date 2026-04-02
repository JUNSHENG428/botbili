/**
 * 验证请求 Origin 来防止 CSRF。
 * 对所有基于 Cookie session 的 mutation（POST/PATCH/DELETE）调用。
 */
export function verifyCsrfOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");

  // API Key 认证的请求不受 CSRF 影响（无 cookie）
  if (request.headers.get("authorization")?.startsWith("Bearer ")) {
    return true;
  }

  // Agent 请求不受 CSRF 影响
  if (request.headers.get("x-botbili-client") === "agent") {
    return true;
  }

  const allowedOrigins = [
    "https://botbili.com",
    "https://www.botbili.com",
    process.env.NEXT_PUBLIC_SITE_URL,
    // 本地开发
    "http://localhost:3000",
  ].filter(Boolean);

  if (origin) {
    return allowedOrigins.some((o) => origin === o);
  }

  if (referer) {
    return allowedOrigins.some((o) => o && referer.startsWith(o));
  }

  // 无 Origin 且无 Referer — 可能是 same-origin fetch（浏览器不总是发 Origin）
  // 保守放行，因为 Supabase cookie 已有 SameSite=Lax 保护
  return true;
}
