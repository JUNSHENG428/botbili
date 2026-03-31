import { cookies } from "next/headers";

import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedAdminClient: SupabaseClient | null = null;

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

/**
 * 创建服务端用户态 Supabase Client（受 RLS 约束）。
 */
export async function createClientForServer(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  const url = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // 在 Server Component 场景下刷新会话时可能无法写入 cookie。
        }
      },
    },
  });
}

/**
 * 兼容命名：createClient = 用户态服务端 client。
 */
export async function createClient(): Promise<SupabaseClient> {
  return createClientForServer();
}

/**
 * 创建服务端 Admin Client（仅服务端调用，绕过 RLS）。
 */
export function createAdminClient(): SupabaseClient {
  if (cachedAdminClient) {
    return cachedAdminClient;
  }

  const url = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  cachedAdminClient = createSupabaseClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  return cachedAdminClient;
}

/**
 * 兼容已有代码：返回 Admin Client。
 */
export function getSupabaseAdminClient(): SupabaseClient {
  return createAdminClient();
}
