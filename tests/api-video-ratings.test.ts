import { describe, expect, it, vi, beforeEach } from "vitest";

import { POST } from "@/app/api/videos/[id]/ratings/route";
import { extractBearerToken, hashApiKey } from "@/lib/auth";
import { createRating, getCreatorRating } from "@/lib/ratings";
import { getVideoAccessRecord, verifyApiKey } from "@/lib/upload-repository";

vi.mock("@/lib/auth", () => ({
  extractBearerToken: vi.fn(),
  hashApiKey: vi.fn(),
}));

vi.mock("@/lib/upload-repository", () => ({
  getVideoAccessRecord: vi.fn(),
  verifyApiKey: vi.fn(),
}));

vi.mock("@/lib/ratings", () => ({
  createRating: vi.fn(),
  getCreatorRating: vi.fn(),
  getVideoRatingStats: vi.fn(),
  getVideoRatings: vi.fn(),
}));

describe("POST /api/videos/[id]/ratings", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(extractBearerToken).mockReturnValue("bb_xxx");
    vi.mocked(hashApiKey).mockReturnValue("hash_xxx");
    vi.mocked(verifyApiKey).mockResolvedValue({
      id: "cr_evaluator",
    } as Awaited<ReturnType<typeof verifyApiKey>>);
    vi.mocked(getCreatorRating).mockResolvedValue(null);
  });

  it("passes video id before creator id when creating a rating", async () => {
    vi.mocked(getVideoAccessRecord).mockResolvedValue({
      id: "vid_1",
      creator_id: "cr_owner",
      status: "published",
    });
    vi.mocked(createRating).mockResolvedValue({
      id: "rating_1",
      video_id: "vid_1",
      creator_id: "cr_evaluator",
      relevance: 5,
      accuracy: 4,
      novelty: 3,
      comment: "角度不错",
      created_at: "2026-04-01T00:00:00Z",
      updated_at: "2026-04-01T00:00:00Z",
    });

    const request = new Request("http://localhost:3000/api/videos/vid_1/ratings", {
      method: "POST",
      headers: {
        Authorization: "Bearer bb_xxx",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        relevance: 5,
        accuracy: 4,
        novelty: 3,
        comment: "角度不错",
      }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ id: "vid_1" }),
    });

    expect(response.status).toBe(201);
    expect(createRating).toHaveBeenCalledWith("vid_1", "cr_evaluator", {
      relevance: 5,
      accuracy: 4,
      novelty: 3,
      comment: "角度不错",
    });
  });

  it("rejects self ratings", async () => {
    vi.mocked(getVideoAccessRecord).mockResolvedValue({
      id: "vid_1",
      creator_id: "cr_evaluator",
      status: "published",
    });

    const request = new Request("http://localhost:3000/api/videos/vid_1/ratings", {
      method: "POST",
      headers: {
        Authorization: "Bearer bb_xxx",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        relevance: 5,
        accuracy: 5,
        novelty: 5,
      }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ id: "vid_1" }),
    });
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(400);
    expect(body.code).toBe("VALIDATION_SELF_RATING");
    expect(createRating).not.toHaveBeenCalled();
  });
});
