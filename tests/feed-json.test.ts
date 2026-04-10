import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { GET } from "@/app/feed/[slug]/route";
import { resolveCreatorByIdOrSlug } from "@/lib/agent-card";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

vi.mock("@/lib/agent-card", () => ({
  resolveCreatorByIdOrSlug: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseAdminClient: vi.fn(),
}));

describe("GET /feed/[slug]", () => {
  it("公开 Recipe JSON Feed：items 含 summary 与 content_text（允许为 null）", async () => {
    const creator = {
      id: "cr_1",
      owner_id: "user_owner_1",
      slug: "ai-tech-daily",
      name: "AI科技日报",
      avatar_url: null,
      bio: "简介",
      niche: "科技",
      followers_count: 1,
      source: "agent" as const,
      is_active: true,
      created_at: "2026-03-31T10:00:00Z",
    };

    const recipeRow = {
      id: "rec_1",
      slug: "my-recipe",
      title: "测试 Recipe",
      description: "一句话摘要",
      readme_md: "README 正文",
      category: "教程",
      difficulty: "easy",
      platforms: ["bilibili"],
      platform: null,
      created_at: "2026-03-31T10:00:00Z",
    };

    vi.mocked(resolveCreatorByIdOrSlug).mockResolvedValueOnce(creator as Awaited<
      ReturnType<typeof resolveCreatorByIdOrSlug>
    >);

    const queryBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [recipeRow], error: null }),
    };
    vi.mocked(getSupabaseAdminClient).mockReturnValueOnce({
      from: vi.fn().mockReturnValue(queryBuilder),
    } as never);

    const request = new NextRequest("http://localhost:3000/feed/ai-tech-daily.json");
    const response = await GET(request, { params: Promise.resolve({ slug: "ai-tech-daily.json" }) });
    const body = (await response.json()) as {
      feed_url: string;
      home_page_url: string;
      items: Array<{ summary: string | null; content_text: string | null; title: string }>;
    };

    expect(response.status).toBe(200);
    expect(body.items[0]?.title).toBe("测试 Recipe");
    expect(body.items[0]?.summary).toBe("一句话摘要");
    expect(body.items[0]?.content_text).toBe("README 正文");
    expect(body.feed_url).toBe("http://localhost:3000/feed/ai-tech-daily.json");
    expect(body.home_page_url).toBe("http://localhost:3000/u/ai-tech-daily");
  });
});
