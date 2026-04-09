import Link from "next/link";

import { GlassCard } from "@/components/design/glass-card";
import { formatRelativeTime } from "@/lib/format";

interface RecipeExecutionHistoryItem {
  id: string;
  output_external_url: string | null;
  output_thumbnail_url: string | null;
  output_platform: string | null;
  created_at: string;
}

interface RecipeExecutionHistoryProps {
  executions: RecipeExecutionHistoryItem[];
}

export function RecipeExecutionHistory({ executions }: RecipeExecutionHistoryProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-zinc-100">执行成果</h2>
        <p className="text-sm text-zinc-500">这些外链视频都由当前 Recipe 跑出来，像 CI 成功记录一样可追溯。</p>
      </div>

      {executions.length === 0 ? (
        <GlassCard className="space-y-2 text-center">
          <p className="text-lg font-medium text-zinc-100">还没有执行记录</p>
          <p className="text-sm text-zinc-500">还没有执行记录，成为第一个执行者。</p>
        </GlassCard>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {executions.map((execution) => (
            <Link
              key={execution.id}
              href={execution.output_external_url || "#"}
              target={execution.output_external_url ? "_blank" : undefined}
              rel={execution.output_external_url ? "noreferrer" : undefined}
              className="group"
            >
              <GlassCard className="h-full space-y-4 transition hover:border-cyan-500/30">
                <div className="relative aspect-video overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
                  {execution.output_thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={execution.output_thumbnail_url}
                      alt={execution.output_platform || "执行结果"}
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-zinc-500">暂无缩略图</div>
                  )}
                </div>

                <div className="space-y-1">
                  <p className="text-sm font-medium text-zinc-100">
                    {execution.output_platform || "外部平台"} · 由该 Recipe 生成
                  </p>
                  <p className="text-xs text-zinc-500">{formatRelativeTime(execution.created_at)}</p>
                </div>
              </GlassCard>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
