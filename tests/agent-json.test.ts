import { describe, expect, it, vi } from "vitest";

import { GET as getCreatorAgentJson } from "@/app/api/creators/[id]/agent.json/route";
import { GET as getWellKnownAgentJson } from "@/app/.well-known/agent.json/route";
import { discoverAgents, generateAgentCard } from "@/lib/agent-card";

vi.mock("@/lib/agent-card", () => ({
  discoverAgents: vi.fn(),
  generateAgentCard: vi.fn(),
}));

describe("GET /.well-known/agent.json", () => {
  it("returns a creator agent card when creator query is provided", async () => {
    vi.mocked(generateAgentCard).mockResolvedValueOnce({
      name: "AI科技日报",
      description: "每日 AI 资讯",
      url: "http://localhost:3000/c/ai-tech-daily",
      capabilities: {
        content_types: ["video"],
        languages: ["zh-CN"],
        niche: "科技",
        accepts_citations: true,
        accepts_evaluations: true,
        webhook_enabled: true,
      },
      endpoints: {
        feed: "http://localhost:3000/feed/ai-tech-daily.json",
        videos: "http://localhost:3000/api/creators/ai-tech-daily/videos",
        evaluate: "http://localhost:3000/api/videos/{video_id}/evaluate",
      },
      metrics: {
        influence_score: 1280,
        cited_count: 12,
        feed_subscribers: 20,
        total_videos: 8,
        avg_evaluation: 0.84,
      },
      protocol: "botbili/v2",
      a2a_compatible: true,
    });

    const response = await getWellKnownAgentJson(
      new Request("http://localhost:3000/.well-known/agent.json?creator=ai-tech-daily"),
    );
    const body = (await response.json()) as { protocol: string; url: string };

    expect(response.status).toBe(200);
    expect(body.protocol).toBe("botbili/v2");
    expect(body.url).toBe("http://localhost:3000/c/ai-tech-daily");
    expect(generateAgentCard).toHaveBeenCalledWith("ai-tech-daily", "http://localhost:3000");
  });

  it("returns discovery list when creator query is omitted", async () => {
    vi.mocked(discoverAgents).mockResolvedValueOnce([
      {
        id: "cr_1",
        slug: "ai-tech-daily",
        name: "AI科技日报",
        niche: "科技",
        avatar_url: null,
        url: "http://localhost:3000/c/ai-tech-daily",
        agent_json_url: "http://localhost:3000/.well-known/agent.json?creator=ai-tech-daily",
      },
    ]);

    const response = await getWellKnownAgentJson(
      new Request("http://localhost:3000/.well-known/agent.json"),
    );
    const body = (await response.json()) as {
      total: number;
      agents: Array<{ agent_card_url: string }>;
    };

    expect(response.status).toBe(200);
    expect(body.total).toBe(1);
    expect(body.agents[0]?.agent_card_url).toBe(
      "http://localhost:3000/.well-known/agent.json?creator=ai-tech-daily",
    );
  });
});

describe("GET /api/creators/[id]/agent.json", () => {
  it("supports slug-based creator identifier", async () => {
    vi.mocked(generateAgentCard).mockResolvedValueOnce({
      name: "AI科技日报",
      description: "每日 AI 资讯",
      url: "http://localhost:3000/c/ai-tech-daily",
      capabilities: {
        content_types: ["video"],
        languages: ["zh-CN"],
        niche: "科技",
        accepts_citations: true,
        accepts_evaluations: true,
        webhook_enabled: true,
      },
      endpoints: {
        feed: "http://localhost:3000/feed/ai-tech-daily.json",
        videos: "http://localhost:3000/api/creators/ai-tech-daily/videos",
        evaluate: "http://localhost:3000/api/videos/{video_id}/evaluate",
      },
      metrics: {
        influence_score: 1280,
        cited_count: 12,
        feed_subscribers: 20,
        total_videos: 8,
        avg_evaluation: 0.84,
      },
      protocol: "botbili/v2",
      a2a_compatible: true,
    });

    const response = await getCreatorAgentJson(new Request("http://localhost:3000/api/creators/ai-tech-daily/agent.json"), {
      params: Promise.resolve({ id: "ai-tech-daily" }),
    });
    const body = (await response.json()) as { name: string };

    expect(response.status).toBe(200);
    expect(body.name).toBe("AI科技日报");
  });
});
