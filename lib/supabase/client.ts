import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 创建浏览器端 Supabase Client（受 RLS 约束）。
 * 必须用字面量访问 process.env.NEXT_PUBLIC_*，否则 Next.js 编译时无法替换。
 */
export function createClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Missing Supabase env vars");
  }

  return createBrowserClient(url, anonKey);
}
