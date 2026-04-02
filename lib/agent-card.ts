import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { Creator } from "@/types";

type CreatorLookupRow = Creator;

interface CreatorVideoMetricRow {
  id: string;
  language: string | null;
  view_count: number;
  created_at: string;
}

interface EvaluationMetricRow {
  relevance: number;
  accuracy: number;
  novelty: number;
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
    accepts_citations: boolean;
    accepts_evaluations: boolean;
    webhook_enabled: boolean;
  };
  endpoints: {
    feed: string;
    videos: string;
    evaluate: string;
  };
  metrics: {
    influence_score: number;
    cited_count: number;
    feed_subscribers: number;
    total_videos: number;
    avg_evaluation: number;
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

function isMissingRelationError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const message = "message" in error && typeof error.message === "string" ? error.message : "";
  const code = "code" in error && typeof error.code === "string" ? error.code : "";

  return (
    code === "42P01" ||
    code === "PGRST205" ||
    message.includes("does not exist") ||
    message.includes("schema cache")
  );
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

  return fallbackId ?? "creator";
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
      .select("*")
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

  // Slug-based lookup: fetch all active creators and match by slug
  const { data: creators, error } = await supabase
    .from("creators")
    .select("*")
    .eq("is_active", true)
    .returns<CreatorLookupRow[]>();

  if (error) {
    throw new Error(`resolveCreatorByIdOrSlug failed: ${error.message}`);
  }

  const normalizedIdentifier = trimmed.toLowerCase();
  const match = (creators ?? []).find((creator) => getCreatorSlug(creator) === normalizedIdentifier);
  return match ? toResolvedCreator(match) : null;
}

async function getPublishedVideoMetrics(creatorId: string): Promise<CreatorVideoMetricRow[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("videos")
    .select("id, language, view_count, created_at")
    .eq("creator_id", creatorId)
    .eq("status", "published")
    .returns<CreatorVideoMetricRow[]>();

  if (error) {
    throw new Error(`getPublishedVideoMetrics failed: ${error.message}`);
  }

  return data ?? [];
}

async function getCitedCount(videoIds: string[]): Promise<number> {
  if (videoIds.length === 0) {
    return 0;
  }

  const supabase = getSupabaseAdminClient();
  const { count, error } = await supabase
    .from("citations")
    .select("id", { count: "exact", head: true })
    .in("cited_video_id", videoIds);

  if (error) {
    if (isMissingRelationError(error)) {
      return 0;
    }
    throw new Error(`getCitedCount failed: ${error.message}`);
  }

  return count ?? 0;
}

function normalizeEvaluationRow(row: EvaluationMetricRow, scale: "zero_to_one" | "one_to_five"): number {
  const average = (row.relevance + row.accuracy + row.novelty) / 3;
  if (scale === "one_to_five") {
    return average / 5;
  }
  return average;
}

async function getAverageEvaluation(videoIds: string[]): Promise<number> {
  if (videoIds.length === 0) {
    return 0;
  }

  const supabase = getSupabaseAdminClient();
  const evaluationQuery = await supabase
    .from("evaluations")
    .select("relevance, accuracy, novelty")
    .in("video_id", videoIds);

  if (!evaluationQuery.error) {
    const rows = (evaluationQuery.data ?? []) as EvaluationMetricRow[];
    if (rows.length === 0) {
      return 0;
    }
    const total = rows.reduce((sum, row) => sum + normalizeEvaluationRow(row, "zero_to_one"), 0);
    return total / rows.length;
  }

  if (!isMissingRelationError(evaluationQuery.error)) {
    throw new Error(`getAverageEvaluation failed: ${evaluationQuery.error.message}`);
  }

  const ratingsQuery = await supabase
    .from("ratings")
    .select("relevance, accuracy, novelty")
    .in("video_id", videoIds);

  if (ratingsQuery.error) {
    if (isMissingRelationError(ratingsQuery.error)) {
      return 0;
    }
    throw new Error(`getAverageEvaluation failed: ${ratingsQuery.error.message}`);
  }

  const rows = (ratingsQuery.data ?? []) as EvaluationMetricRow[];
  if (rows.length === 0) {
    return 0;
  }

  const total = rows.reduce((sum, row) => sum + normalizeEvaluationRow(row, "one_to_five"), 0);
  return total / rows.length;
}

function calculateUploadConsistency(rows: CreatorVideoMetricRow[]): number {
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const uploadDays = new Set<string>();

  rows.forEach((row) => {
    const createdAt = new Date(row.created_at);
    if (Number.isNaN(createdAt.getTime()) || createdAt.getTime() < cutoff) {
      return;
    }
    uploadDays.add(createdAt.toISOString().slice(0, 10));
  });

  return Math.min(1, uploadDays.size / 30);
}

function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function buildDescription(creator: ResolvedCreator): string {
  if (creator.bio?.trim()) {
    return creator.bio.trim();
  }

  const nicheText = creator.niche?.trim() ? `${creator.niche}领域` : "垂直内容";
  return `每日 ${nicheText}资讯速递，由 Agent 全自动运营`;
}

/**
 * 生成单个 Creator 的 Agent Card。
 */
export async function generateAgentCard(identifier: string, baseUrl: string): Promise<AgentCard | null> {
  const creator = await resolveCreatorByIdOrSlug(identifier);
  if (!creator) {
    return null;
  }

  const videoMetrics = await getPublishedVideoMetrics(creator.id);
  const videoIds = videoMetrics.map((video) => video.id);
  const languages = Array.from(
    new Set(videoMetrics.map((video) => video.language).filter((value): value is string => Boolean(value))),
  );
  const totalViews = videoMetrics.reduce((sum, video) => sum + (video.view_count ?? 0), 0);
  const citedCount = await getCitedCount(videoIds);
  const avgEvaluation = await getAverageEvaluation(videoIds);
  const uploadConsistency = calculateUploadConsistency(videoMetrics);

  const influenceScore = Math.round(
    citedCount * 30 +
      creator.followers_count * 20 +
      avgEvaluation * 1500 +
      uploadConsistency * 1000 +
      totalViews * 0.01,
  );

  return {
    name: creator.name,
    description: buildDescription(creator),
    url: `${baseUrl}/c/${creator.slug}`,
    capabilities: {
      content_types: ["video"],
      languages: languages.length > 0 ? languages : ["zh-CN"],
      niche: creator.niche || "未分类",
      accepts_citations: true,
      accepts_evaluations: true,
      webhook_enabled: true,
    },
    endpoints: {
      feed: `${baseUrl}/feed/${creator.slug}.json`,
      videos: `${baseUrl}/api/creators/${creator.slug}/videos`,
      evaluate: `${baseUrl}/api/videos/{video_id}/evaluate`,
    },
    metrics: {
      influence_score: influenceScore,
      cited_count: citedCount,
      feed_subscribers: creator.followers_count,
      total_videos: videoMetrics.length,
      avg_evaluation: roundTo(avgEvaluation, 2),
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
    .select("*")
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
