import { NextResponse } from "next/server";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    cloudflare_account_id: process.env.CLOUDFLARE_ACCOUNT_ID ? "SET" : "MISSING",
    cloudflare_api_token: process.env.CLOUDFLARE_API_TOKEN ? "SET" : "MISSING",
    cloudflare_customer_subdomain: process.env.CLOUDFLARE_CUSTOMER_SUBDOMAIN ? "SET" : "MISSING",
    cloudflare_webhook_secret: process.env.CLOUDFLARE_WEBHOOK_SECRET ? "SET" : "MISSING",
    wechat_token: process.env.WECHAT_TOKEN ? "SET" : "MISSING",
  });
}
