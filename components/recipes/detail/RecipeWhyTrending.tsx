import { GlassCard } from "@/components/design/glass-card";
import { formatRelativeTime } from "@/lib/format";
import type { Recipe } from "@/types/recipe";

interface RecipeWhyTrendingProps {
  recipe: Pick<
    Recipe,
    "execution_count" | "success_rate" | "output_count" | "last_executed_at" | "fork_count" | "effect_score"
  >;
}

export function RecipeWhyTrending({ recipe }: RecipeWhyTrendingProps) {
  const executionCount = recipe.execution_count ?? 0;
  const outputCount = recipe.output_count ?? 0;
  const successRate = recipe.success_rate ?? 0;

  const reasons = [
    {
      title: "执行闭环",
      value: executionCount > 0 ? `${executionCount} 次执行` : "刚开始积累",
      hint: executionCount > 0 ? "这不是空壳模板，已经有人真正跑过。" : "执行数据还在形成，适合抢先占位。",
    },
    {
      title: "真实输出",
      value: outputCount > 0 ? `${outputCount} 条公开视频` : "暂无公开输出",
      hint: outputCount > 0 ? "有公开结果，转化新手会更快。" : "第一批公开结果会直接抬高可信度。",
    },
    {
      title: "成功率",
      value: executionCount > 0 ? `${Math.round(successRate * 100)}%` : "待验证",
      hint: executionCount > 0 ? "成功率越高，越适合作为可复制模板。" : "需要更多执行样本来验证稳定性。",
    },
    {
      title: "最近活跃",
      value: recipe.last_executed_at ? formatRelativeTime(recipe.last_executed_at) : "暂无最近执行",
      hint: recipe.last_executed_at ? "最近还有人在跑，说明这条 Recipe 还活着。" : "长期没有执行的 Recipe 往往会失去参考价值。",
    },
  ];

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-zinc-100">为什么它在升温</h2>
        <p className="text-sm text-zinc-500">
          这不是抽象的“热门”标签。BotBili 用执行次数、成功率、公开输出和最近活跃度来解释这条 Recipe 的价值。
          <span className="ml-2 text-zinc-400">当前效果分 {recipe.effect_score?.toFixed(2) ?? "0.00"}</span>
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {reasons.map((reason) => (
          <GlassCard key={reason.title} className="space-y-2 border-zinc-800/90 bg-zinc-950/70">
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">{reason.title}</p>
            <p className="text-lg font-semibold text-zinc-100">{reason.value}</p>
            <p className="text-sm leading-6 text-zinc-500">{reason.hint}</p>
          </GlassCard>
        ))}
      </div>
    </section>
  );
}
