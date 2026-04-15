"use client";

import { useState } from "react";

import { GlassCard } from "@/components/design/glass-card";
import { RecipeExecutionOutput } from "@/components/recipes/detail/RecipeExecutionOutput";
import {
  getExecutionFailureSuggestions,
  getExecutionOutputDisplayStatus,
  getExecutionStatusClassName,
  getExecutionStatusDotClassName,
  getExecutionStatusLabel,
  isExecutionCompletedStatus,
  isExecutionFailedStatus,
} from "@/lib/executions/getExecutionStatusLabel";
import { normalizeExecutionOutput } from "@/lib/executions/normalizeExecutionOutput";
import { formatRelativeTime } from "@/lib/format";
import type { RecipeExecutionHistoryItem as RecipeExecutionHistoryRow } from "@/types/recipe";

interface RecipeExecutionHistoryProps {
  executions: RecipeExecutionHistoryRow[];
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
            const output = normalizeExecutionOutput(execution, "执行产出");
            const isExpanded = Boolean(expanded[execution.id]);
            const canShowOutput = isExecutionCompletedStatus(execution.status) && Boolean(output);
            const failureSuggestions = isExecutionFailedStatus(execution.status)
              ? getExecutionFailureSuggestions(execution.error_message)
              : [];

            return (
              <GlassCard key={execution.id} className="space-y-4 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {/* 状态圆点徽章 */}
                    <div className={`w-2.5 h-2.5 rounded-full ${getExecutionStatusDotClassName(execution.status)}`} />
                    
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-zinc-200">{formatRelativeTime(execution.created_at)}</p>
                      <p className="font-mono text-xs text-zinc-500">
                        {execution.command_text ?? execution.command_preview ?? "OpenClaw 执行"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`rounded-full border px-2.5 py-1 text-xs ${getExecutionStatusClassName(execution.status)}`}>
                      {getExecutionStatusLabel(execution.status)}
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

                {execution.status === "pending" ? (
                  <p className="text-xs leading-6 text-zinc-500">
                    这条记录已经创建成功，正在等待本地 Agent 主动领取。
                  </p>
                ) : null}

                {canShowOutput && isExpanded ? (
                  <RecipeExecutionOutput
                    output={output}
                    status={getExecutionOutputDisplayStatus(execution.status)}
                  />
                ) : null}

                {isExecutionCompletedStatus(execution.status) && !output ? (
                  <RecipeExecutionOutput output={null} status="completed" />
                ) : null}

                {isExecutionFailedStatus(execution.status) ? (
                  <div className="rounded-xl border border-red-500/15 bg-red-500/5 p-3 text-xs leading-6 text-red-100/80">
                    <p className="font-medium text-red-300">
                      {execution.error_message ?? "执行失败，当前没有可展示的发布结果。"}
                    </p>
                    <div className="mt-2 space-y-1">
                      {failureSuggestions.map((suggestion) => (
                        <p key={suggestion}>• {suggestion}</p>
                      ))}
                    </div>
                  </div>
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
