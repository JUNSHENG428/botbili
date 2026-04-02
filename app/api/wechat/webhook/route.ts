import crypto from "crypto";

import { NextResponse } from "next/server";

import { getOrCreateWechatInviteCode } from "@/lib/invite-repository";
import { getBaseUrl } from "@/lib/utils";

export const runtime = "nodejs";

function getWechatToken(): string {
  const token = process.env.WECHAT_TOKEN;
  if (!token) {
    throw new Error("Missing required env: WECHAT_TOKEN");
  }
  return token;
}

function buildWechatSignature(token: string, timestamp: string, nonce: string): string {
  return crypto
    .createHash("sha1")
    .update([token, timestamp, nonce].sort().join(""))
    .digest("hex");
}

async function verifyWechatSignature(url: URL): Promise<boolean> {
  const signature = url.searchParams.get("signature");
  const timestamp = url.searchParams.get("timestamp");
  const nonce = url.searchParams.get("nonce");

  if (!signature || !timestamp || !nonce) {
    return false;
  }

  const expected = buildWechatSignature(getWechatToken(), timestamp, nonce);
  // 使用恒时比较防止 timing attack
  const { timingSafeEqual } = await import("node:crypto");
  const sigBuf = Buffer.from(signature, "utf8");
  const expBuf = Buffer.from(expected, "utf8");
  if (sigBuf.length !== expBuf.length) return false;
  return timingSafeEqual(sigBuf, expBuf);
}

function extractXmlValue(xml: string, tag: string): string | null {
  const cdataPattern = new RegExp(`<${tag}><!\\[CDATA\\[(.*?)\\]\\]><\\/${tag}>`);
  const plainPattern = new RegExp(`<${tag}>(.*?)<\\/${tag}>`);

  return xml.match(cdataPattern)?.[1] ?? xml.match(plainPattern)?.[1] ?? null;
}

function buildWechatTextReply(toUser: string, fromUser: string, content: string): string {
  return `<xml>
<ToUserName><![CDATA[${toUser}]]></ToUserName>
<FromUserName><![CDATA[${fromUser}]]></FromUserName>
<CreateTime>${Math.floor(Date.now() / 1000)}</CreateTime>
<MsgType><![CDATA[text]]></MsgType>
<Content><![CDATA[${content}]]></Content>
</xml>`;
}

function normalizeWechatKeyword(content: string): string {
  return content.trim().toLowerCase().replaceAll(/\s+/g, "");
}

function buildSubscribeReply(fromUser: string, toUser: string, baseUrl: string): string {
  return buildWechatTextReply(
    fromUser,
    toUser,
    [
      "欢迎关注「老瑞的AI百宝箱」！",
      "",
      "回复 BotBili 即可领取你的专属邀请码。",
      "",
      "小贴士：领码后请先到 botbili.com 注册登录（支持邮箱 / Google / GitHub），登录后再进入 /invite 输入邀请码就好啦~",
      "",
      "之前领过但还没用？再回复一次，系统会把上次的邀请码发给你。",
    ].join("\n"),
  );
}

function xmlResponse(xml: string): NextResponse {
  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
    },
  });
}

/**
 * GET /api/wechat/webhook
 *
 * curl 测试命令：
 * curl "http://localhost:3000/api/wechat/webhook?signature=test&timestamp=1&nonce=1&echostr=hello"
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const url = new URL(request.url);
    const echostr = url.searchParams.get("echostr") ?? "";

    if (!(await verifyWechatSignature(url))) {
      return new NextResponse("forbidden", { status: 403 });
    }

    return new NextResponse(echostr, { status: 200 });
  } catch (error: unknown) {
    console.error("GET /api/wechat/webhook failed:", error);
    return new NextResponse("error", { status: 500 });
  }
}

/**
 * POST /api/wechat/webhook
 *
 * 微信服务器推送文本消息后，回复一次性邀请码。
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const url = new URL(request.url);
    if (!(await verifyWechatSignature(url))) {
      return new NextResponse("forbidden", { status: 403 });
    }

    const body = await request.text();
    const fromUser = extractXmlValue(body, "FromUserName");
    const toUser = extractXmlValue(body, "ToUserName");
    const msgType = extractXmlValue(body, "MsgType");
    const event = extractXmlValue(body, "Event");
    const content = extractXmlValue(body, "Content");
    const baseUrl = getBaseUrl();

    if (fromUser && toUser && msgType === "event" && event?.toLowerCase() === "subscribe") {
      return xmlResponse(buildSubscribeReply(fromUser, toUser, baseUrl));
    }

    if (!fromUser || !toUser || msgType !== "text" || !content) {
      return new NextResponse("success", { status: 200 });
    }

    const normalizedContent = normalizeWechatKeyword(content);
    if (!normalizedContent.includes("botbili")) {
      return new NextResponse("success", { status: 200 });
    }

    const { invite, reused } = await getOrCreateWechatInviteCode(fromUser);
    const reply = buildWechatTextReply(
      fromUser,
      toUser,
      [
        "欢迎加入 BotBili！",
        "",
        `你的专属邀请码：${invite.code}`,
        reused ? "这是你上次还未使用的邀请码，可直接继续使用。" : "该邀请码一次性有效，仅限你本人使用。",
        "",
        "使用方式：",
        `1. 打开 ${baseUrl} → 先注册/登录（支持邮箱 / Google / GitHub）`,
        "2. 登录后进入 /invite 页面",
        "3. 输入以上邀请码即可解锁",
        "",
        "小贴士：请先登录再输入邀请码哦，否则会核销失败~",
        "",
        `使用指南：${baseUrl}/skill.md`,
      ].join("\n"),
    );

    return xmlResponse(reply);
  } catch (error: unknown) {
    console.error("POST /api/wechat/webhook failed:", error);
    return new NextResponse("success", { status: 200 });
  }
}
