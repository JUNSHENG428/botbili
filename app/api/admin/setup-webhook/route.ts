import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const adminEmail = process.env.ADMIN_EMAIL;
  const auth = request.headers.get("x-admin-key");
  if (!auth || auth !== process.env.CLOUDFLARE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !apiToken) {
    return NextResponse.json({ error: "Missing Cloudflare env vars" }, { status: 500 });
  }

  const getResp = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/webhook`,
    { headers: { Authorization: `Bearer ${apiToken}` } }
  );
  const currentConfig = await getResp.json();

  const putResp = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/webhook`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiToken}`,
      },
      body: JSON.stringify({
        notificationUrl: "https://www.botbili.com/api/webhooks/cloudflare",
      }),
    }
  );
  const result = await putResp.json();

  return NextResponse.json({
    admin: adminEmail,
    previous: currentConfig,
    updated: result,
    webhook_url: "https://www.botbili.com/api/webhooks/cloudflare",
  });
}
