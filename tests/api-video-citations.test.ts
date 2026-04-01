import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/videos/[id]/citations/route";
import { extractBearerToken, hashApiKey } from "@/lib/auth";
import { createCitations } from "@/lib/citations";
import {
  creatorOwnsVideo,
  getPublishedVideoIds,
  verifyApiKey,
} from "@/lib/upload-repository";

vi.mock("@/lib/auth", () => ({
  extractBearerToken: vi.fn(),
  hashApiKey: vi.fn(),
}));

vi.mock("@/lib/upload-repository", () => ({
  creatorOwnsVideo: vi.fn(),
  getPublishedVideoIds: vi.fn(),
  verifyApiKey: vi.fn(),
}));

vi.mock("@/lib/citations", () => ({
  createCitations: vi.fn(),
  getVideoCitedBy: vi.fn(),
  getVideoReferences: vi.fn(),
}));

describe("POST /api/videos/[id]/citations", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(extractBearerToken).mockReturnValue("bb_xxx");
    vi.mocked(hashApiKey).mockReturnValue("hash_xxx");
    vi.mocked(verifyApiKey).mockResolvedValue({
      id: "cr_requester",
    } as Awaited<ReturnType<typeof verifyApiKey>>);
  });

  it("rejects attempts to manage citations for someone else's video", async () => {
    vi.mocked(creatorOwnsVideo).mockResolvedValue(false);

    const request = new Request("http://localhost:3000/api/videos/vid_1/citations", {
      method: "POST",
      headers: {
        Authorization: "Bearer bb_xxx",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        citations: [{ video_id: "vid_2" }],
      }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ id: "vid_1" }),
    });
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(403);
    expect(body.code).toBe("VIDEO_FORBIDDEN");
    expect(createCitations).not.toHaveBeenCalled();
  });

  it("rejects unpublished citation targets before writing", async () => {
    vi.mocked(creatorOwnsVideo).mockResolvedValue(true);
    vi.mocked(getPublishedVideoIds).mockResolvedValue(["vid_2"]);

    const request = new Request("http://localhost:3000/api/videos/vid_1/citations", {
      method: "POST",
      headers: {
        Authorization: "Bearer bb_xxx",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        citations: [{ video_id: "vid_2" }, { video_id: "vid_3" }],
      }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ id: "vid_1" }),
    });
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(400);
    expect(body.code).toBe("CITATION_TARGET_INVALID");
    expect(createCitations).not.toHaveBeenCalled();
  });
});
