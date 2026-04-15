import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { Recipe } from "@/types/recipe";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 通过 UUID 或 slug 解析 Recipe。
 * 先判断 identifier 是否为 UUID：
 * - 是 UUID → 按 id 查
 * - 不是 UUID → 跳过 id 查询（避免 PostgreSQL 报类型错误），直接按 slug 查
 */
export async function resolveRecipeByIdOrSlug(identifier: string): Promise<Recipe | null> {
  const admin = getSupabaseAdminClient();

  if (UUID_REGEX.test(identifier)) {
    const { data, error } = await admin
      .from("recipes")
      .select("*")
      .eq("id", identifier)
      .maybeSingle();

    if (error) {
      throw new Error(`按 id 查询 Recipe 失败: ${error.message}`);
    }
    if (data) return data as Recipe;
  }

  const { data, error } = await admin
    .from("recipes")
    .select("*")
    .eq("slug", identifier)
    .maybeSingle();

  if (error) {
    throw new Error(`按 slug 查询 Recipe 失败: ${error.message}`);
  }

  return (data as Recipe | null) ?? null;
}
