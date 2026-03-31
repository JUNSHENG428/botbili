import { describe, expect, it, vi } from "vitest";

import { DELETE, GET, POST } from "@/app/api/creators/[id]/follow/route";
import {
  followCreator,
  getCreatorOwnership,
  getFollowStatus,
  unfollowCreator,
} from "@/lib/follow-repository";
import { createClientForServer } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
  createClientForServer: vi.fn(),
}));

vi.mock("@/lib/follow-repository", () => ({
  getCreatorOwnership: vi.fn(),
  getFollowStatus: vi.fn(),
  followCreator: vi.fn(),
  unfollowCreator: vi.fn(),
}));

describe("/api/creators/[id]/follow", () => {
  it("GET returns following=false when unauthenticated", async () => {
    vi.mocked(createClientForServer).mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    } as unknown as Awaited<ReturnType<typeof createClientForServer>>);

    const response = await GET(new Request("http://localhost:3000/api/creators/cr_1/follow"), {
      params: Promise.resolve({ id: "cr_1" }),
    });

    expect(response.status).toBe(200);
    const data = (await response.json()) as { following: boolean };
    expect(data.following).toBe(false);
  });

  it("POST rejects unauthenticated request", async () => {
    vi.mocked(createClientForServer).mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    } as unknown as Awaited<ReturnType<typeof createClientForServer>>);

    const response = await POST(new Request("http://localhost:3000/api/creators/cr_1/follow"), {
      params: Promise.resolve({ id: "cr_1" }),
    });

    expect(response.status).toBe(401);
    const data = (await response.json()) as { code: string };
    expect(data.code).toBe("AUTH_UNAUTHORIZED");
  });

  it("POST rejects following own creator", async () => {
    vi.mocked(createClientForServer).mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user_1" } }, error: null }),
      },
    } as unknown as Awaited<ReturnType<typeof createClientForServer>>);
    vi.mocked(getCreatorOwnership).mockResolvedValueOnce({
      id: "cr_1",
      owner_id: "user_1",
      followers_count: 0,
    });

    const response = await POST(new Request("http://localhost:3000/api/creators/cr_1/follow"), {
      params: Promise.resolve({ id: "cr_1" }),
    });

    expect(response.status).toBe(400);
    const data = (await response.json()) as { code: string };
    expect(data.code).toBe("VALIDATION_CANNOT_FOLLOW_SELF");
  });

  it("POST follows creator and returns latest followers_count", async () => {
    vi.mocked(createClientForServer).mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user_2" } }, error: null }),
      },
    } as unknown as Awaited<ReturnType<typeof createClientForServer>>);
    vi.mocked(getCreatorOwnership).mockResolvedValueOnce({
      id: "cr_1",
      owner_id: "user_1",
      followers_count: 2,
    });
    vi.mocked(followCreator).mockResolvedValueOnce({
      following: true,
      followersCount: 3,
    });

    const response = await POST(new Request("http://localhost:3000/api/creators/cr_1/follow"), {
      params: Promise.resolve({ id: "cr_1" }),
    });

    expect(response.status).toBe(201);
    const data = (await response.json()) as { following: boolean; followers_count: number };
    expect(data.following).toBe(true);
    expect(data.followers_count).toBe(3);
  });

  it("DELETE unfollows creator", async () => {
    vi.mocked(createClientForServer).mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user_2" } }, error: null }),
      },
    } as unknown as Awaited<ReturnType<typeof createClientForServer>>);
    vi.mocked(getCreatorOwnership).mockResolvedValueOnce({
      id: "cr_1",
      owner_id: "user_1",
      followers_count: 3,
    });
    vi.mocked(unfollowCreator).mockResolvedValueOnce({
      following: false,
      followersCount: 2,
    });

    const response = await DELETE(new Request("http://localhost:3000/api/creators/cr_1/follow"), {
      params: Promise.resolve({ id: "cr_1" }),
    });

    expect(response.status).toBe(200);
    const data = (await response.json()) as { following: boolean; followers_count: number };
    expect(data.following).toBe(false);
    expect(data.followers_count).toBe(2);
  });

  it("GET returns following=true when already followed", async () => {
    vi.mocked(createClientForServer).mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user_2" } }, error: null }),
      },
    } as unknown as Awaited<ReturnType<typeof createClientForServer>>);
    vi.mocked(getFollowStatus).mockResolvedValueOnce(true);

    const response = await GET(new Request("http://localhost:3000/api/creators/cr_1/follow"), {
      params: Promise.resolve({ id: "cr_1" }),
    });

    expect(response.status).toBe(200);
    const data = (await response.json()) as { following: boolean };
    expect(data.following).toBe(true);
  });
});
