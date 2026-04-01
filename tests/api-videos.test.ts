import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { GET } from "@/app/api/videos/route";
import { getPublishedVideos } from "@/lib/upload-repository";
import type { VideoWithCreator, VideoWithCreatorWithoutTranscript } from "@/types";

vi.mock("@/lib/upload-repository", () => ({
  getPublishedVideos: vi.fn(),
}));

describe("GET /api/videos", () => {
  it("默认不返回 transcript，但会返回 summary", async () => {
    const listItem: VideoWithCreatorWithoutTranscript = {
      id: "vid_1",
      creator_id: "cr_1",
      title: "测试视频",
      description: "",
      tags: ["AI"],
      raw_video_url: "https://example.com/raw.mp4",
      thumbnail_url: null,
      summary: "这是一段摘要",
      language: "zh-CN",
      cloudflare_video_id: "cf_1",
      cloudflare_playback_url: "https://customer.example.com/cf_1/manifest/video.m3u8",
      duration_seconds: 42,
      view_count: 10,
      like_count: 1,
      comment_count: 0,
      status: "published",
      moderation_result: null,
      source: "upload",
      created_at: "2026-03-31T10:00:00Z",
      updated_at: "2026-03-31T10:00:00Z",
      creator: {
        id: "cr_1",
        owner_id: "usr_1",
        name: "AI科技日报",
        avatar_url: null,
        niche: "科技",
        followers_count: 12,
      },
    };
    vi.mocked(getPublishedVideos).mockResolvedValueOnce({
      items: [listItem],
      total: 1,
      hasMore: false,
    });

    const request = new NextRequest("http://localhost:3000/api/videos");
    const response = await GET(request);
    const body = (await response.json()) as {
      data: Array<VideoWithCreatorWithoutTranscript & { transcript?: string | null }>;
    };

    expect(response.status).toBe(200);
    expect(body.data[0]?.summary).toBe("这是一段摘要");
    expect(body.data[0] && "transcript" in body.data[0]).toBe(false);
    expect(getPublishedVideos).toHaveBeenCalledWith(1, 12, "hot", { includeTranscript: false });
  });

  it("include=transcript 时返回 transcript", async () => {
    const listItem: VideoWithCreator = {
      id: "vid_2",
      creator_id: "cr_2",
      title: "带字幕视频",
      description: "",
      tags: ["AI"],
      raw_video_url: "https://example.com/raw2.mp4",
      thumbnail_url: null,
      transcript: "大家好，今天聊 API。",
      summary: "这是摘要",
      language: "zh-CN",
      cloudflare_video_id: "cf_2",
      cloudflare_playback_url: "https://customer.example.com/cf_2/manifest/video.m3u8",
      duration_seconds: 60,
      view_count: 20,
      like_count: 2,
      comment_count: 0,
      status: "published",
      moderation_result: null,
      source: "upload",
      created_at: "2026-03-31T10:00:00Z",
      updated_at: "2026-03-31T10:00:00Z",
      creator: {
        id: "cr_2",
        owner_id: "usr_2",
        name: "AI快讯",
        avatar_url: null,
        niche: "科技",
        followers_count: 9,
      },
    };
    vi.mocked(getPublishedVideos).mockResolvedValueOnce({
      items: [listItem],
      total: 1,
      hasMore: false,
    });

    const request = new NextRequest("http://localhost:3000/api/videos?include=transcript");
    const response = await GET(request);
    const body = (await response.json()) as { data: VideoWithCreator[] };

    expect(response.status).toBe(200);
    expect(body.data[0]?.transcript).toBe("大家好，今天聊 API。");
    expect(body.data[0]?.summary).toBe("这是摘要");
    expect(getPublishedVideos).toHaveBeenCalledWith(1, 12, "hot", { includeTranscript: true });
  });
});
