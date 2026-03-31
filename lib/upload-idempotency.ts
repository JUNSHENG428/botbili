import { getSupabaseAdminClient } from "@/lib/supabase/server";

interface UploadIdempotencyRecord {
  videoId: string;
  url: string;
  status: "processing";
  createdAtMs: number;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const uploadIdempotencyStore = new Map<string, UploadIdempotencyRecord>();

function getStoreKey(creatorId: string, idempotencyKey: string): string {
  return `${creatorId}:${idempotencyKey}`;
}

function cleanupExpired(): void {
  const now = Date.now();
  for (const [key, value] of uploadIdempotencyStore.entries()) {
    if (now - value.createdAtMs > ONE_DAY_MS) {
      uploadIdempotencyStore.delete(key);
    }
  }
}

interface UploadIdempotencyRow {
  creator_id: string;
  idempotency_key: string;
  video_id: string;
  url: string;
  status: "processing";
  created_at: string;
}

function isMissingTableError(message: string): boolean {
  return message.includes("relation") && message.includes("does not exist");
}

/**
 * 查询幂等上传结果（优先查 DB，失败时降级内存）。
 */
export async function getUploadByIdempotencyKey(
  creatorId: string,
  idempotencyKey: string,
): Promise<UploadIdempotencyRecord | null> {
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("upload_idempotency")
      .select("creator_id, idempotency_key, video_id, url, status, created_at")
      .eq("creator_id", creatorId)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle<UploadIdempotencyRow>();

    if (!error && data) {
      return {
        videoId: data.video_id,
        url: data.url,
        status: data.status,
        createdAtMs: new Date(data.created_at).getTime(),
      };
    }

    if (error && !isMissingTableError(error.message)) {
      throw new Error(`query upload_idempotency failed: ${error.message}`);
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "";
    if (!message.startsWith("Missing required env:")) {
      throw error;
    }
  }

  cleanupExpired();
  const hit = uploadIdempotencyStore.get(getStoreKey(creatorId, idempotencyKey));
  return hit ?? null;
}

/**
 * 记录幂等上传结果（优先写 DB，失败时降级内存）。
 */
export async function setUploadByIdempotencyKey(
  creatorId: string,
  idempotencyKey: string,
  payload: { videoId: string; url: string; status: "processing" },
): Promise<void> {
  try {
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase.from("upload_idempotency").upsert(
      {
        creator_id: creatorId,
        idempotency_key: idempotencyKey,
        video_id: payload.videoId,
        url: payload.url,
        status: payload.status,
      },
      {
        onConflict: "creator_id,idempotency_key",
        ignoreDuplicates: false,
      },
    );

    if (!error) {
      return;
    }

    if (!isMissingTableError(error.message)) {
      throw new Error(`upsert upload_idempotency failed: ${error.message}`);
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "";
    if (!message.startsWith("Missing required env:")) {
      throw error;
    }
  }

  uploadIdempotencyStore.set(getStoreKey(creatorId, idempotencyKey), {
    ...payload,
    createdAtMs: Date.now(),
  });
}
