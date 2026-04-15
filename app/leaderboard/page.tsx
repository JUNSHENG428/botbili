import Link from "next/link";
import type { Metadata } from "next";

import { GlassCard } from "@/components/design/glass-card";
import { getBaseUrl } from "@/lib/utils";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "排行榜",
  description: "BotBili Recipe 效果榜、执行榜与贡献者声誉榜",
};

type LeaderboardType = "effect_score" | "execution_count" | "success_rate" | "contributor";

interface LeaderboardItem {
  rank: number;
  delta: number | "new";
  primary_value: number;
  primary_label: string;
  execution_count?: number;
  success_rate?: number;
  secondary_text?: string;
  recipe?: {
    id: string;
    slug: string;
    title: string;
    author: {
      id: string;
      username: string;
      display_name: string | null;
      avatar_url: string | null;
    };
  };
  contributor?: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    level: string;
    total_points: number;
    recipe_points: number;
    execution_points: number;
    review_points: number;
  };
}

interface LeaderboardResponse {
  success: boolean;
  data?: {
    type: LeaderboardType;
    items: LeaderboardItem[];
  };
}

interface LeaderboardPageProps {
  searchParams: Promise<{
    type?: string;
  }>;
}

const TABS: Array<{ value: LeaderboardType; label: string }> = [
  { value: "effect_score", label: "综合效果" },
  { value: "execution_count", label: "执行次数" },
  { value: "success_rate", label: "成功率" },
  { value: "contributor", label: "贡献者" },
];

const TAB_DESCRIPTIONS: Record<LeaderboardType, string> = {
  effect_score: "综合执行次数、公开输出、成功率和最近活跃度，优先把真正能跑出结果的 Recipe 顶上来。",
  execution_count: "看哪条 Recipe 被执行得最多，适合判断社区正在集中验证哪些方案。",
  success_rate: "只统计至少 10 次执行的 Recipe，避免 1 次成功的低样本条目虚高。",
  contributor: "高质量作者会在这里积累平台内的身份资产，这部分声誉不能被外部平台直接复制。",
};

function formatPrimaryValue(item: LeaderboardItem): string {
  if (item.primary_label === "成功率") {
    return `${Math.round(item.primary_value)}%`;
  }

  return Number.isInteger(item.primary_value) ? `${item.primary_value}` : item.primary_value.toFixed(1);
}

function formatDelta(delta: number | "new"): string {
  if (delta === "new") {
    return "new";
  }

  if (delta > 0) {
    return `+${delta}`;
  }

  if (delta < 0) {
    return `${delta}`;
  }

  return "0";
}

function getDeltaClassName(delta: number | "new"): string {
  if (delta === "new") {
    return "text-cyan-300";
  }

  if (delta > 0) {
    return "text-emerald-300";
  }

  if (delta < 0) {
    return "text-rose-300";
  }

  return "text-zinc-500";
}

async function fetchLeaderboard(type: LeaderboardType): Promise<LeaderboardItem[]> {
  try {
    const response = await fetch(`${getBaseUrl()}/api/leaderboard?type=${type}&limit=50`, {
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as LeaderboardResponse;
    return payload.data?.items ?? [];
  } catch {
    return [];
  }
}

export default async function LeaderboardPage({ searchParams }: LeaderboardPageProps) {
  const resolvedSearchParams = await searchParams;
  const type = (resolvedSearchParams.type as LeaderboardType | undefined) ?? "effect_score";
  const activeType = TABS.some((tab) => tab.value === type) ? type : "effect_score";
  const items = await fetchLeaderboard(activeType);
  const medals = ["🥇", "🥈", "🥉"];

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-zinc-100">Recipe 排行榜</h1>
          <p className="text-sm text-zinc-500">
            从“谁最火”升级为“谁真的有效”。榜单由执行闭环、社区信号和贡献者声誉共同驱动。
          </p>
        </div>

        <div className="flex gap-1 rounded-lg border border-zinc-800 bg-zinc-950/50 p-1">
          {TABS.map((tab) => (
            <Link
              key={tab.value}
              href={`/leaderboard?type=${tab.value}`}
              className={`flex-1 rounded-md px-3 py-2 text-center text-sm transition ${
                activeType === tab.value
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        <GlassCard className="space-y-2 border-zinc-800/80 bg-zinc-950/60">
          <p className="text-sm font-medium text-zinc-100">{TABS.find((tab) => tab.value === activeType)?.label}</p>
          <p className="text-sm leading-7 text-zinc-500">{TAB_DESCRIPTIONS[activeType]}</p>
        </GlassCard>

        {items.length === 0 ? (
          <div className="py-20 text-center text-zinc-500">
            <p>暂无排行数据</p>
            <p className="mt-1 text-sm text-zinc-600">
              当执行结果、Fork 链路和贡献者积分开始累计后，这里会自动刷新。
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => {
              const isTop3 = item.rank <= 3;
              const href = item.recipe
                ? `/recipes/${item.recipe.slug || item.recipe.id}`
                : item.contributor
                  ? `/u/${item.contributor.username}`
                  : "/leaderboard";
              const title = item.recipe?.title ?? item.contributor?.display_name ?? item.contributor?.username ?? "Unknown";
              const subtitle = item.recipe
                ? `作者 @${item.recipe.author.username}`
                : `等级 ${item.contributor?.level ?? "newcomer"}`;

              return (
                <Link key={`${activeType}-${item.rank}-${title}`} href={href}>
                  <GlassCard
                    className={`flex items-center gap-4 transition hover:border-zinc-600 ${
                      isTop3 ? "border-cyan-500/20" : ""
                    }`}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center text-lg">
                      {isTop3 ? (
                        medals[item.rank - 1]
                      ) : (
                        <span className="text-sm font-bold text-zinc-600">{item.rank}</span>
                      )}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-zinc-100">{title}</p>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500">
                        <span>{subtitle}</span>
                        {item.execution_count !== undefined ? <span>▶ {item.execution_count} 次执行</span> : null}
                        {item.success_rate !== undefined ? (
                          <span>✓ {Math.round(item.success_rate * 100)}% 成功率</span>
                        ) : null}
                        {item.secondary_text ? <span>{item.secondary_text}</span> : null}
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-lg font-bold text-cyan-400">{formatPrimaryValue(item)}</p>
                      <p className="text-xs text-zinc-600">{item.primary_label}</p>
                    </div>

                    <div className="w-10 shrink-0 text-right">
                      <p className={`text-sm font-medium ${getDeltaClassName(item.delta)}`}>
                        {formatDelta(item.delta)}
                      </p>
                      <p className="text-[11px] text-zinc-600">本周变化</p>
                    </div>
                  </GlassCard>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
