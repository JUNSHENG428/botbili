import { NextResponse } from "next/server";

export async function GET(): Promise<NextResponse> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID ?? "";
  const apiToken = process.env.CLOUDFLARE_API_TOKEN ?? "";
  const subdomain = process.env.CLOUDFLARE_CUSTOMER_SUBDOMAIN ?? "";

  // Test Cloudflare Stream API connectivity
  let streamStatus = "NOT_TESTED";
  let streamError = "";

  if (accountId && apiToken) {
    try {
      const res = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream?per_page=1`,
        {
          headers: { Authorization: `Bearer ${apiToken}` },
        }
      );
      const data = await res.json() as { success?: boolean; errors?: Array<{ message?: string }> };
      if (data.success) {
        streamStatus = "OK";
      } else {
        streamStatus = `FAIL_${res.status}`;
        streamError = data.errors?.[0]?.message ?? "unknown";
      }
    } catch (e) {
      streamStatus = "EXCEPTION";
      streamError = e instanceof Error ? e.message : "unknown";
    }
  }

  return NextResponse.json({
    env: {
      cloudflare_account_id: accountId ? `SET (${accountId.slice(0, 6)}...)` : "MISSING",
      cloudflare_api_token: apiToken ? `SET (${apiToken.slice(0, 8)}...)` : "MISSING",
      cloudflare_customer_subdomain: subdomain || "MISSING",
    },
    stream_api_test: streamStatus,
    stream_error: streamError || undefined,
  });
}
