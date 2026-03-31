import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/videos/[id]/interactions/route";
import * as interactionsLib from "@/lib/video-interactions";

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

  it("returns 500 when DB write fails", async () => {
    vi.spyOn(interactionsLib, "createVideoInteraction").mockRejectedValueOnce(
      new Error("db down"),
    );

    const request = new Request("http://localhost:3000/api/videos/vid_1/interactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        viewer_type: "human",
        action: "like",
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: "vid_1" }) });
    expect(response.status).toBe(500);
    const data = (await response.json()) as { code: string; message?: string };
    expect(data.code).toBe("INTERNAL_ERROR");
    expect(data.message).toBe("Internal server error");
  });

  it("auto-detects ai viewer_type by header", async () => {
    const spy = vi
      .spyOn(interactionsLib, "createVideoInteraction")
      .mockResolvedValueOnce({
        id: "int_1",
        video_id: "vid_1",
        viewer_type: "ai",
        action: "view",
        content: null,
        viewer_label: "HeaderAgent",
        created_at: new Date().toISOString(),
      });

    const request = new Request("http://localhost:3000/api/videos/vid_1/interactions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-botbili-viewer-type": "ai",
      },
      body: JSON.stringify({
        action: "view",
        viewer_label: "HeaderAgent",
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: "vid_1" }) });
    expect(response.status).toBe(201);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        viewerType: "ai",
        action: "view",
      }),
    );
  });

  it("auto-detects ai viewer_type by bearer token", async () => {
    const spy = vi
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
        viewer_label: "TokenAgent",
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: "vid_1" }) });
    expect(response.status).toBe(201);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        viewerType: "ai",
        action: "like",
      }),
    );
  });

  it("fills viewer_label from agent name header when inferred as ai", async () => {
    const spy = vi
      .spyOn(interactionsLib, "createVideoInteraction")
      .mockResolvedValueOnce({
        id: "int_3",
        video_id: "vid_1",
        viewer_type: "ai",
        action: "view",
        content: null,
        viewer_label: "OpenClaw",
        created_at: new Date().toISOString(),
      });

    const request = new Request("http://localhost:3000/api/videos/vid_1/interactions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-botbili-viewer-type": "ai",
        "x-botbili-agent-name": "OpenClaw",
      },
      body: JSON.stringify({
        action: "view",
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: "vid_1" }) });
    expect(response.status).toBe(201);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        viewerType: "ai",
        viewerLabel: "OpenClaw",
      }),
    );
  });

  it("fills viewer_label as AI Viewer when inferred as ai without name", async () => {
    const spy = vi
      .spyOn(interactionsLib, "createVideoInteraction")
      .mockResolvedValueOnce({
        id: "int_4",
        video_id: "vid_1",
        viewer_type: "ai",
        action: "view",
        content: null,
        viewer_label: "AI Viewer",
        created_at: new Date().toISOString(),
      });

    const request = new Request("http://localhost:3000/api/videos/vid_1/interactions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer bb_test_agent_key",
      },
      body: JSON.stringify({
        action: "view",
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: "vid_1" }) });
    expect(response.status).toBe(201);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        viewerType: "ai",
        viewerLabel: "AI Viewer",
      }),
    );
  });

  it("truncates x-botbili-agent-name to 60 chars", async () => {
    const longName = "A".repeat(100);
    const spy = vi
      .spyOn(interactionsLib, "createVideoInteraction")
      .mockResolvedValueOnce({
        id: "int_5",
        video_id: "vid_1",
        viewer_type: "ai",
        action: "view",
        content: null,
        viewer_label: "A".repeat(60),
        created_at: new Date().toISOString(),
      });

    const request = new Request("http://localhost:3000/api/videos/vid_1/interactions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-botbili-viewer-type": "ai",
        "x-botbili-agent-name": longName,
      },
      body: JSON.stringify({
        action: "view",
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: "vid_1" }) });
    expect(response.status).toBe(201);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        viewerType: "ai",
        viewerLabel: "A".repeat(60),
      }),
    );
  });
});
