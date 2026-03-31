import type { User } from "@supabase/supabase-js";

import { createClientForServer } from "@/lib/supabase/server";

/**
 * 获取当前登录用户（Server Component 使用）。
 */
export async function getUser(): Promise<User | null> {
  const supabase = await createClientForServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
