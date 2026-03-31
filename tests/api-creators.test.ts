import { describe, expect, it } from "vitest";

import { POST } from "@/app/api/creators/route";

describe("POST /api/creators", () => {
  it("rejects invalid email", async () => {
    const request = new Request("http://localhost:3000/api/creators", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "invalid-email",
        name: "AI科技日报",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    const data = (await response.json()) as { code: string };
    expect(data.code).toBe("VALIDATION_EMAIL_INVALID");
  });
});
