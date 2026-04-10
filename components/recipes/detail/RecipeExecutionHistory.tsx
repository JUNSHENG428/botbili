"use client";

import { useState } from "react";

import { GlassCard } from "@/components/design/glass-card";
import { RecipeExecutionOutput } from "@/components/recipes/detail/RecipeExecutionOutput";
import { formatRelativeTime } from "@/lib/format";
import type {
  RecipeExecutionOutput as RecipeExecutionOutputData,
  RecipeExecutionStatus,
  VideoPlatform,
} from "@/types/recipe";

interface RecipeExecutionHistoryItem {
  id: string;
  status: RecipeExecutionStatus;
  command_text: string | null;
  command_preview: string | null;
  output_external_url: string | null;
  output_thumbnail_url: string | null;
  output_platform: string | null;
  output?: RecipeExecutionOutputData | null;
  created_at: string;
  updated_at: string;
}

interface RecipeExecutionHistoryProps {
  executions: RecipeExecutionHistoryItem[];
}

const STATUS_LABELS: Record<RecipeExecutionStatus, string> = {
  pending: "等待中",
  running: "执行中",
  script_done: "脚本完成",
  edit_done: "剪辑完成",
  publishing: "发布中",
  success: "已完成",
  failed: "失败",
};

// 状态徽章颜色
function getStatusDotColor(status: RecipeExecutionStatus): string {
  switch (status) {
    case "success":
      return "bg-emerald-400";
    case "failed":
      return "bg-red-400";
    case "running":
      return "bg-yellow-400 animate-pulse";
    case "pending":
      return "bg-zinc-500";
    default:
      return "bg-cyan-400";
  }
}

function getStatusClassName(status: RecipeExecutionStatus): string {
  if (status === "success") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  }
  if (status === "failed") {
    return "border-red-500/30 bg-red-500/10 text-red-300";
  }
  if (status === "pending") {
    return "border-zinc-700 bg-zinc-800/80 text-zinc-300";
  }
  return "border-cyan-500/30 bg-cyan-500/10 text-cyan-300";
}

function getOutputStatus(status: RecipeExecutionStatus): "pending" | "running" | "completed" | "failed" {
  if (status === "success") {
    return "completed";
  }
  if (status === "failed") {
    return "failed";
  }
  if (status === "pending") {
    return "pending";
  }
  return "running";
}

function normalizeExecutionOutput(execution: RecipeExecutionHistoryItem): RecipeExecutionOutputData | null {
  if (execution.output) {
    return execution.output;
  }

  if (!execution.output_external_url || !execution.output_platform) {
    return null;
  }

  return {
    platform: execution.output_platform as VideoPlatform,
    video_url: execution.output_external_url,
    title: "执行产出",
    thumbnail_url: execution.output_thumbnail_url ?? undefined,
    published_at: execution.updated_at,
  };
}

const PAGE_SIZE = 10;

export function RecipeExecutionHistory({ executions }: RecipeExecutionHistoryProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [page, setPage] = useState(0);

  // 分页逻辑
  const paginated = executions.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(executions.length / PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-zinc-100">执行历史</h2>
        <p className="text-sm text-zinc-500">
          每一次执行都像 CI 记录：状态、触发方式和 Agent 回填的外部发布结果会留在这里。
          {executions.length > 0 && (
            <span className="ml-2 text-zinc-400">共 {executions.length} 条记录</span>
          )}
        </p>
      </div>

      {executions.length === 0 ? (
        <GlassCard className="space-y-2 text-center">
          <p className="text-lg font-medium text-zinc-100">还没有执行记录</p>
          <p className="text-sm text-zinc-500">成为第一个执行者，等 Agent 回填发布结果。</p>
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {paginated.map((execution) => {
            const output = normalizeExecutionOutput(execution);
            const isExpanded = Boolean(expanded[execution.id]);
            const canShowOutput = execution.status === "success" && Boolean(output);

            return (
              <GlassCard key={execution.id} className="space-y-4 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {/* 状态圆点徽章 */}
                    <div className={`w-2.5 h-2.5 rounded-full ${getStatusDotColor(execution.status)}`} />
                    
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-zinc-200">{formatRelativeTime(execution.created_at)}</p>
                      <p className="font-mono text-xs text-zinc-500">
                        {execution.command_text ?? execution.command_preview ?? "OpenClaw 执行"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`rounded-full border px-2.5 py-1 text-xs ${getStatusClassName(execution.status)}`}>
                      {STATUS_LABELS[execution.status]}
                    </span>
                    {canShowOutput ? (
                      <button
                        type="button"
                        onClick={() =>
                          setExpanded((current) => ({
                            ...current,
                            [execution.id]: !current[execution.id],
                          }))
                        }
                        className="rounded-full border border-zinc-700 bg-zinc-950/70 px-3 py-1 text-xs text-cyan-200 transition hover:border-cyan-400/40 hover:text-cyan-100"
                      >
                        {isExpanded ? "收起产出" : "展开产出"}
                      </button>
                    ) : null}
                  </div>
                </div>

                {canShowOutput && isExpanded ? (
                  <RecipeExecutionOutput output={output} status={getOutputStatus(execution.status)} />
                ) : null}

                {execution.status === "success" && !output ? (
                  <RecipeExecutionOutput output={null} status="completed" />
                ) : null}
              </GlassCard>
            );
          })}

          {/* 分页控件 */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center pt-4">
              <button
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
                className="text-sm text-zinc-400 disabled:opacity-30 hover:text-zinc-200 transition-colors"
              >
                ← 上一页
              </button>
              <span className="text-xs text-zinc-500">
                {page + 1} / {totalPages}
              </span>
              <button
                disabled={page === totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
                className="text-sm text-zinc-400 disabled:opacity-30 hover:text-zinc-200 transition-colors"
              >
                下一页 →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
