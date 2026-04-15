import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { Recipe } from "@/types/recipe";

export interface RecipeAuthorSummary {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  author_type: Recipe["author_type"];
}

interface ProfileRow {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

interface CreatorRow {
  id: string;
  owner_id: string;
  slug: string | null;
  name: string;
  avatar_url: string | null;
}

export async function buildRecipeAuthorMap(
  recipes: Array<Pick<Recipe, "author_id" | "author_type">>,
): Promise<Map<string, RecipeAuthorSummary>> {
  const authorIds = [...new Set(recipes.map((recipe) => recipe.author_id))];
  const authorTypes = new Map(recipes.map((recipe) => [recipe.author_id, recipe.author_type]));
  const authorMap = new Map<string, RecipeAuthorSummary>();

  if (authorIds.length === 0) {
    return authorMap;
  }

  const admin = getSupabaseAdminClient();
  const [{ data: profileRows, error: profileError }, { data: creatorRows, error: creatorError }] =
    await Promise.all([
      admin.from("profiles").select("id, username, display_name, avatar_url").in("id", authorIds),
      admin.from("creators").select("id, owner_id, slug, name, avatar_url").in("owner_id", authorIds),
    ]);

  if (profileError) {
    throw new Error(`buildRecipeAuthorMap profile lookup failed: ${profileError.message}`);
  }

  if (creatorError) {
    throw new Error(`buildRecipeAuthorMap creator lookup failed: ${creatorError.message}`);
  }

  const profileMap = new Map<string, ProfileRow>();
  for (const row of (profileRows ?? []) as ProfileRow[]) {
    profileMap.set(row.id, row);
  }

  const creatorMap = new Map<string, CreatorRow>();
  for (const row of (creatorRows ?? []) as CreatorRow[]) {
    if (!creatorMap.has(row.owner_id)) {
      creatorMap.set(row.owner_id, row);
    }
  }

  for (const authorId of authorIds) {
    const profile = profileMap.get(authorId);
    const creator = creatorMap.get(authorId);
    const authorType = authorTypes.get(authorId) ?? "human";
    const username =
      profile?.username?.trim() ||
      creator?.slug?.trim() ||
      profile?.display_name?.trim()?.toLowerCase().replace(/\s+/g, "-") ||
      `user-${authorId.slice(0, 8)}`;

    authorMap.set(authorId, {
      id: authorId,
      username,
      display_name: profile?.display_name ?? creator?.name ?? null,
      avatar_url: profile?.avatar_url ?? creator?.avatar_url ?? null,
      author_type: authorType,
    });
  }

  return authorMap;
}
