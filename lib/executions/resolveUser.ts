import { extractBearerToken, hashApiKey } from "@/lib/auth";
import { verifyApiKey } from "@/lib/upload-repository";
import { createClientForServer } from "@/lib/supabase/server";

export interface ResolvedUser {
  userId: string;
  creatorId: string | null; // API Key 鉴权时为 creator.id，Session 时为 null
}

/**
 * 优先尝试 Bearer API Key，失败则 fallback 到 Supabase Session。
 * 返回 null 表示未认证。
 */
export async function resolveUser(
  authHeader: string | null
): Promise<ResolvedUser | null> {
  const token = extractBearerToken(authHeader);
  if (token) {
    const creator = await verifyApiKey(hashApiKey(token));
    if (!creator) return null;
    return { userId: creator.owner_id, creatorId: creator.id };
  }
  const supabase = await createClientForServer();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return { userId: user.id, creatorId: null };
}
