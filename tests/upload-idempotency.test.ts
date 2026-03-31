import { describe, expect, it } from "vitest";

import { getUploadByIdempotencyKey, setUploadByIdempotencyKey } from "@/lib/upload-idempotency";

describe("upload idempotency store", () => {
  it("returns existing upload for same creator and key", async () => {
    await setUploadByIdempotencyKey("creator_a", "req_1", {
      videoId: "video_1",
      url: "https://botbili.com/v/video_1",
      status: "processing",
    });

    const hit = await getUploadByIdempotencyKey("creator_a", "req_1");
    expect(hit).not.toBeNull();
    expect(hit?.videoId).toBe("video_1");
    expect(hit?.status).toBe("processing");
  });
});
