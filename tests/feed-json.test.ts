import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { GET } from "@/app/feed/[slug]/route";
import { resolveCreatorByIdOrSlug } from "@/lib/agent-card";
import { getPublishedVideosByCreatorId } from "@/lib/upload-repository";
import type { VideoRecord } from "@/types";

vi.mock("@/lib/agent-card", () => ({
  resolveCreatorByIdOrSlug: vi.fn(),
}));
vi.mock("@/lib/upload-repository", () => ({
  getPublishedVideosByCreatorId: vi.fn(),
}));

describe("GET /feed/[slug]", () => {
  it("每条视频返回 transcript 和 summary（允许为 null）", async () => {
    const creator = {
      id: "cr_1",
      slug: "ai-tech-daily",
      name: "AI科技日报",
      avatar_url: null,
      bio: "",
      niche: "科技",
      followers_count: 1,
      source: "agent" as const,
      is_active: true,
      created_at: "2026-03-31T10:00:00Z",
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
      comment_count: 0,
      status: "published",
      moderation_result: null,
      source: "upload",
      created_at: "2026-03-31T10:00:00Z",
      updated_at: "2026-03-31T10:00:00Z",
    };
    vi.mocked(resolveCreatorByIdOrSlug).mockResolvedValueOnce(creator);
    vi.mocked(getPublishedVideosByCreatorId).mockResolvedValueOnce([video]);

    const request = new NextRequest("http://localhost:3000/feed/ai-tech-daily.json");
    const response = await GET(request, { params: Promise.resolve({ slug: "ai-tech-daily.json" }) });
    const body = (await response.json()) as {
      feed_url: string;
      home_page_url: string;
      items: Array<{ transcript: string | null; summary: string | null }>;
    };

    expect(response.status).toBe(200);
    expect(body.items[0]?.transcript).toBeNull();
    expect(body.items[0]?.summary).toBe("摘要内容");
    expect(body.feed_url).toBe("http://localhost:3000/feed/ai-tech-daily.json");
    expect(body.home_page_url).toBe("http://localhost:3000/c/ai-tech-daily");
  });
});
