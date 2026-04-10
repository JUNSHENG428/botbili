import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { VideoRecord, Creator } from "@/types";
import type { RecipeExecutionOutput } from "@/types/recipe";

export interface WebhookRecord {
  id: string;
  creator_id: string;
  target_url: string;
  events: string[];
  secret: string | null;
  is_active: boolean;
  last_triggered_at: string | null;
  failure_count: number;
  created_at: string;
}

export interface WebhookEventPayload {
  event: string;
  timestamp: string;
  data: {
    video_id: string;
    title: string;
    creator: {
      id: string;
      name: string;
      slug: string;
    };
    transcript: string | null;
    summary: string | null;
    tags: string[];
    video_url: string;
    api_url: string;
  };
}

export interface ExecutionCompletedWebhookPayload {
  event: "execution.completed";
  timestamp: string;
  data: {
    execution_id: string;
    recipe: {
      id: string;
      title: string;
      slug: string;
    };
    output: RecipeExecutionOutput;
  };
}

export interface DispatchExecutionCompletedInput {
  creatorId: string;
  executionId: string;
  recipe: {
    id: string;
    title: string;
    slug: string;
  };
  output: RecipeExecutionOutput;
}

function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "https://www.botbili.com";
}

async function signWebhookPayload(secret: string, payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const payloadData = encoder.encode(payload);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, payloadData);
  const signatureHex = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return `sha256=${signatureHex}`;
}

export async function dispatchExecutionCompletedWebhooks(
  input: DispatchExecutionCompletedInput,
): Promise<void> {
  const supabase = getSupabaseAdminClient();

  const { data: webhooks } = await supabase
    .from("webhooks")
    .select("*")
    .eq("creator_id", input.creatorId)
    .eq("is_active", true)
    .contains("events", ["execution.completed"])
    .returns<WebhookRecord[]>();

  if (!webhooks?.length) {
    return;
  }

  const payload = JSON.stringify({
    event: "execution.completed",
    timestamp: new Date().toISOString(),
    data: {
      execution_id: input.executionId,
      recipe: input.recipe,
      output: input.output,
    },
  } satisfies ExecutionCompletedWebhookPayload);

  const deliveryPromises = webhooks.map(async (wh) => {
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-BotBili-Event": "execution.completed",
        "X-BotBili-Delivery": crypto.randomUUID(),
      };

      if (wh.secret) {
        headers["X-BotBili-Signature"] = await signWebhookPayload(wh.secret, payload);
      }

      const res = await fetch(wh.target_url, {
        method: "POST",
        headers,
        body: payload,
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      await supabase
        .from("webhooks")
        .update({
          last_triggered_at: new Date().toISOString(),
          failure_count: 0,
        })
        .eq("id", wh.id);
    } catch (err) {
      console.error(`Execution webhook delivery failed for ${wh.id}:`, err);
      const newCount = (wh.failure_count ?? 0) + 1;
      await supabase
        .from("webhooks")
        .update({
          failure_count: newCount,
          is_active: newCount < 5,
        })
        .eq("id", wh.id);
    }
  });

  await Promise.all(deliveryPromises);
}

export async function dispatchWebhooks(videoId: string, creatorId: string): Promise<void> {
  const supabase = getSupabaseAdminClient();

  const { data: followers } = await supabase
    .from("follows")
    .select("follower_id")
    .eq("creator_id", creatorId);

  if (!followers?.length) {
    return;
  }

  const followerIds = followers.map((f) => f.follower_id);

  const { data: webhooks } = await supabase
    .from("webhooks")
    .select("*")
    .in("creator_id", followerIds)
    .eq("is_active", true)
    .contains("events", ["video.published"])
    .returns<WebhookRecord[]>();

  if (!webhooks?.length) {
    return;
  }

  const { data: video } = await supabase
    .from("videos")
    .select("*, creator:creators!videos_creator_id_fkey(id, name)")
    .eq("id", videoId)
    .single<VideoRecord & { creator: { id: string; name: string } }>();

  if (!video) {
    console.error(`dispatchWebhooks: video ${videoId} not found`);
    return;
  }

  const creator = video.creator as { id: string; name: string };
  const slug = creator.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  const payload = JSON.stringify({
    event: "video.published",
    timestamp: new Date().toISOString(),
    data: {
      video_id: video.id,
      title: video.title,
      creator: {
        id: creator.id,
        name: creator.name,
        slug,
      },
      transcript: video.transcript,
      summary: video.summary,
      tags: video.tags,
      video_url: video.raw_video_url || `${getBaseUrl()}/c/${slug}`,
      api_url: `${getBaseUrl()}/api/videos/${video.id}`,
    },
  } as WebhookEventPayload);

  const deliveryPromises = webhooks.map(async (wh) => {
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-BotBili-Event": "video.published",
        "X-BotBili-Delivery": crypto.randomUUID(),
      };

      if (wh.secret) {
        headers["X-BotBili-Signature"] = await signWebhookPayload(wh.secret, payload);
      }

      const res = await fetch(wh.target_url, {
        method: "POST",
        headers,
        body: payload,
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      await supabase
        .from("webhooks")
        .update({
          last_triggered_at: new Date().toISOString(),
          failure_count: 0,
        })
        .eq("id", wh.id);
    } catch (err) {
      console.error(`Webhook delivery failed for ${wh.id}:`, err);
      const newCount = (wh.failure_count ?? 0) + 1;
      await supabase
        .from("webhooks")
        .update({
          failure_count: newCount,
          is_active: newCount < 5,
        })
        .eq("id", wh.id);
    }
  });

  await Promise.all(deliveryPromises);
}
