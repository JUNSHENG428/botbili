import { NextResponse } from "next/server";

import { createAdminClient, createClientForServer } from "@/lib/supabase/server";
import { isAnalyticsEventName, type AnalyticsEventRequestBody } from "@/lib/analytics";

const SESSION_COOKIE_NAME = "botbili_session_id";
const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * 最近 7 天执行漏斗示例 SQL（Supabase Dashboard 可直接执行）：
 *
 * SELECT
 *   date_trunc('day', created_at) AS day,
 *   count(*) FILTER (WHERE event_name = 'recipe_list_view') AS recipe_list_views,
 *   count(*) FILTER (WHERE event_name = 'recipe_detail_view') AS recipe_detail_views,
 *   count(*) FILTER (WHERE event_name = 'recipe_execute_click') AS execute_clicks,
 *   count(*) FILTER (WHERE event_name = 'recipe_execute_success') AS execute_successes
 * FROM public.analytics_events
 * WHERE created_at >= now() - interval '7 days'
 * GROUP BY 1
 * ORDER BY 1 DESC;
 */
export async function POST(request: Request): Promise<NextResponse> {
  let body: AnalyticsEventRequestBody = {};

  try {
    body = (await request.json()) as AnalyticsEventRequestBody;
  } catch {
    body = {};
  }

  const existingSessionId = request.headers
    .get("cookie")
    ?.split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${SESSION_COOKIE_NAME}=`))
    ?.split("=")[1];

  const sessionId = existingSessionId || crypto.randomUUID();

  try {
    const supabase = await createClientForServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const admin = createAdminClient();

    await admin.from("analytics_events").insert({
      event_name:
        typeof body.event_name === "string" && isAnalyticsEventName(body.event_name)
          ? body.event_name
          : "recipe_list_view",
      user_id: user?.id ?? null,
      session_id: sessionId,
      properties:
        body.properties && typeof body.properties === "object" && !Array.isArray(body.properties)
          ? body.properties
          : {},
      page_url: typeof body.page_url === "string" ? body.page_url : null,
      referrer: typeof body.referrer === "string" ? body.referrer : request.headers.get("referer"),
    });
  } catch {
    // 埋点失败静默，不影响前端交互
  }

  const response = NextResponse.json({ ok: true });

  if (!existingSessionId) {
    response.cookies.set(SESSION_COOKIE_NAME, sessionId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_COOKIE_MAX_AGE,
    });
  }

  return response;
}
