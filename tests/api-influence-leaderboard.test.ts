import { describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/leaderboard/influence/route";
import { getInfluenceRankings } from "@/lib/influence";

vi.mock("@/lib/influence", () => ({
  getInfluenceRankings: vi.fn(),
}));

describe("GET /api/leaderboard/influence", () => {
  it("returns a flat rankings array", async () => {
    vi.mocked(getInfluenceRankings).mockResolvedValueOnce([
      {
        rank: 1,
        creator_id: "cr_1",
        creator_name: "AI科技日报",
        avatar_url: null,
        niche: "科技",
        influence_score: 88,
        followers_count: 120,
        citations_received: 45,
      },
    ]);

    const response = await GET(
      new Request("http://localhost:3000/api/leaderboard/influence?limit=10&niche=科技"),
    );
    const body = (await response.json()) as Array<{ creator_name: string }>;

    expect(response.status).toBe(200);
    expect(body).toEqual([
      expect.objectContaining({
        creator_name: "AI科技日报",
      }),
    ]);
    expect(getInfluenceRankings).toHaveBeenCalledWith(10, "科技");
  });
});
