type AnalyticsEvent =
  | { name: "recipe_list_view"; props: { sort: string; filters: Record<string, string> } }
  | { name: "recipe_detail_view"; props: { recipe_id: string; recipe_slug: string } }
  | { name: "recipe_star"; props: { recipe_id: string; starred: boolean } }
  | { name: "recipe_fork"; props: { recipe_id: string } }
  | { name: "recipe_execute_click"; props: { recipe_id: string; recipe_slug: string } }
  | { name: "recipe_execute_success"; props: { recipe_id: string; execution_id: string } }
  | { name: "recipe_execute_failed"; props: { recipe_id: string; execution_id: string; error: string } }
  | { name: "recipe_share"; props: { recipe_id: string; method: "copy_link" | "twitter" | "openclaw_cmd" } }
  | { name: "recipe_comment_submit"; props: { recipe_id: string; comment_type: string } };

const ANALYTICS_EVENT_NAMES = [
  "recipe_list_view",
  "recipe_detail_view",
  "recipe_star",
  "recipe_fork",
  "recipe_execute_click",
  "recipe_execute_success",
  "recipe_execute_failed",
  "recipe_share",
  "recipe_comment_submit",
] as const satisfies ReadonlyArray<AnalyticsEvent["name"]>;

interface AnalyticsEventRequestBody {
  event_name?: string;
  properties?: Record<string, unknown>;
  page_url?: string | null;
  referrer?: string | null;
}

const ANALYTICS_ENDPOINT = "/api/analytics/event";

export function isAnalyticsEventName(value: string): value is AnalyticsEvent["name"] {
  return (ANALYTICS_EVENT_NAMES as readonly string[]).includes(value);
}

function toRequestBody(event: AnalyticsEvent): AnalyticsEventRequestBody {
  return {
    event_name: event.name,
    properties: event.props,
    page_url: typeof window !== "undefined" ? window.location.href : null,
    referrer: typeof document !== "undefined" ? document.referrer || null : null,
  };
}

/**
 * 客户端统一埋点入口。
 * fire-and-forget，不等待返回，不影响主流程。
 */
export function track(event: AnalyticsEvent): void {
  if (typeof window === "undefined") {
    return;
  }

  const body = JSON.stringify(toRequestBody(event));

  void fetch(ANALYTICS_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body,
    keepalive: true,
  }).catch(() => {});
}

export { ANALYTICS_EVENT_NAMES };
export type { AnalyticsEvent, AnalyticsEventRequestBody };
