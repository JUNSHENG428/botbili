import crypto from "crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET, POST } from "@/app/api/wechat/webhook/route";
import { getOrCreateWechatInviteCode } from "@/lib/invite-repository";

vi.mock("@/lib/invite-repository", () => ({
  getOrCreateWechatInviteCode: vi.fn(),
}));

function signWechatRequest(timestamp: string, nonce: string): string {
  return crypto
    .createHash("sha1")
    .update(["botbili_wechat_2026", timestamp, nonce].sort().join(""))
    .digest("hex");
}

describe("wechat webhook", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.WECHAT_TOKEN = "botbili_wechat_2026";
    process.env.NEXT_PUBLIC_APP_URL = "https://botbili.com";
  });

  it("returns echostr when GET signature is valid", async () => {
    const timestamp = "1711977600";
    const nonce = "nonce123";
    const signature = signWechatRequest(timestamp, nonce);

    const response = await GET(
      new Request(
        `http://localhost:3000/api/wechat/webhook?signature=${signature}&timestamp=${timestamp}&nonce=${nonce}&echostr=hello`,
      ),
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("hello");
  });

  it("replies with a one-time invite code for BotBili keyword", async () => {
    const timestamp = "1711977600";
    const nonce = "nonce123";
    const signature = signWechatRequest(timestamp, nonce);

    vi.mocked(getOrCreateWechatInviteCode).mockResolvedValueOnce({
      invite: {
        id: "invite_1",
        code: "WX-ABC12345",
        source: "wechat_mp",
        max_uses: 1,
        used_count: 0,
        created_by: "wechat:openid_123",
        expires_at: null,
        is_active: true,
        created_at: "2026-04-01T00:00:00Z",
      },
      reused: false,
    });

    const body = `<xml>
<ToUserName><![CDATA[gh_botbili]]></ToUserName>
<FromUserName><![CDATA[openid_123]]></FromUserName>
<CreateTime>1711977600</CreateTime>
<MsgType><![CDATA[text]]></MsgType>
<Content><![CDATA[BotBili]]></Content>
</xml>`;

    const response = await POST(
      new Request(
        `http://localhost:3000/api/wechat/webhook?signature=${signature}&timestamp=${timestamp}&nonce=${nonce}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "text/xml",
          },
          body,
        },
      ),
    );

    const xml = await response.text();

    expect(response.status).toBe(200);
    expect(getOrCreateWechatInviteCode).toHaveBeenCalledWith("openid_123");
    expect(xml).toContain("WX-ABC12345");
    expect(xml).toContain("https://botbili.com/invite");
  });

  it("replies with guidance on subscribe event", async () => {
    const timestamp = "1711977600";
    const nonce = "nonce123";
    const signature = signWechatRequest(timestamp, nonce);

    const body = `<xml>
<ToUserName><![CDATA[gh_botbili]]></ToUserName>
<FromUserName><![CDATA[openid_subscriber]]></FromUserName>
<CreateTime>1711977600</CreateTime>
<MsgType><![CDATA[event]]></MsgType>
<Event><![CDATA[subscribe]]></Event>
</xml>`;

    const response = await POST(
      new Request(
        `http://localhost:3000/api/wechat/webhook?signature=${signature}&timestamp=${timestamp}&nonce=${nonce}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "text/xml",
          },
          body,
        },
      ),
    );

    const xml = await response.text();

    expect(response.status).toBe(200);
    expect(getOrCreateWechatInviteCode).not.toHaveBeenCalled();
    expect(xml).toContain("欢迎关注「老瑞的ai百宝箱」");
    expect(xml).toContain("回复 BotBili");
    expect(xml).toContain("https://botbili.com/invite");
  });
});
