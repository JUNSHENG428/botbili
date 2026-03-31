import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { POST } from "@/app/api/upload/route";

describe("POST /api/upload", () => {
  it("returns 401 without authorization header", async () => {
    const nativeRequest = new Request("http://localhost:3000/api/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "测试视频",
        video_url: "https://example.com/a.mp4",
      }),
    });
    const request = new NextRequest(nativeRequest);

    const response = await POST(request);
    expect(response.status).toBe(401);
    const data = (await response.json()) as { code: string };
    expect(data.code).toBe("AUTH_INVALID_KEY");
  });
});
