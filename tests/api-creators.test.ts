import { describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/creators/route";
import { createClientForServer } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
  createClientForServer: vi.fn(),
}));

describe("POST /api/creators", () => {
  it("rejects unauthenticated request", async () => {
    vi.mocked(createClientForServer).mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    } as unknown as Awaited<ReturnType<typeof createClientForServer>>);

    const request = new Request("http://localhost:3000/api/creators", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "AI科技日报",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
    const data = (await response.json()) as { code: string };
    expect(data.code).toBe("AUTH_UNAUTHORIZED");
  });

  it("rejects invalid name", async () => {
    vi.mocked(createClientForServer).mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user_1" } }, error: null }),
      },
    } as unknown as Awaited<ReturnType<typeof createClientForServer>>);

    const request = new Request("http://localhost:3000/api/creators", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    const data = (await response.json()) as { code: string };
    expect(data.code).toBe("VALIDATION_NAME_INVALID");
  });
});
