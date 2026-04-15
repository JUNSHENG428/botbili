"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { AuroraButton } from "@/components/design/aurora-button";
import { GhostButton } from "@/components/design/ghost-button";
import { GlassCard } from "@/components/design/glass-card";
import { FirstRecipeGuide } from "@/components/onboarding/FirstRecipeGuide";
import { EmptyStateActionCard } from "@/components/recipes/EmptyStateActionCard";
import { MyExecutionList } from "@/components/recipes/MyExecutionList";
import { MyRecipeList } from "@/components/recipes/MyRecipeList";
import { getExecutionStatusLabel } from "@/lib/executions/getExecutionStatusLabel";
import { createClient } from "@/lib/supabase/client";

interface RecipeStatRow {
  id: string;
  status: "draft" | "published" | "archived" | "moderated";
  star_count: number;
  fork_count: number;
  exec_count: number;
}

interface RecipeStats {
  totalRecipes: number;
  publishedRecipes: number;
  draftRecipes: number;
  totalStarsReceived: number;
  totalExecsReceived: number;
  monthlyForks: number;
}

function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-2xl bg-zinc-900/70" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="h-96 animate-pulse rounded-2xl bg-zinc-900/70" />
        <div className="h-96 animate-pulse rounded-2xl bg-zinc-900/70" />
      </div>
    </div>
  );
}

function LoginState() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-zinc-100">先登录，打开你的 Recipe 控制台</h1>
        <p className="max-w-xl text-sm leading-7 text-zinc-500">
          Dashboard 现在是你的 Recipe Repo 和执行记录中心。登录后就能看到自己的草稿、已发布 Repo 和最近执行状态。
        </p>
      </div>
      <AuroraButton href="/login" size="lg">
        去登录
      </AuroraButton>
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <GlassCard className="space-y-2">
      <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">{label}</p>
      <p className="text-3xl font-semibold tracking-tight text-zinc-50">{value}</p>
      <p className="text-sm text-zinc-500">{hint}</p>
    </GlassCard>
  );
}

function QuickActions() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <GlassCard className="space-y-4">
        <div className="space-y-2">
          <p className="text-lg font-semibold text-zinc-100">发现热门 Recipe</p>
          <p className="text-sm leading-7 text-zinc-500">
            先去看社区里最近有哪些 Repo 正在被大量 Star、Fork 和执行。
          </p>
        </div>
        <Link href="/recipes?sort=trending" className="text-sm text-cyan-300 transition hover:text-cyan-200">
          去热门榜 →
        </Link>
      </GlassCard>

      <GlassCard className="space-y-4">
        <div className="space-y-2">
          <p className="text-lg font-semibold text-zinc-100">创建新 Recipe</p>
          <p className="text-sm leading-7 text-zinc-500">
            把稳定的视频工作流沉淀成一个 Repo，让更多人发现和复用。
          </p>
        </div>
        <AuroraButton href="/recipes/new">创建新 Recipe</AuroraButton>
      </GlassCard>

      <GlassCard className="space-y-4">
        <div className="space-y-2">
          <p className="text-lg font-semibold text-zinc-100">设置 OpenClaw</p>
          <p className="text-sm leading-7 text-zinc-500">
            把执行闭环接到你的 Agent，上线后就能从 Recipe 一键跑到发布结果。
          </p>
        </div>
        <GhostButton href="/setup-agent">去设置</GhostButton>
      </GlassCard>
    </div>
  );
}

function ExecutionStatusGuide() {
  const guideStatuses = [
    {
      key: "pending",
      label: getExecutionStatusLabel("pending"),
      hint: "execution 已创建，等待本地 OpenClaw 主动轮询领取任务。",
    },
    {
      key: "running",
      label: getExecutionStatusLabel("running"),
      hint: "Agent 已经开始跑流程，Dashboard 会自动刷新最新进度。",
    },
    {
      key: "completed",
      label: getExecutionStatusLabel("completed"),
      hint: "执行已完成，优先回看平台、封面和外链结果是否正确。",
    },
    {
      key: "failed",
      label: getExecutionStatusLabel("failed"),
      hint: "先看错误信息，再检查 Agent 在线状态、回调密钥和平台授权。",
    },
  ] as const;

  return (
    <GlassCard className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-zinc-100">执行状态说明</h2>
        <p className="text-sm text-zinc-500">
          Dashboard 里的 execution 使用统一状态模型，历史 `success` 会按“已完成”语义展示。
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {guideStatuses.map((item) => (
          <div key={item.key} className="rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-4">
            <p className="text-sm font-medium text-zinc-100">{item.label}</p>
            <p className="mt-2 text-xs leading-6 text-zinc-500">{item.hint}</p>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

export default function DashboardPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [stats, setStats] = useState<RecipeStats>({
    totalRecipes: 0,
    publishedRecipes: 0,
    draftRecipes: 0,
    totalStarsReceived: 0,
    totalExecsReceived: 0,
    monthlyForks: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    async function loadDashboard() {
      setLoading(true);
      setError(null);

      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) {
          throw new Error(authError.message);
        }

        if (!active) {
          return;
        }

        if (!user?.id) {
          setUserId(null);
          setStats({
            totalRecipes: 0,
            publishedRecipes: 0,
            draftRecipes: 0,
            totalStarsReceived: 0,
            totalExecsReceived: 0,
            monthlyForks: 0,
          });
          return;
        }

        setUserId(user.id);

        const { data: recipeRows, error: recipeError } = await supabase
          .from("recipes")
          .select("id, status, star_count, fork_count, exec_count")
          .eq("author_id", user.id);

        if (recipeError) {
          throw new Error(recipeError.message);
        }

        const recipes = (recipeRows ?? []) as RecipeStatRow[];
        const recipeIds = recipes.map((recipe) => recipe.id);
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);

        let monthlyForks = 0;

        if (recipeIds.length > 0) {
          const { count: forkCount, error: forkError } = await supabase
            .from("recipe_forks")
            .select("id", { count: "exact", head: true })
            .in("original_recipe_id", recipeIds)
            .gte("created_at", monthStart.toISOString());

          if (!forkError) {
            monthlyForks = forkCount ?? 0;
          }
        }

        if (!active) {
          return;
        }

        setStats({
          totalRecipes: recipes.length,
          publishedRecipes: recipes.filter((recipe) => recipe.status === "published").length,
          draftRecipes: recipes.filter((recipe) => recipe.status === "draft").length,
          totalStarsReceived: recipes.reduce((sum, recipe) => sum + (recipe.star_count ?? 0), 0),
          totalExecsReceived: recipes.reduce((sum, recipe) => sum + (recipe.exec_count ?? 0), 0),
          monthlyForks,
        });
      } catch (loadError) {
        if (!active) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : "加载 Dashboard 失败");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    function handleRefresh() {
      void loadDashboard();
    }

    void loadDashboard();
    window.addEventListener("botbili-dashboard-refresh", handleRefresh);

    return () => {
      active = false;
      window.removeEventListener("botbili-dashboard-refresh", handleRefresh);
    };
  }, []);

  const totalKpis = useMemo(
    () => [
      {
        label: "我的 Recipe",
        value: `${stats.totalRecipes}`,
        hint: `草稿 ${stats.draftRecipes} · 已发布 ${stats.publishedRecipes}`,
      },
      {
        label: "收到的 Star",
        value: `${stats.totalStarsReceived}`,
        hint: "所有 Repo 的公开认可总和",
      },
      {
        label: "收到的执行",
        value: `${stats.totalExecsReceived}`,
        hint: "别人真正跑过多少次你的 Recipe",
      },
      {
        label: "本月新增 Fork",
        value: `${stats.monthlyForks}`,
        hint: "这个月新增的共创复制量",
      },
    ],
    [stats],
  );

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (!userId) {
    return <LoginState />;
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 px-4 py-12 text-center">
        <h1 className="text-2xl font-semibold text-zinc-100">Dashboard 暂时没加载出来</h1>
        <p className="text-sm text-zinc-500">{error}</p>
        <GhostButton onClick={() => window.location.reload()}>刷新页面</GhostButton>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
      <section className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-50">Recipe 控制台</h1>
        <p className="max-w-3xl text-sm leading-7 text-zinc-500">
          这里是你每天回来看状态的地方：管理自己的 Recipe Repo，盯执行结果，顺手决定今天该发布哪份方案。
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {totalKpis.map((kpi) => (
          <KpiCard key={kpi.label} label={kpi.label} value={kpi.value} hint={kpi.hint} />
        ))}
      </section>

      <QuickActions />
      <ExecutionStatusGuide />

      {stats.totalRecipes === 0 && stats.totalExecsReceived === 0 ? (
        <section className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <EmptyStateActionCard
              icon="🚀"
              title="先跑通第一条公开 Recipe"
              description="如果你还没有任何 Recipe 和执行记录，先去挑一条新手友好的公开 Recipe，把 Agent 链路跑通。"
              actionLabel="去看新手友好 Recipe"
              actionHref="/recipes?sort=trending&difficulty=beginner"
              secondaryLabel="打开 onboarding"
              secondaryHref="/onboarding"
            />
            <EmptyStateActionCard
              icon="🦞"
              title="把 Agent 接上 BotBili"
              description="你的本地 Agent 接通后，才会开始领取 execution、执行 Recipe，并把公开视频结果回填回来。"
              actionLabel="去连接 Agent"
              actionHref="/setup-agent"
              secondaryLabel="先看 onboarding"
              secondaryHref="/onboarding?step=3"
            />
          </div>

          <GlassCard className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-zinc-100">直接选一条 starter Recipe</h2>
              <p className="text-sm leading-7 text-zinc-500">
                这些推荐优先考虑步骤少、成功率更稳、并且已经有人公开回填结果，适合拿来做第一条样板。
              </p>
            </div>
            <FirstRecipeGuide />
          </GlassCard>
        </section>
      ) : null}

      <section className="space-y-6">
        <MyRecipeList userId={userId} />
        <MyExecutionList userId={userId} />
      </section>
    </div>
  );
}
