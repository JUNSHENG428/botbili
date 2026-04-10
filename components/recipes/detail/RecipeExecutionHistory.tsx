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

export function RecipeExecutionHistory({ executions }: RecipeExecutionHistoryProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-zinc-100">执行历史</h2>
        <p className="text-sm text-zinc-500">
          每一次执行都像 CI 记录：状态、触发方式和 Agent 回填的外部发布结果会留在这里。
        </p>
      </div>

      {executions.length === 0 ? (
        <GlassCard className="space-y-2 text-center">
          <p className="text-lg font-medium text-zinc-100">还没有执行记录</p>
          <p className="text-sm text-zinc-500">成为第一个执行者，等 Agent 回填发布结果。</p>
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {executions.map((execution) => {
            const output = normalizeExecutionOutput(execution);
            const isExpanded = Boolean(expanded[execution.id]);
            const canShowOutput = execution.status === "success" && Boolean(output);

            return (
              <GlassCard key={execution.id} className="space-y-4 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-zinc-200">{formatRelativeTime(execution.created_at)}</p>
                    <p className="font-mono text-xs text-zinc-500">
                      {execution.command_text ?? execution.command_preview ?? "OpenClaw 执行"}
                    </p>
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
        </div>
      )}
    </div>
  );
}
