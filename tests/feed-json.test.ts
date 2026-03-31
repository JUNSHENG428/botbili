import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { GET } from "@/app/feed/[slug]/route";
import { getCreatorById, getPublishedVideosByCreatorId } from "@/lib/upload-repository";
import type { Creator, VideoRecord } from "@/types";

vi.mock("@/lib/upload-repository", () => ({
  getCreatorById: vi.fn(),
  getPublishedVideosByCreatorId: vi.fn(),
}));

describe("GET /feed/[slug]", () => {
  it("每条视频返回 transcript 和 summary（允许为 null）", async () => {
    const creator: Creator = {
      id: "cr_1",
      owner_id: "usr_1",
      name: "AI科技日报",
      avatar_url: null,
      bio: "",
      niche: "科技",
      style: "",
      agent_key_hash: "hash",
      plan_type: "free",
      upload_quota: 30,
      uploads_this_month: 1,
      quota_reset_at: "2026-04-01T00:00:00Z",
      followers_count: 1,
      is_active: true,
      created_at: "2026-03-31T10:00:00Z",
      updated_at: "2026-03-31T10:00:00Z",
    };
    const video: VideoRecord = {
      id: "vid_1",
      creator_id: "cr_1",
      title: "测试视频",
      description: "",
      tags: ["AI"],
      raw_video_url: "https://example.com/raw.mp4",
      thumbnail_url: null,
      transcript: null,
      summary: "摘要内容",
      language: "zh-CN",
      cloudflare_video_id: "cf_1",
      cloudflare_playback_url: "https://customer.example.com/cf_1/manifest/video.m3u8",
      duration_seconds: 30,
      view_count: 5,
      like_count: 1,
      status: "published",
      moderation_result: null,
      source: "upload",
      created_at: "2026-03-31T10:00:00Z",
      updated_at: "2026-03-31T10:00:00Z",
    };
    vi.mocked(getCreatorById).mockResolvedValueOnce(creator);
    vi.mocked(getPublishedVideosByCreatorId).mockResolvedValueOnce([video]);

    const request = new NextRequest("http://localhost:3000/feed/cr_1.json");
    const response = await GET(request, { params: Promise.resolve({ slug: "cr_1.json" }) });
    const body = (await response.json()) as {
      items: Array<{ transcript: string | null; summary: string | null }>;
    };

    expect(response.status).toBe(200);
    expect(body.items[0]?.transcript).toBeNull();
    expect(body.items[0]?.summary).toBe("摘要内容");
  });
});
