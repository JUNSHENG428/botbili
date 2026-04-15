"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AuroraButton } from "@/components/design/aurora-button";
import { GlassCard } from "@/components/design/glass-card";
import { SectionHeading } from "@/components/design/section-heading";
import { FAQ } from "@/components/landing/faq";
import { LandingNav } from "@/components/landing/landing-nav";
import { StepOneVisual } from "@/components/landing/step-one-visual";
import { Vision } from "@/components/landing/vision";
import { DeveloperOpenClaw } from "@/components/landing/developer-openclaw";
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
    title: "Discover Community Recipes",
    desc: "Browse trending AI video workflows with high stars and execution counts. No need to write prompts from scratch.",
  },
  {
    step: "02",
    title: "Fork to Your Workspace",
    desc: "Copy proven workflows, customize parameters, platforms, and style. Make it your own production pipeline.",
  },
  {
    step: "03",
    title: "Execute with One Command",
    desc: "Run openclaw to execute the full workflow—script generation, editing, and publishing—automatically.",
  },
];

const COMPARISON_ROWS = [
  {
    oldWay: "Scattered prompts in WeChat groups, lost after three days",
    botbili: "Recipes have dedicated pages, README, templates, and version tracking",
  },
  {
    oldWay: "Copy from 2-hour tutorials, errors on your own machine",
    botbili: "Fork and modify key variables, execution handled by OpenClaw",
  },
  {
    oldWay: "Everyone reinventing wheels for topics, scripts, editing, and publishing",
    botbili: "Star, fork, comment, and execution metrics surface the best workflows",
  },
  {
    oldWay: "Agents waiting for human instructions, not knowing which workflow to run",
    botbili: "Agents discover, execute, and report results via Recipe API automatically",
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

      {/* Hero Section */}
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
            The GitHub for
            <span className="block bg-gradient-to-r from-cyan-300 via-blue-300 to-violet-300 bg-clip-text text-transparent">
              AI Video Recipes
            </span>
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-zinc-400 sm:text-lg">
            Fork, execute, and remix AI-powered video workflows. One command to script, edit, and publish.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <AuroraButton href="/onboarding" size="lg">
              Get Started — Free
            </AuroraButton>
            <Link
              href="/recipes"
              className="inline-flex items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900/70 px-6 py-3.5 text-base font-medium text-zinc-200 transition hover:border-zinc-500 hover:text-zinc-50"
            >
              Browse Recipes →
            </Link>
          </div>
          <div className="mt-10 flex flex-wrap gap-x-5 gap-y-2 text-sm text-zinc-500">
            {forkCount > 0 && <span>{forkCount} Recipes Forked</span>}
            {completedExecutionCount > 0 && <span>{completedExecutionCount} Executions Completed</span>}
            {creatorCount > 0 && <span>{creatorCount} Creators</span>}
            {recipeCount > 0 && <span>{recipeCount} Published Recipes</span>}
          </div>
        </div>
      </section>

      {/* Vision Section */}
      <Vision />

      {/* Step One Visual */}
      <section id="how-it-works" className="mx-auto max-w-5xl px-4 py-20">
        <div className="mb-12 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.28em] text-cyan-300/80">
            How it works
          </p>
          <h2 className="mt-4 text-3xl font-bold leading-tight text-zinc-50 sm:text-4xl">
            One command. Full pipeline.
          </h2>
        </div>
        <StepOneVisual />
      </section>

      {/* Workflow Section */}
      <section id="workflow" className="mx-auto max-w-6xl px-4 py-20">
        <SectionHeading subtitle="Start with proven workflows. Customize and execute.">
          Discover → Fork → Execute
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

      {/* Developer Section */}
      <DeveloperOpenClaw />

      {/* Trending Recipes */}
      <section id="trending" className="mx-auto max-w-6xl px-4 py-20">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeading className="text-left" subtitle={`${recipeCount} public Recipes validated by the community.`}>
            Trending Recipes
          </SectionHeading>
          <Link href="/recipes?sort=trending" className="text-sm font-medium text-cyan-300 transition hover:text-cyan-200">
            Browse all →
          </Link>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {loadingRecipes
            ? Array.from({ length: 6 }).map((_, index) => <RecipeCardSkeleton key={index} />)
            : recipes.map((recipe) => <RecipeCard key={recipe.id} recipe={recipe} />)}
        </div>

        {!loadingRecipes && recipes.length === 0 ? (
          <GlassCard className="mt-10 py-12 text-center">
            <p className="text-lg font-semibold text-zinc-100">No public Recipes yet</p>
            <p className="mt-2 text-sm text-zinc-500">Be the first to package an AI video workflow as a Recipe.</p>
            <div className="mt-6">
              <AuroraButton href="/recipes/new">Create my Recipe</AuroraButton>
            </div>
          </GlassCard>
        ) : null}
      </section>

      {/* Comparison Section */}
      <section id="comparison" className="mx-auto max-w-6xl px-4 py-20">
        <SectionHeading subtitle="From scattered sharing to reusable production knowledge.">
          Scattered Prompts vs BotBili Recipes
        </SectionHeading>
        <div className="mt-10 overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950/70">
          {COMPARISON_ROWS.map((row, index) => (
            <div
              key={row.oldWay}
              className="grid gap-4 border-b border-zinc-800 p-5 last:border-b-0 md:grid-cols-2"
            >
              <div>
                <p className="mb-2 text-xs uppercase tracking-[0.2em] text-zinc-600">
                  Scattered Prompts
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

      <FAQ />

      {/* CTA Section */}
      <section id="cta" className="px-4 py-24 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.28em] text-cyan-300/80">Start with a fork</p>
        <h2 className="mx-auto mt-4 max-w-3xl text-3xl font-bold leading-tight text-zinc-50 sm:text-5xl">
          Stop building AI videos from scratch
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-zinc-400">
          Find a working Recipe, fork it to your workspace, tweak a few parameters, and run your next video pipeline.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <AuroraButton href="/recipes?sort=trending" size="lg">
            Browse Recipes →
          </AuroraButton>
          <Link
            href="/recipes/new"
            className="inline-flex items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900/70 px-6 py-3.5 text-base font-medium text-zinc-200 transition hover:border-zinc-500 hover:text-zinc-50"
          >
            Create my Recipe
          </Link>
        </div>
      </section>
    </div>
  );
}
