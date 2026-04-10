import { createClientForServer } from "@/lib/supabase/server";
import { extractBearerToken, hashApiKey } from "@/lib/auth";
import { verifyApiKey as verifyApiKeyByHash } from "@/lib/upload-repository";
import type { Creator } from "@/types";

export type AuthResult =
  | { mode: "session"; userId: string; creator: null }
  | { mode: "api_key"; userId: string; creator: Creator }
  | { mode: "none" };

/**
 * 优先检查 Bearer API Key，其次检查 Supabase Session。
 * API Key 模式下同时返回 creator 对象（含 owner_id）。
 * 
 * // P14: api-key-auth
 */
export async function resolveAuth(request: Request): Promise<AuthResult> {
  // 1. 检查 Authorization: Bearer xxx header
  const authHeader = request.headers.get("authorization");
  const token = extractBearerToken(authHeader);

  if (token) {
    const keyHash = hashApiKey(token);
    const creator = await verifyApiKeyByHash(keyHash);
    if (creator) {
      return { mode: "api_key", userId: creator.owner_id, creator };
    }
  }

  // 2. 检查 Supabase Session
  try {
    const supabase = await createClientForServer();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (!error && user) {
      return { mode: "session", userId: user.id, creator: null };
    }
  } catch {
    // Session 验证失败，继续返回 none
  }

  // 3. 两者都没有/失败
  return { mode: "none" };
}
