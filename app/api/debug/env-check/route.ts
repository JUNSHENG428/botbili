import { NextResponse } from "next/server";

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const testUpload = url.searchParams.get("test_upload") === "1";

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID ?? "";
  const apiToken = process.env.CLOUDFLARE_API_TOKEN ?? "";
  const subdomain = process.env.CLOUDFLARE_CUSTOMER_SUBDOMAIN ?? "";

  const result: Record<string, unknown> = {
    env: {
      cloudflare_account_id: accountId ? `SET (${accountId.slice(0, 6)}...)` : "MISSING",
      cloudflare_api_token: apiToken ? `SET (${apiToken.slice(0, 8)}...)` : "MISSING",
      cloudflare_customer_subdomain: subdomain || "MISSING",
    },
  };

  // Test Stream list
  if (accountId && apiToken) {
    try {
      const res = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream?per_page=1`,
        { headers: { Authorization: `Bearer ${apiToken}` } }
      );
      const data = await res.json() as { success?: boolean; errors?: Array<{ message?: string }> };
      result.stream_list = data.success ? "OK" : `FAIL: ${data.errors?.[0]?.message}`;
    } catch (e) {
      result.stream_list = `EXCEPTION: ${e instanceof Error ? e.message : "unknown"}`;
    }
  }

  // Test Stream copy (actual upload)
  if (testUpload && accountId && apiToken) {
    try {
      const testVideoUrl = "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";
      const res = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/copy`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiToken}`,
          },
          body: JSON.stringify({
            url: testVideoUrl,
            meta: { name: "debug-test" },
          }),
        }
      );
      const data = await res.json() as {
        success?: boolean;
        result?: { uid?: string };
        errors?: Array<{ message?: string; code?: number }>;
      };
      result.stream_copy_status = res.status;
      result.stream_copy_success = data.success;
      result.stream_copy_uid = data.result?.uid ?? null;
      result.stream_copy_errors = data.errors ?? [];
    } catch (e) {
      result.stream_copy = `EXCEPTION: ${e instanceof Error ? e.message : "unknown"}`;
    }
  }

  return NextResponse.json(result);
}
