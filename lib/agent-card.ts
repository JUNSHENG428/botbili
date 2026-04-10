import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { Creator } from "@/types";

type CreatorLookupRow = Creator;

/**
 * R2-02: 公开安全字段列表 — 不含 agent_key_hash、owner_id、guardian_id、uploads_this_month 等敏感字段
 */
export const PUBLIC_CREATOR_FIELDS =
  "id, name, slug, bio, niche, avatar_url, followers_count, is_active, source, created_at";

/**
 * R2-02: 内部完整字段列表 — 包含 agent_key_hash（仅用于 verifyApiKey 等内部函数，严禁返回给公开 API）
 */
const INTERNAL_CREATOR_FIELDS =
  "id, name, slug, bio, niche, avatar_url, style, followers_count, is_active, source, owner_id, guardian_id, created_at, updated_at, plan_type, upload_quota, uploads_this_month, quota_reset_at, agent_key_hash";  // agent_key_hash: INTERNAL ONLY — never expose in public responses

interface CreatorRecipeMetricRow {
  id: string;
  platforms: string[] | null;
  platform: string[] | null;
  star_count: number | null;
  fork_count: number | null;
  exec_count: number | null;
  created_at: string;
}

export interface ResolvedCreator extends CreatorLookupRow {
  slug: string;
}

export interface AgentCard {
  name: string;
  description: string;
  url: string;
  capabilities: {
    content_types: string[];
    languages: string[];
    niche: string;
    supports_fork: boolean;
    supports_execution: boolean;
    webhook_enabled: boolean;
    recipe_discovery: boolean;
    recipe_execution: boolean;
    recipe_publishing: boolean;
  };
  endpoints: {
    recipe_feed: string;
    recipes: string;
    execute_recipe: string;
    publish_recipe: string;
  };
  metrics: {
    influence_score: number;
    followers_count: number;
    total_recipes: number;
    total_stars: number;
    total_forks: number;
    total_executions: number;
    platforms?: string[];
  };
  protocol: "botbili/v2";
  a2a_compatible: true;
}

export interface AgentDiscoveryItem {
  id: string;
  slug: string;
  name: string;
  niche: string;
  avatar_url: string | null;
  url: string;
  agent_json_url: string;
}

/**
 * 生成公开可读的 creator slug。
 * 当前 schema 尚无独立 slug 字段，因此优先使用名称转 slug，失败则退回 creator id。
 */
export function slugifyCreatorName(name: string, fallbackId?: string): string {
  const normalized = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (normalized.length > 0) {
    return normalized;
  }

  return fallbackId ?? "";
}

export function getCreatorSlug(creator: Pick<CreatorLookupRow, "id" | "name">): string {
  return slugifyCreatorName(creator.name, creator.id);
}

function toResolvedCreator(creator: CreatorLookupRow): ResolvedCreator {
  return {
    ...creator,
    slug: getCreatorSlug(creator),
  };
}

/**
 * 按 creator id 或 slug 解析频道。
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function resolveCreatorByIdOrSlug(identifier: string): Promise<ResolvedCreator | null> {
  const trimmed = identifier.trim();
  if (!trimmed) {
    return null;
  }

  const supabase = getSupabaseAdminClient();

  // Only query by UUID id if the identifier looks like a valid UUID
  if (UUID_RE.test(trimmed)) {
    const { data: exactMatch, error: exactError } = await supabase
      .from("creators")
      .select(INTERNAL_CREATOR_FIELDS)
      .eq("id", trimmed)
      .eq("is_active", true)
      .maybeSingle<CreatorLookupRow>();

    if (exactError) {
      // Swallow the error and fall through to slug lookup
      console.error("resolveCreatorByIdOrSlug UUID lookup failed:", exactError.message);
    } else if (exactMatch) {
      return toResolvedCreator(exactMatch);
    }
  }

  // Slug-based lookup: direct DB query on slug column
  const normalizedIdentifier = trimmed.toLowerCase();
  const { data: slugMatch, error } = await supabase
    .from("creators")
    .select(INTERNAL_CREATOR_FIELDS)
    .eq("slug", normalizedIdentifier)
    .eq("is_active", true)
    .maybeSingle<CreatorLookupRow>();

  if (error) {
    throw new Error(`resolveCreatorByIdOrSlug failed: ${error.message}`);
  }

  return slugMatch ? toResolvedCreator(slugMatch) : null;
}

async function getPublishedRecipeMetrics(authorId: string): Promise<CreatorRecipeMetricRow[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("recipes")
    .select("id, platforms, platform, star_count, fork_count, exec_count, created_at")
    .eq("author_id", authorId)
    .eq("status", "published")
    .eq("visibility", "public")
    .returns<CreatorRecipeMetricRow[]>();

  if (error) {
    throw new Error(`getPublishedRecipeMetrics failed: ${error.message}`);
  }

  return data ?? [];
}

function getRecipePlatforms(recipes: CreatorRecipeMetricRow[]): string[] {
  const platforms = recipes.flatMap((recipe) => {
    if (Array.isArray(recipe.platforms) && recipe.platforms.length > 0) {
      return recipe.platforms;
    }
    if (Array.isArray(recipe.platform) && recipe.platform.length > 0) {
      return recipe.platform;
    }
    return [];
  });

  return Array.from(new Set(platforms.filter((value) => value.trim().length > 0)));
}

function buildDescription(creator: ResolvedCreator): string {
  if (creator.bio?.trim()) {
    return creator.bio.trim();
  }

  const nicheText = creator.niche?.trim() ? `${creator.niche}领域` : "垂直内容";
  return `分享 ${nicheText} 的 AI 视频 Recipe，支持 Fork、执行和持续改进。`;
}

/**
 * 生成单个 Creator 的 Agent Card。
 */
export async function generateAgentCard(identifier: string, baseUrl: string): Promise<AgentCard | null> {
  const creator = await resolveCreatorByIdOrSlug(identifier);
  if (!creator) {
    return null;
  }

  const recipeMetrics = await getPublishedRecipeMetrics(creator.owner_id);
  const platforms = getRecipePlatforms(recipeMetrics);
  const totalStars = recipeMetrics.reduce((sum, recipe) => sum + (recipe.star_count ?? 0), 0);
  const totalForks = recipeMetrics.reduce((sum, recipe) => sum + (recipe.fork_count ?? 0), 0);
  const totalExecutions = recipeMetrics.reduce((sum, recipe) => sum + (recipe.exec_count ?? 0), 0);

  const influenceScore = Math.round(
    creator.followers_count * 10 +
      recipeMetrics.length * 5 +
      totalStars * 20 +
      totalForks * 25 +
      totalExecutions * 10,
  );

  return {
    name: creator.name,
    description: buildDescription(creator),
    url: `${baseUrl}/c/${creator.slug}`,
    capabilities: {
      content_types: ["ai_video_recipe"],
      languages: ["zh-CN"],
      niche: creator.niche || "未分类",
      supports_fork: true,
      supports_execution: true,
      webhook_enabled: true,
      recipe_discovery: true,
      recipe_execution: true,
      recipe_publishing: true,
    },
    endpoints: {
      recipe_feed: `${baseUrl}/feed/${creator.slug}.json`,
      recipes: `${baseUrl}/api/recipes?author=${creator.owner_id}`,
      execute_recipe: `${baseUrl}/api/recipes/{recipe_id}/execute`,
      publish_recipe: `${baseUrl}/api/recipes`,
    },
    metrics: {
      influence_score: influenceScore,
      followers_count: creator.followers_count,
      total_recipes: recipeMetrics.length,
      total_stars: totalStars,
      total_forks: totalForks,
      total_executions: totalExecutions,
      ...(platforms.length > 0 ? { platforms } : {}),
    },
    protocol: "botbili/v2",
    a2a_compatible: true,
  };
}

/**
 * 生成轻量级 Agent 发现项。
 */
export function generateMiniAgentCard(
  creator: Pick<ResolvedCreator, "id" | "name" | "avatar_url" | "niche" | "slug">,
  baseUrl: string,
): AgentDiscoveryItem {
  return {
    id: creator.id,
    slug: creator.slug,
    name: creator.name,
    niche: creator.niche,
    avatar_url: creator.avatar_url,
    url: `${baseUrl}/c/${creator.slug}`,
    agent_json_url: `${baseUrl}/.well-known/agent.json?creator=${creator.slug}`,
  };
}

/**
 * Agent 发现列表。
 */
export async function discoverAgents(
  baseUrl: string,
  limit: number = 20,
  niche?: string,
): Promise<AgentDiscoveryItem[]> {
  const supabase = getSupabaseAdminClient();

  let query = supabase
    .from("creators")
    .select(PUBLIC_CREATOR_FIELDS)
    .eq("is_active", true)
    .order("followers_count", { ascending: false })
    .limit(limit);

  if (niche) {
    query = query.eq("niche", niche);
  }

  const { data, error } = await query.returns<CreatorLookupRow[]>();
  if (error) {
    throw new Error(`discoverAgents failed: ${error.message}`);
  }

  return (data ?? [])
    .filter((creator) => creator.source !== "human")
    .map((creator) => generateMiniAgentCard(toResolvedCreator(creator), baseUrl));
}
