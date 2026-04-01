import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getCachedInfluenceScore } from "@/lib/influence";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseAdminClient: vi.fn(),
}));

describe("getCachedInfluenceScore", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rebuilds raw metrics when old cache rows do not contain them", async () => {
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from(table: string) {
        if (table === "influence_scores") {
          return {
            select() {
              return {
                eq() {
                  return {
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: {
                        creator_id: "cr_1",
                        overall_score: 78,
                        citation_score: 70,
                        follower_score: 65,
                        rating_score: 80,
                        stability_score: 85,
                        citations_received: 7,
                        updated_at: "2026-04-01T00:00:00Z",
                      },
                      error: null,
                    }),
                  };
                },
              };
            },
          };
        }

        if (table === "creators") {
          return {
            select() {
              return {
                eq() {
                  return {
                    single: vi.fn().mockResolvedValue({
                      data: {
                        id: "cr_1",
                        name: "AI科技日报",
                        followers_count: 12,
                        created_at: "2026-03-22T00:00:00Z",
                      },
                      error: null,
                    }),
                  };
                },
              };
            },
          };
        }

        if (table === "videos") {
          return {
            select() {
              return {
                eq(column: string, value: string) {
                  if (column === "creator_id" && value === "cr_1") {
                    return {
                      eq(statusColumn: string, statusValue: string) {
                        if (statusColumn === "status" && statusValue === "published") {
                          return Promise.resolve({
                            data: [{ id: "vid_1" }, { id: "vid_2" }],
                            error: null,
                          });
                        }

                        if (statusColumn === "status" && statusValue === "rejected") {
                          return Promise.resolve({
                            count: 1,
                            error: null,
                          });
                        }

                        return Promise.resolve({ data: [], error: null });
                      },
                    };
                  }

                  return {
                    eq() {
                      return Promise.resolve({ data: [], error: null });
                    },
                  };
                },
              };
            },
          };
        }

        if (table === "citations") {
          return {
            select() {
              return {
                in() {
                  return Promise.resolve({
                    count: 7,
                    error: null,
                  });
                },
              };
            },
          };
        }

        if (table === "ratings") {
          return {
            select() {
              return {
                in() {
                  return Promise.resolve({
                    data: [
                      { relevance: 4, accuracy: 5, novelty: 4 },
                      { relevance: 5, accuracy: 4, novelty: 4 },
                    ],
                    error: null,
                  });
                },
              };
            },
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      },
    } as unknown as ReturnType<typeof getSupabaseAdminClient>);

    const score = await getCachedInfluenceScore("cr_1");

    expect(score?.raw_metrics).toEqual({
      citations_received: 7,
      followers_count: 12,
      avg_rating: 4.3,
      videos_published: 2,
      account_age_days: 10,
    });
  });
});
