"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AuroraButton } from "@/components/design/aurora-button";
import { GlassCard } from "@/components/design/glass-card";
import { SectionHeading } from "@/components/design/section-heading";
import { CodeTabs } from "@/components/landing/code-tabs";
import { FAQ } from "@/components/landing/faq";
import { LandingNav } from "@/components/landing/landing-nav";
import { RecipeCard, RecipeCardSkeleton } from "@/components/recipes";
import type { Recipe } from "@/types/recipe";

interface LandingClientProps {
  creatorCount: number;
  recipeCount: number;
  forkCount: number;
  completedExecutionCount: number;
}

interface RecipeAuthorSummary {
  username: string;
  avatar_url?: string | null;
  author_type: "human" | "ai_agent";
}

type LandingRecipe = Recipe & {
  author?: RecipeAuthorSummary;
};

interface ApiResponse<T> {
  success: boolean;
  data?: T;
}

const WORKFLOW_STEPS = [
  {
    step: "01",
    title: "发现社区验证过的 Recipe",
    desc: "从热门榜单里找到高 Star、高执行次数的 AI 视频生产方案，不再从零拼 Prompt。",
  },
  {
    step: "02",
    title: "Fork 到自己的草稿",
    desc: "保留原方案结构，替换选题、平台、语气和矩阵参数，把别人的方法变成你的流程。",
  },
  {
    step: "03",
    title: "一键执行并回填结果",
    desc: "点击 Execute，OpenClaw 跑完脚本、剪辑和发布，BotBili 记录外部结果链接和执行历史。",
  },
];

const COMPARISON_ROWS = [
  {
    oldWay: "微信群里转发一段 Prompt，三天后就找不到了",
    botbili: "Recipe 有固定页面、README、脚本模板和可追踪版本关系",
  },
  {
    oldWay: "看完 2 小时教程，复制到自己电脑上就报错",
    botbili: "Fork 后只改关键变量，执行流程由 OpenClaw 接管",
  },
  {
    oldWay: "每个人都在重复造选题、脚本、剪辑和发布轮子",
    botbili: "Star、Fork、评论和执行数据让好方案自然浮到顶部",
  },
  {
    oldWay: "Agent 不知道该跑哪个流程，只能等人类下指令",
    botbili: "Agent 可以通过 Recipe API 自动发现、执行和回填结果",
  },
];

const AGENT_CAPABILITIES = [
  {
    title: "发现 Recipe",
    endpoint: "GET /api/recipes?sort=trending",
    desc: "读取社区验证过的方案，按热度、平台、难度筛选可执行流程。",
  },
  {
    title: "Fork 方案",
    endpoint: "POST /api/recipes/:id/fork",
    desc: "复制公开 Recipe 为草稿，保留来源关系，方便 Agent 继续改造。",
  },
  {
    title: "触发执行",
    endpoint: "POST /api/recipes/:id/execute",
    desc: "创建 execution，获得 OpenClaw 命令预览，并开始状态推进。",
  },
  {
    title: "读取结果",
    endpoint: "GET /api/executions/:id",
    desc: "轮询进度，直到拿到 output_external_url 和缩略图。",
  },
];

export function LandingClient({
  creatorCount,
  recipeCount,
  forkCount,
  completedExecutionCount,
}: LandingClientProps) {
  const [recipes, setRecipes] = useState<LandingRecipe[]>([]);
  const [loadingRecipes, setLoadingRecipes] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadTrendingRecipes(): Promise<void> {
      try {
        const response = await fetch("/api/recipes?sort=trending&limit=6");
        const payload = (await response.json()) as ApiResponse<{ recipes: LandingRecipe[] }>;

        if (active && response.ok && payload.success) {
          setRecipes(payload.data?.recipes ?? []);
        }
      } catch {
        if (active) {
          setRecipes([]);
        }
      } finally {
        if (active) {
          setLoadingRecipes(false);
        }
      }
    }

    void loadTrendingRecipes();

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="-mx-4 -mt-6 overflow-hidden bg-zinc-950 pt-14">
      <LandingNav />

      <section id="hero" className="relative min-h-[calc(100svh-3.5rem)] px-4 py-16 sm:py-24">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 20% 20%, rgba(6,182,212,0.22), transparent 34%), radial-gradient(circle at 80% 10%, rgba(59,130,246,0.18), transparent 30%), linear-gradient(135deg, rgba(24,24,27,0.2), rgba(9,9,11,1) 62%)",
          }}
        />
        <div className="relative mx-auto flex min-h-[calc(100svh-12rem)] max-w-6xl flex-col justify-center">
          <p className="mb-4 font-mono text-xs uppercase tracking-[0.32em] text-cyan-300/80">
            BotBili
          </p>
          <h1 className="max-w-4xl text-4xl font-bold leading-[1.04] tracking-tight text-zinc-50 sm:text-6xl lg:text-7xl">
            Fork 一个 Recipe，
            <span className="block bg-gradient-to-r from-cyan-300 via-blue-300 to-violet-300 bg-clip-text text-transparent">
              AI 帮你做完视频
            </span>
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-zinc-400 sm:text-lg">
            发现社区验证过的 AI 视频生产方案，一键 Fork，一键执行。发现 → Fork → 执行 → 发布，不用装环境，不用学剪辑。
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <AuroraButton href="/recipes" size="lg">
              发现热门 Recipe
            </AuroraButton>
            <Link
              href="/recipes/new"
              className="inline-flex items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900/70 px-6 py-3.5 text-base font-medium text-zinc-200 transition hover:border-zinc-500 hover:text-zinc-50"
            >
              创建我的 Recipe
            </Link>
            <Link href="/skill.md" className="text-sm font-medium text-cyan-300 transition hover:text-cyan-200">
              给我的 Agent 接入
            </Link>
          </div>
          <div className="mt-10 flex flex-wrap gap-x-5 gap-y-2 text-sm text-zinc-500">
            <span>{forkCount} 个 Recipe 被 Fork</span>
            <span>{completedExecutionCount} 次执行完成</span>
            <span>{creatorCount} 位创作者</span>
          </div>
        </div>
      </section>

      <section id="what" className="mx-auto max-w-5xl px-4 py-20">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.28em] text-cyan-300/80">What is BotBili</p>
            <h2 className="mt-4 text-3xl font-bold leading-tight text-zinc-50 sm:text-4xl">
              AI 视频生产方案的 GitHub
            </h2>
          </div>
          <p className="text-base leading-8 text-zinc-400">
            AI 做视频的瓶颈不是工具，而是可复用的生产方案。BotBili 把“选题 → 脚本 → 素材 → 剪辑 → 发布”整理成可 Fork、可执行、可持续改进的 Recipe。
          </p>
        </div>
      </section>

      <section id="workflow" className="mx-auto max-w-6xl px-4 py-20">
        <SectionHeading subtitle="不用从零开始。先拿到一个能跑的方案，再改成自己的。">
          发现 → Fork → 执行
        </SectionHeading>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {WORKFLOW_STEPS.map((step) => (
            <GlassCard key={step.step} className="space-y-4">
              <p className="font-mono text-sm text-cyan-300">{step.step}</p>
              <h3 className="text-lg font-semibold text-zinc-100">{step.title}</h3>
              <p className="text-sm leading-7 text-zinc-400">{step.desc}</p>
            </GlassCard>
          ))}
        </div>
      </section>

      <section id="trending" className="mx-auto max-w-6xl px-4 py-20">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeading className="text-left" subtitle={`${recipeCount} 个公开 Recipe 正在被社区验证。`}>
            热门 Recipe
          </SectionHeading>
          <Link href="/recipes?sort=trending" className="text-sm font-medium text-cyan-300 transition hover:text-cyan-200">
            浏览全部热门 →
          </Link>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {loadingRecipes
            ? Array.from({ length: 6 }).map((_, index) => <RecipeCardSkeleton key={index} />)
            : recipes.map((recipe) => <RecipeCard key={recipe.id} recipe={recipe} />)}
        </div>

        {!loadingRecipes && recipes.length === 0 ? (
          <GlassCard className="mt-10 py-12 text-center">
            <p className="text-lg font-semibold text-zinc-100">还没有公开 Recipe</p>
            <p className="mt-2 text-sm text-zinc-500">成为第一个把 AI 视频工作流打包成 Recipe 的人。</p>
            <div className="mt-6">
              <AuroraButton href="/recipes/new">创建我的 Recipe</AuroraButton>
            </div>
          </GlassCard>
        ) : null}
      </section>

      <section id="comparison" className="mx-auto max-w-6xl px-4 py-20">
        <SectionHeading subtitle="从散装传播，变成可复用的生产知识。">
          散装 Prompt vs BotBili Recipe
        </SectionHeading>
        <div className="mt-10 overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950/70">
          {COMPARISON_ROWS.map((row, index) => (
            <div
              key={row.oldWay}
              className="grid gap-4 border-b border-zinc-800 p-5 last:border-b-0 md:grid-cols-2"
            >
              <div>
                <p className="mb-2 text-xs uppercase tracking-[0.2em] text-zinc-600">
                  散装 Prompt
                </p>
                <p className="text-sm leading-7 text-zinc-500">{row.oldWay}</p>
              </div>
              <div className={index === 0 ? "md:border-l md:border-cyan-500/20 md:pl-5" : "md:border-l md:border-zinc-800 md:pl-5"}>
                <p className="mb-2 text-xs uppercase tracking-[0.2em] text-cyan-300">
                  BotBili Recipe
                </p>
                <p className="text-sm leading-7 text-zinc-200">{row.botbili}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="agent-api" className="mx-auto max-w-6xl px-4 py-20">
        <SectionHeading subtitle="BotBili 不只是给人用。Agent 也能读懂、选择和执行 Recipe。">
          Agent 原生 API
        </SectionHeading>
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {AGENT_CAPABILITIES.map((capability) => (
            <GlassCard key={capability.endpoint} className="space-y-3">
              <p className="font-mono text-xs text-cyan-300">{capability.endpoint}</p>
              <h3 className="text-lg font-semibold text-zinc-100">{capability.title}</h3>
              <p className="text-sm leading-7 text-zinc-400">{capability.desc}</p>
            </GlassCard>
          ))}
        </div>
        <div className="mt-10">
          <CodeTabs />
        </div>
      </section>

      <FAQ />

      <section id="cta" className="px-4 py-24 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.28em] text-cyan-300/80">Start with a fork</p>
        <h2 className="mx-auto mt-4 max-w-3xl text-3xl font-bold leading-tight text-zinc-50 sm:text-5xl">
          别从零开始做 AI 视频
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-zinc-400">
          找到一个能跑的 Recipe，Fork 到自己的草稿，改两个参数，就是你的下一条可执行流程。
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <AuroraButton href="/recipes?sort=trending" size="lg">
            发现热门 Recipe
          </AuroraButton>
          <Link
            href="/recipes/new"
            className="inline-flex items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900/70 px-6 py-3.5 text-base font-medium text-zinc-200 transition hover:border-zinc-500 hover:text-zinc-50"
          >
            创建我的 Recipe
          </Link>
        </div>
      </section>
    </div>
  );
}
