import { getSupabaseAdminClient } from "@/lib/supabase/server";

interface RecipeStatsRow {
  star_count: number | null;
  fork_count: number | null;
}

interface ExecutionAggregateRow {
  status: string;
  duration_seconds: number | null;
  created_at: string;
  output_external_url: string | null;
}

export interface CalculateRecipeScoreInput {
  starCount: number;
  forkCount: number;
  executionCount: number;
  successRate: number;
  outputCount: number;
  recentExecutionCount: number;
  recentOutputCount?: number;
}

function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function isCompletedStatus(status: string): boolean {
  return status === "success" || status === "completed";
}

/**
 * 计算 Recipe 的综合效果分。
 *
 * 设计目标：
 * 1. 公开执行和真实输出都应该显著加分。
 * 2. 成功率不能被 1/1 这种低样本结果放大，所以要做最小样本平滑。
 * 3. 最近 7 天仍有人执行、仍有新输出的 Recipe，应该在榜单里更靠前。
 */
export function calculateRecipeScore(input: CalculateRecipeScoreInput): number {
  const priorSampleSize = 5;
  const priorSuccessRate = 0.55;
  const smoothedSuccessRate =
    (input.successRate * input.executionCount + priorSuccessRate * priorSampleSize) /
    (input.executionCount + priorSampleSize);

  const baseScore = input.executionCount * 1.0 + input.starCount * 2.5 + input.forkCount * 4.0;
  const outputBonus = input.outputCount * 6.0 + (input.recentOutputCount ?? 0) * 2.0;
  const recencyBoost = input.recentExecutionCount * 2.0;
  const qualityBonus = smoothedSuccessRate * 10.0;
  const lowSamplePenalty = input.executionCount < 5 ? (5 - input.executionCount) * 1.5 : 0;

  return roundTo(
    Math.max(0, baseScore + outputBonus + recencyBoost + qualityBonus - lowSamplePenalty),
    2,
  );
}

/**
 * 重新计算并回写 Recipe 的执行统计与综合效果分。
 */
export async function recalculateRecipeStats(recipeId: string): Promise<void> {
  const admin = getSupabaseAdminClient();

  const [{ data: recipeData, error: recipeError }, { data: executionData, error: executionError }] =
    await Promise.all([
      admin
        .from("recipes")
        .select("star_count, fork_count")
        .eq("id", recipeId)
        .maybeSingle<RecipeStatsRow>(),
      admin
        .from("recipe_executions")
        .select("status, duration_seconds, created_at, output_external_url")
        .eq("recipe_id", recipeId)
        .order("created_at", { ascending: false })
        .returns<ExecutionAggregateRow[]>(),
    ]);

  if (recipeError) {
    throw new Error(`recalculateRecipeStats recipe lookup failed: ${recipeError.message}`);
  }

  if (!recipeData) {
    return;
  }

  if (executionError) {
    throw new Error(`recalculateRecipeStats execution lookup failed: ${executionError.message}`);
  }

  const executions = (executionData ?? []).filter((execution) => execution.status !== "cancelled");
  const completedExecutions = executions.filter((execution) => isCompletedStatus(execution.status));
  const durationValues = completedExecutions
    .map((execution) => execution.duration_seconds)
    .filter((duration): duration is number => typeof duration === "number" && duration >= 0);
  const outputExecutions = completedExecutions.filter(
    (execution) => typeof execution.output_external_url === "string" && execution.output_external_url.length > 0,
  );

  const executionCount = executions.length;
  const completedCount = completedExecutions.length;
  const outputCount = outputExecutions.length;
  const successRate = executionCount > 0 ? roundTo(completedCount / executionCount, 3) : 0;
  const avgDurationSeconds =
    durationValues.length > 0
      ? Math.round(durationValues.reduce((sum, duration) => sum + duration, 0) / durationValues.length)
      : null;
  const lastExecutedAt = executionCount > 0 ? executions[0]?.created_at ?? null : null;
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recentExecutionCount = executions.filter((execution) => {
    const timestamp = new Date(execution.created_at).getTime();
    return Number.isFinite(timestamp) && timestamp >= sevenDaysAgo;
  }).length;
  const recentOutputCount = outputExecutions.filter((execution) => {
    const timestamp = new Date(execution.created_at).getTime();
    return Number.isFinite(timestamp) && timestamp >= sevenDaysAgo;
  }).length;

  const starCount = recipeData.star_count ?? 0;
  const forkCount = recipeData.fork_count ?? 0;
  const effectScore = calculateRecipeScore({
    starCount,
    forkCount,
    executionCount,
    successRate,
    outputCount,
    recentExecutionCount,
    recentOutputCount,
  });

  const { error: updateError } = await admin
    .from("recipes")
    .update({
      execution_count: executionCount,
      exec_count: executionCount,
      success_rate: successRate,
      avg_duration_seconds: avgDurationSeconds,
      effect_score: effectScore,
      last_executed_at: lastExecutedAt,
    })
    .eq("id", recipeId);

  if (updateError) {
    throw new Error(`recalculateRecipeStats update failed: ${updateError.message}`);
  }
}
