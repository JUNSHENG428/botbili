import { NextResponse } from "next/server";

/**
 * GET /api/admin/setup-webhook?action=check
 * POST /api/admin/setup-webhook?action=set
 * 
 * 一次性配置端点，配置完成后删除。
 * 安全：仅管理员在部署后立即调用。
 */
export async function GET(): Promise<NextResponse> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID ?? "";
  const apiToken = process.env.CLOUDFLARE_API_TOKEN ?? "";

  if (!accountId || !apiToken) {
    return NextResponse.json({ error: "Missing env" }, { status: 500 });
  }

  // 查看当前 webhook 配置
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/webhook`,
    { headers: { Authorization: `Bearer ${apiToken}` } }
  );
  return NextResponse.json(await res.json());
}

export async function POST(): Promise<NextResponse> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID ?? "";
  const apiToken = process.env.CLOUDFLARE_API_TOKEN ?? "";
  const webhookSecret = process.env.CLOUDFLARE_WEBHOOK_SECRET ?? "";

  if (!accountId || !apiToken) {
    return NextResponse.json({ error: "Missing env" }, { status: 500 });
  }

  const targetUrl = "https://www.botbili.com/api/webhooks/cloudflare";

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/webhook`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiToken}`,
      },
      body: JSON.stringify({
        notificationUrl: targetUrl,
        secret: webhookSecret || undefined,
      }),
    }
  );
  
  const result = await res.json();
  return NextResponse.json({ target: targetUrl, result });
}
