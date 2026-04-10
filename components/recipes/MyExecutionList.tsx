"use client";

import { useEffect, useMemo, useState } from "react";

import { GlassCard } from "@/components/design/glass-card";
import { createClient } from "@/lib/supabase/client";
import { formatRelativeTime } from "@/lib/format";
import type { RecipeExecutionStatus } from "@/types/recipe";
import { SparkLine } from "./SparkLine";

interface MyExecutionListProps {
  userId: string;
}

interface ExecutionRow {
  id: string;
  recipe_id: string;
  status: RecipeExecutionStatus;
  progress_pct: number | null;
  output_external_url: string | null;
  output_thumbnail_url: string | null;
  output_platform: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

interface RecipeTitleRow {
  id: string;
  title: string;
}

interface ExecutionTrend {
  date: string;
  count: number;
}

const STATUS_CLASS_NAMES: Record<RecipeExecutionStatus, string> = {
  pending: "border-zinc-700 bg-zinc-800/80 text-zinc-300",
  running: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
  script_done: "border-sky-500/30 bg-sky-500/10 text-sky-300",
  edit_done: "border-violet-500/30 bg-violet-500/10 text-violet-300",
  publishing: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  failed: "border-red-500/30 bg-red-500/10 text-red-300",
};

const STATUS_LABELS: Record<RecipeExecutionStatus, string> = {
  pending: "等待中",
  running: "执行中",
  script_done: "脚本完成",
  edit_done: "剪辑完成",
  publishing: "发布中",
  success: "已完成",
  failed: "失败",
};

function getExecutionProgress(execution: ExecutionRow): number {
  if (typeof execution.progress_pct === "number" && execution.progress_pct >= 0) {
    return execution.progress_pct;
  }

  switch (execution.status) {
    case "pending":
      return 0;
    case "running":
      return 10;
    case "script_done":
      return 35;
    case "edit_done":
      return 65;
    case "publishing":
      return 85;
    case "success":
      return 100;
    case "failed":
      return 100;
    default:
      return 0;
  }
}

export function MyExecutionList({ userId }: MyExecutionListProps) {
  const [executions, setExecutions] = useState<ExecutionRow[]>([]);
  const [recipeTitles, setRecipeTitles] = useState<Record<string, string>>({});
  const [executionTrends, setExecutionTrends] = useState<ExecutionTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    async function loadExecutions() {
      try {
        if (active) {
          setLoading(true);
          setError(null);
        }

        const { data, error: executionsError } = await supabase
          .from("recipe_executions")
          .select("id, recipe_id, status, progress_pct, output_external_url, output_thumbnail_url, output_platform, error_message, created_at, updated_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(20);

        if (executionsError) {
          throw new Error(executionsError.message);
        }

        const nextExecutions = (data ?? []) as ExecutionRow[];
        const recipeIds = [...new Set(nextExecutions.map((item) => item.recipe_id))];

        let nextTitles: Record<string, string> = {};
        if (recipeIds.length > 0) {
          const { data: recipeRows, error: recipeError } = await supabase
            .from("recipes")
            .select("id, title")
            .in("id", recipeIds);

          if (recipeError) {
            throw new Error(recipeError.message);
          }

          nextTitles = ((recipeRows ?? []) as RecipeTitleRow[]).reduce<Record<string, string>>((acc, recipe) => {
            acc[recipe.id] = recipe.title;
            return acc;
          }, {});
        }

        // Load execution trends (past 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const { data: trendData, error: trendError } = await supabase
          .from("recipe_executions")
          .select("created_at")
          .eq("user_id", userId)
          .gte("created_at", sevenDaysAgo.toISOString())
          .order("created_at", { ascending: true });

        let trends: ExecutionTrend[] = [];
        if (!trendError && trendData) {
          const countsByDate = new Map<string, number>();
          for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split("T")[0];
            countsByDate.set(dateStr, 0);
          }

          for (const row of trendData) {
            const dateStr = new Date(row.created_at).toISOString().split("T")[0];
            countsByDate.set(dateStr, (countsByDate.get(dateStr) ?? 0) + 1);
          }

          trends = Array.from(countsByDate.entries())
            .map(([date, count]) => ({ date, count }))
            .sort((a, b) => a.date.localeCompare(b.date));
        }

        if (!active) {
          return;
        }

        setExecutions(nextExecutions);
        setRecipeTitles(nextTitles);
        setExecutionTrends(trends);
      } catch (loadErr) {
        if (!active) {
          return;
        }

        setError(loadErr instanceof Error ? loadErr.message : "加载执行记录失败");
        setExecutions([]);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    function handleRefresh() {
      void loadExecutions();
    }

    void loadExecutions();
    window.addEventListener("botbili-dashboard-refresh", handleRefresh);

    return () => {
      active = false;
      window.removeEventListener("botbili-dashboard-refresh", handleRefresh);
    };
  }, [userId]);

  const hasRunningExecution = useMemo(
    () => executions.some((execution) => execution.status === "pending" || execution.status === "running"),
    [executions],
  );

  useEffect(() => {
    if (!hasRunningExecution) {
      return;
    }

    const intervalId = window.setInterval(() => {
      window.dispatchEvent(new CustomEvent("botbili-dashboard-refresh"));
    }, 3000);

    return () => window.clearInterval(intervalId);
  }, [hasRunningExecution]);

  const totalRecentExecutions = useMemo(
    () => executionTrends.reduce((sum, t) => sum + t.count, 0),
    [executionTrends],
  );

  if (loading) {
    return (
      <GlassCard className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-zinc-100">我的执行记录</h2>
          <p className="text-sm text-zinc-500">正在同步最近的 Recipe 执行结果…</p>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-2xl bg-zinc-900/70" />
          ))}
        </div>
      </GlassCard>
    );
  }

  if (error) {
    return (
      <GlassCard className="space-y-2">
        <h2 className="text-lg font-semibold text-zinc-100">我的执行记录</h2>
        <p className="text-sm text-red-300">加载失败：{error}</p>
      </GlassCard>
    );
  }

  if (executions.length === 0) {
    return (
      <GlassCard className="space-y-4 py-10 text-center">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-zinc-100">还没有执行记录</h2>
          <p className="mx-auto max-w-xl text-sm leading-7 text-zinc-500">
            先去发现一个热门 Recipe，执行一次之后，这里就会变成你每天回来看状态的控制台。
          </p>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="space-y-5">
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-100">我的执行记录</h2>
          {executionTrends.length > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-zinc-500">过去7天: {totalRecentExecutions} 次</span>
              <SparkLine data={executionTrends} />
            </div>
          )}
        </div>
        <p className="text-sm text-zinc-500">最近 20 条执行。只要还有任务在跑，这里会每 3 秒自动刷新。</p>
      </div>

      <div className="space-y-3">
        {executions.map((execution) => {
          const progress = getExecutionProgress(execution);
          const recipeTitle = recipeTitles[execution.recipe_id] ?? "未命名 Recipe";

          return (
            <div
              key={execution.id}
              className="space-y-3 rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-4"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-zinc-100">{recipeTitle}</p>
                  <p className="text-xs text-zinc-500">
                    执行于 {formatRelativeTime(execution.created_at)} · ID {execution.id.slice(0, 8)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className={`rounded-full border px-2.5 py-1 text-xs ${STATUS_CLASS_NAMES[execution.status]}`}>
                    {STATUS_LABELS[execution.status]}
                  </span>
                  {execution.output_external_url ? (
                    <a
                      href={execution.output_external_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-cyan-300 transition hover:text-cyan-200"
                    >
                      查看结果 →
                    </a>
                  ) : null}
                </div>
              </div>

              <div className="space-y-2">
                <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className={`h-full rounded-full transition-all ${
                      execution.status === "failed" ? "bg-red-400" : "bg-cyan-400"
                    }`}
                    style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
                  <span>进度 {progress}%</span>
                  {execution.output_platform ? <span>平台：{execution.output_platform}</span> : null}
                  {execution.error_message ? <span className="text-red-300">{execution.error_message}</span> : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}
