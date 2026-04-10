/**
 * 平台凭证管理
 * 服务端专用：加密存储和读取平台 Cookie
 */

import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { decrypt, encrypt } from "./credentials-crypto";

export interface PlatformCredential {
  id: string;
  creator_id: string;
  platform: string;
  cookie: string; // 加密后的密文
  note: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlatformCredentialPublic {
  id: string;
  platform: string;
  note: string | null;
  expires_at: string | null;
  updated_at: string;
}

const PLATFORMS = ["bilibili", "youtube", "douyin", "kuaishou", "xiaohongshu"] as const;
export type Platform = (typeof PLATFORMS)[number];

export function isValidPlatform(platform: string): platform is Platform {
  return PLATFORMS.includes(platform as Platform);
}

/**
 * 获取用户的所有平台凭证（不包含 cookie 明文）
 */
export async function getCreatorCredentials(
  creatorId: string
): Promise<PlatformCredentialPublic[]> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("platform_credentials")
    .select("id, platform, note, expires_at, updated_at")
    .eq("creator_id", creatorId)
    .order("platform", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch credentials: ${error.message}`);
  }

  return (data ?? []) as PlatformCredentialPublic[];
}

/**
 * 获取特定平台的 Cookie（解密后）
 * ⚠️ 仅在服务端调用，绝不暴露给前端
 */
export async function getCreatorCookie(
  creatorId: string,
  platform: Platform
): Promise<string | null> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("platform_credentials")
    .select("cookie")
    .eq("creator_id", creatorId)
    .eq("platform", platform)
    .maybeSingle();

  if (error || !data?.cookie) {
    return null;
  }

  try {
    return decrypt(data.cookie);
  } catch {
    console.error(`Failed to decrypt cookie for ${platform}`);
    return null;
  }
}

/**
 * 保存平台凭证（cookie 会被自动加密）
 */
export async function saveCredential(
  creatorId: string,
  platform: Platform,
  cookie: string,
  note?: string,
  expiresAt?: string | null
): Promise<PlatformCredentialPublic> {
  const supabase = getSupabaseAdminClient();

  const encryptedCookie = encrypt(cookie);

  const { data, error } = await supabase
    .from("platform_credentials")
    .upsert(
      {
        creator_id: creatorId,
        platform,
        cookie: encryptedCookie,
        note: note || null,
        expires_at: expiresAt || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "creator_id,platform" }
    )
    .select("id, platform, note, expires_at, updated_at")
    .single();

  if (error || !data) {
    throw new Error(`Failed to save credential: ${error?.message}`);
  }

  return data as PlatformCredentialPublic;
}

/**
 * 删除平台凭证
 */
export async function deleteCredential(
  creatorId: string,
  platform: Platform
): Promise<void> {
  const supabase = getSupabaseAdminClient();

  const { error } = await supabase
    .from("platform_credentials")
    .delete()
    .eq("creator_id", creatorId)
    .eq("platform", platform);

  if (error) {
    throw new Error(`Failed to delete credential: ${error.message}`);
  }
}
