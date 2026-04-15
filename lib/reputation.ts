import { getSupabaseAdminClient } from "@/lib/supabase/server";

import { calculateLevel, type ReputationLevel } from "@/lib/reputation-levels";

type ReputationReasonBucket = "recipe" | "execution" | "review";

interface ReputationRow {
  id: string;
  total_points: number;
  recipe_points: number;
  execution_points: number;
  review_points: number;
  level: ReputationLevel;
}

interface ActivityRow {
  user_id: string;
  created_at: string;
}

interface RecipeActivityRow {
  author_id: string;
  created_at: string;
}

const IDEMPOTENT_REASONS = new Set([
  "recipe_created",
  "execution_completed",
  "recipe_got_execution",
  "streak_7d_bonus",
]);

function getReasonBucket(reason: string): ReputationReasonBucket {
  if (
    reason.startsWith("recipe_") ||
    reason === "recipe_created"
  ) {
    return "recipe";
  }

  if (
    reason.startsWith("execution_") ||
    reason === "recipe_got_execution" ||
    reason === "streak_7d_bonus"
  ) {
    return "execution";
  }

  return "review";
}

/**
 * 发放积分并自动更新等级。
 */
export async function awardPoints(
  userId: string,
  points: number,
  reason: string,
  refId?: string,
): Promise<void> {
  if (!userId || points === 0) {
    return;
  }

  const admin = getSupabaseAdminClient();

  if (refId && IDEMPOTENT_REASONS.has(reason)) {
    const { data: existingLog, error: existingError } = await admin
      .from("reputation_log")
      .select("id")
      .eq("user_id", userId)
      .eq("reason", reason)
      .eq("ref_id", refId)
      .maybeSingle();

    if (existingError) {
      throw new Error(`awardPoints idempotency lookup failed: ${existingError.message}`);
    }

    if (existingLog) {
      return;
    }
  }

  const { data: reputationData, error: reputationError } = await admin
    .from("user_reputation")
    .select("id, total_points, recipe_points, execution_points, review_points, level")
    .eq("user_id", userId)
    .maybeSingle<ReputationRow>();

  if (reputationError) {
    throw new Error(`awardPoints reputation lookup failed: ${reputationError.message}`);
  }

  const current = reputationData ?? {
    id: "",
    total_points: 0,
    recipe_points: 0,
    execution_points: 0,
    review_points: 0,
    level: "newcomer" as ReputationLevel,
  };

  const bucket = getReasonBucket(reason);
  const nextTotalPoints = current.total_points + points;
  const nextRecipePoints = current.recipe_points + (bucket === "recipe" ? points : 0);
  const nextExecutionPoints = current.execution_points + (bucket === "execution" ? points : 0);
  const nextReviewPoints = current.review_points + (bucket === "review" ? points : 0);
  const nextLevel = calculateLevel(nextTotalPoints);
  const levelChanged = nextLevel !== current.level;
  const timestamp = new Date().toISOString();

  const { error: upsertError } = await admin
    .from("user_reputation")
    .upsert(
      {
        user_id: userId,
        total_points: nextTotalPoints,
        recipe_points: nextRecipePoints,
        execution_points: nextExecutionPoints,
        review_points: nextReviewPoints,
        level: nextLevel,
        level_updated_at: levelChanged ? timestamp : undefined,
        updated_at: timestamp,
      },
      { onConflict: "user_id" },
    );

  if (upsertError) {
    throw new Error(`awardPoints reputation upsert failed: ${upsertError.message}`);
  }

  const { error: logError } = await admin.from("reputation_log").insert({
    user_id: userId,
    points,
    reason,
    ref_id: refId ?? null,
  });

  if (logError) {
    throw new Error(`awardPoints log insert failed: ${logError.message}`);
  }
}

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

/**
 * 每日检查近 7 天连续活跃用户并发放奖励。
 */
export async function checkStreakBonuses(): Promise<void> {
  const admin = getSupabaseAdminClient();
  const today = startOfDay(new Date());
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 6);

  const [recipeActivityResult, executionActivityResult, rewardedTodayResult] = await Promise.all([
    admin
      .from("recipes")
      .select("author_id, created_at")
      .gte("created_at", sevenDaysAgo.toISOString())
      .returns<RecipeActivityRow[]>(),
    admin
      .from("recipe_executions")
      .select("user_id, created_at")
      .gte("created_at", sevenDaysAgo.toISOString())
      .returns<Array<{ user_id: string; created_at: string }>>(),
    admin
      .from("reputation_log")
      .select("user_id")
      .eq("reason", "streak_7d_bonus")
      .gte("created_at", today.toISOString())
      .returns<Array<{ user_id: string }>>(),
  ]);

  if (recipeActivityResult.error) {
    throw new Error(`checkStreakBonuses recipe lookup failed: ${recipeActivityResult.error.message}`);
  }

  if (executionActivityResult.error) {
    throw new Error(`checkStreakBonuses execution lookup failed: ${executionActivityResult.error.message}`);
  }

  if (rewardedTodayResult.error) {
    throw new Error(`checkStreakBonuses reward lookup failed: ${rewardedTodayResult.error.message}`);
  }

  const activityByUser = new Map<string, Set<string>>();
  const rewardedToday = new Set((rewardedTodayResult.data ?? []).map((item) => item.user_id));

  for (const row of (recipeActivityResult.data ?? []) as RecipeActivityRow[]) {
    const key = new Date(row.created_at).toISOString().slice(0, 10);
    const userSet = activityByUser.get(row.author_id) ?? new Set<string>();
    userSet.add(key);
    activityByUser.set(row.author_id, userSet);
  }

  for (const row of (executionActivityResult.data ?? []) as ActivityRow[]) {
    const key = new Date(row.created_at).toISOString().slice(0, 10);
    const userSet = activityByUser.get(row.user_id) ?? new Set<string>();
    userSet.add(key);
    activityByUser.set(row.user_id, userSet);
  }

  const requiredDays = new Set<string>();
  for (let offset = 0; offset < 7; offset += 1) {
    const date = new Date(sevenDaysAgo);
    date.setDate(sevenDaysAgo.getDate() + offset);
    requiredDays.add(date.toISOString().slice(0, 10));
  }

  for (const [userId, activeDays] of activityByUser.entries()) {
    if (rewardedToday.has(userId)) {
      continue;
    }

    let isEligible = true;
    for (const day of requiredDays) {
      if (!activeDays.has(day)) {
        isEligible = false;
        break;
      }
    }

    if (!isEligible) {
      continue;
    }

    await awardPoints(userId, 15, "streak_7d_bonus");
  }
}

export { calculateLevel };
