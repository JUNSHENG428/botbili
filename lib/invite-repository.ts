import { randomBytes } from "crypto";

import { createAdminClient } from "@/lib/supabase/server";

export interface InviteCodeRecord {
  id: string;
  code: string;
  source: string;
  max_uses: number;
  used_count: number;
  created_by: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

export interface CreateInviteCodeInput {
  source: string;
  created_by: string;
  max_uses?: number;
  prefix?: string;
  expires_at?: string | null;
}

export interface WechatInviteCodeResult {
  invite: InviteCodeRecord;
  reused: boolean;
}

function generateInviteCode(prefix: string): string {
  return `${prefix}-${randomBytes(4).toString("hex").toUpperCase()}`;
}

function isInviteCodeReusable(invite: InviteCodeRecord): boolean {
  if (!invite.is_active || invite.used_count >= invite.max_uses) {
    return false;
  }

  if (invite.expires_at) {
    return new Date(invite.expires_at).getTime() > Date.now();
  }

  return true;
}

/**
 * 获取同一来源下最近仍可用的邀请码，避免同一用户重复刷码。
 */
export async function getLatestReusableInviteCode(
  source: string,
  createdBy: string,
): Promise<InviteCodeRecord | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("invite_codes")
    .select("*")
    .eq("source", source)
    .eq("created_by", createdBy)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    throw new Error(`getLatestReusableInviteCode failed: ${error.message}`);
  }

  const invites = (data ?? []) as InviteCodeRecord[];
  return invites.find(isInviteCodeReusable) ?? null;
}

/**
 * 创建一次性邀请码。
 */
export async function createInviteCode(input: CreateInviteCodeInput): Promise<InviteCodeRecord> {
  const admin = createAdminClient();
  const prefix = input.prefix ?? "SEED";

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateInviteCode(prefix);
    const { data, error } = await admin
      .from("invite_codes")
      .insert({
        code,
        source: input.source,
        max_uses: input.max_uses ?? 1,
        created_by: input.created_by,
        expires_at: input.expires_at ?? null,
      })
      .select("*")
      .single();

    if (!error && data) {
      return data as InviteCodeRecord;
    }

    if ((error as { code?: string } | null)?.code === "23505") {
      continue;
    }

    throw new Error(`createInviteCode failed: ${error?.message ?? "unknown error"}`);
  }

  throw new Error("createInviteCode failed: code generation exhausted");
}

/**
 * 为微信公众号用户返回专属邀请码。默认复用该用户最近未使用的邀请码。
 */
export async function getOrCreateWechatInviteCode(openId: string): Promise<WechatInviteCodeResult> {
  const source = "wechat_mp";
  const createdBy = `wechat:${openId}`;
  const existing = await getLatestReusableInviteCode(source, createdBy);

  if (existing) {
    return {
      invite: existing,
      reused: true,
    };
  }

  const invite = await createInviteCode({
    source,
    created_by: createdBy,
    max_uses: 1,
    prefix: "WX",
  });

  return {
    invite,
    reused: false,
  };
}
