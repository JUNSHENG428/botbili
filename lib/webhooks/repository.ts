import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { WebhookRecord } from "@/lib/webhooks/dispatch";

export interface CreateWebhookRequest {
  target_url: string;
  events?: string[];
  secret?: string;
}

export interface UpdateWebhookRequest {
  target_url?: string;
  events?: string[];
  secret?: string;
  is_active?: boolean;
}

export async function createWebhook(
  creatorId: string,
  payload: CreateWebhookRequest,
): Promise<WebhookRecord> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("webhooks")
    .insert({
      creator_id: creatorId,
      target_url: payload.target_url,
      events: payload.events ?? ["video.published"],
      secret: payload.secret ?? null,
    })
    .select("*")
    .single<WebhookRecord>();

  if (error) {
    throw new Error(`createWebhook failed: ${error.message}`);
  }

  return data;
}

export async function getWebhooksByCreatorId(creatorId: string): Promise<WebhookRecord[]> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("webhooks")
    .select("*")
    .eq("creator_id", creatorId)
    .order("created_at", { ascending: false })
    .returns<WebhookRecord[]>();

  if (error) {
    throw new Error(`getWebhooksByCreatorId failed: ${error.message}`);
  }

  return data ?? [];
}

export async function getWebhookById(webhookId: string): Promise<WebhookRecord | null> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("webhooks")
    .select("*")
    .eq("id", webhookId)
    .maybeSingle<WebhookRecord>();

  if (error) {
    throw new Error(`getWebhookById failed: ${error.message}`);
  }

  return data;
}

export async function updateWebhook(
  webhookId: string,
  payload: UpdateWebhookRequest,
): Promise<WebhookRecord> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("webhooks")
    .update({
      ...(payload.target_url !== undefined && { target_url: payload.target_url }),
      ...(payload.events !== undefined && { events: payload.events }),
      ...(payload.secret !== undefined && { secret: payload.secret }),
      ...(payload.is_active !== undefined && { is_active: payload.is_active }),
    })
    .eq("id", webhookId)
    .select("*")
    .single<WebhookRecord>();

  if (error) {
    throw new Error(`updateWebhook failed: ${error.message}`);
  }

  return data;
}

export async function deleteWebhook(webhookId: string): Promise<void> {
  const supabase = getSupabaseAdminClient();

  const { error } = await supabase
    .from("webhooks")
    .delete()
    .eq("id", webhookId);

  if (error) {
    throw new Error(`deleteWebhook failed: ${error.message}`);
  }
}
