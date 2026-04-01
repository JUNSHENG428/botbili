import { NextResponse } from "next/server";

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const testUpload = url.searchParams.get("test_upload") === "1";

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID ?? "";
  const apiToken = process.env.CLOUDFLARE_API_TOKEN ?? "";

  const result: Record<string, unknown> = {};

  if (!accountId || !apiToken) {
    return NextResponse.json({ error: "Missing env vars" });
  }

  // Check storage usage
  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/storage-usage`,
      { headers: { Authorization: `Bearer ${apiToken}` } }
    );
    result.storage = await res.json();
  } catch (e) {
    result.storage_error = e instanceof Error ? e.message : "unknown";
  }

  // Test copy with full error details
  if (testUpload) {
    const testVideoUrl = "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";
    try {
      const res = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/copy`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiToken}`,
          },
          body: JSON.stringify({ url: testVideoUrl, meta: { name: "debug-test" } }),
        }
      );
      const raw = await res.text();
      result.copy_status = res.status;
      result.copy_headers = Object.fromEntries(res.headers.entries());
      try {
        result.copy_body = JSON.parse(raw);
      } catch {
        result.copy_body_raw = raw;
      }
    } catch (e) {
      result.copy_error = e instanceof Error ? e.message : "unknown";
    }
  }

  return NextResponse.json(result);
}
