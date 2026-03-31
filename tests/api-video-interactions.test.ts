import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/videos/[id]/interactions/route";
import * as authLib from "@/lib/auth";
import { createClientForServer } from "@/lib/supabase/server";
import * as interactionsLib from "@/lib/video-interactions";

vi.mock("@/lib/supabase/server", () => ({
  createClientForServer: vi.fn(),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/videos/[id]/interactions", () => {
  it("rejects invalid viewer_type", async () => {
    const request = new Request("http://localhost:3000/api/videos/vid_1/interactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        viewer_type: "robot",
        action: "like",
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: "vid_1" }) });
    expect(response.status).toBe(400);
    const data = (await response.json()) as { code: string };
    expect(data.code).toBe("VALIDATION_VIEWER_TYPE_INVALID");
  });

  it("rejects invalid action", async () => {
    const request = new Request("http://localhost:3000/api/videos/vid_1/interactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        viewer_type: "human",
        action: "bookmark",
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: "vid_1" }) });
    expect(response.status).toBe(400);
    const data = (await response.json()) as { code: string };
    expect(data.code).toBe("VALIDATION_ACTION_INVALID");
  });

  it("rejects too long comment", async () => {
    const request = new Request("http://localhost:3000/api/videos/vid_1/interactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        viewer_type: "ai",
        action: "comment",
        content: "x".repeat(501),
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: "vid_1" }) });
    expect(response.status).toBe(400);
    const data = (await response.json()) as { code: string };
    expect(data.code).toBe("VALIDATION_COMMENT_TOO_LONG");
  });

  it("returns 401 for unauthenticated human request", async () => {
    vi.mocked(createClientForServer).mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    } as unknown as Awaited<ReturnType<typeof createClientForServer>>);

    const request = new Request("http://localhost:3000/api/videos/vid_1/interactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "like",
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: "vid_1" }) });
    expect(response.status).toBe(401);
    const data = (await response.json()) as { code: string };
    expect(data.code).toBe("AUTH_UNAUTHORIZED");
  });

  it("accepts AI interaction with valid bearer token", async () => {
    vi.spyOn(authLib, "verifyApiKey").mockResolvedValueOnce({
      id: "creator_1",
      owner_id: "user_1",
      name: "TokenAgent",
      avatar_url: null,
      bio: "",
      niche: "",
      style: "",
      agent_key_hash: "hash",
      plan_type: "free",
      upload_quota: 30,
      uploads_this_month: 0,
      quota_reset_at: "2026-04-01T00:00:00Z",
      followers_count: 0,
      is_active: true,
      created_at: "2026-03-31T10:00:00Z",
      updated_at: "2026-03-31T10:00:00Z",
    });
    const createSpy = vi
      .spyOn(interactionsLib, "createVideoInteraction")
      .mockResolvedValueOnce({
        id: "int_2",
        video_id: "vid_1",
        viewer_type: "ai",
        action: "like",
        content: null,
        viewer_label: "TokenAgent",
        created_at: new Date().toISOString(),
      });

    const request = new Request("http://localhost:3000/api/videos/vid_1/interactions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer bb_test_agent_key",
      },
      body: JSON.stringify({
        action: "like",
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: "vid_1" }) });
    expect(response.status).toBe(201);
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        viewerType: "ai",
        viewerLabel: "TokenAgent",
      }),
    );
  });

  it("returns 401 when bearer API key is invalid", async () => {
    vi.spyOn(authLib, "verifyApiKey").mockResolvedValueOnce(null);

    const request = new Request("http://localhost:3000/api/videos/vid_1/interactions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer bb_invalid",
      },
      body: JSON.stringify({
        action: "view",
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: "vid_1" }) });
    expect(response.status).toBe(401);
    const data = (await response.json()) as { code: string };
    expect(data.code).toBe("AUTH_INVALID_KEY");
  });

  it("supports authenticated human interaction", async () => {
    vi.mocked(createClientForServer).mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user_1", email: "human@example.com", user_metadata: {} } },
          error: null,
        }),
      },
    } as unknown as Awaited<ReturnType<typeof createClientForServer>>);
    const createSpy = vi
      .spyOn(interactionsLib, "createVideoInteraction")
      .mockResolvedValueOnce({
        id: "int_9",
        video_id: "vid_1",
        viewer_type: "human",
        action: "comment",
        content: "人类评论",
        viewer_label: null,
        created_at: new Date().toISOString(),
      });

    const request = new Request("http://localhost:3000/api/videos/vid_1/interactions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "comment",
        content: "人类评论",
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: "vid_1" }) });
    expect(response.status).toBe(201);
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        viewerType: "human",
        action: "comment",
      }),
    );
  });

  it("returns 500 when DB write fails", async () => {
    vi.spyOn(authLib, "verifyApiKey").mockResolvedValueOnce({
      id: "creator_1",
      owner_id: "user_1",
      name: "TokenAgent",
      avatar_url: null,
      bio: "",
      niche: "",
      style: "",
      agent_key_hash: "hash",
      plan_type: "free",
      upload_quota: 30,
      uploads_this_month: 0,
      quota_reset_at: "2026-04-01T00:00:00Z",
      followers_count: 0,
      is_active: true,
      created_at: "2026-03-31T10:00:00Z",
      updated_at: "2026-03-31T10:00:00Z",
    });
    vi.spyOn(interactionsLib, "createVideoInteraction").mockRejectedValueOnce(new Error("db down"));

    const request = new Request("http://localhost:3000/api/videos/vid_1/interactions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer bb_test_agent_key",
      },
      body: JSON.stringify({
        action: "like",
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: "vid_1" }) });
    expect(response.status).toBe(500);
    const data = (await response.json()) as { code: string; message?: string };
    expect(data.code).toBe("INTERNAL_ERROR");
    expect(data.message).toBe("Internal server error");
  });
});
