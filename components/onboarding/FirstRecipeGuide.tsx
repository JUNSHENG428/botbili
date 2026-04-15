"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { GlassCard } from "@/components/design/glass-card";

interface StarterRecipe {
  id: string;
  slug: string;
  title: string;
  difficulty: string;
  execution_count?: number;
  success_rate?: number;
  output_count?: number;
}

interface StarterResponse {
  success: boolean;
  data?: {
    recipes: StarterRecipe[];
  };
}

export function FirstRecipeGuide() {
  const [recipes, setRecipes] = useState<StarterRecipe[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadStarterRecipes() {
      try {
        const response = await fetch("/api/recipes/recommended?limit=3&mode=starter");
        const payload = (await response.json()) as StarterResponse;

        if (!active || !response.ok || !payload.success || !payload.data) {
          setRecipes([]);
          return;
        }

        setRecipes(payload.data.recipes);
      } catch {
        if (active) {
          setRecipes([]);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadStarterRecipes();

    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="grid gap-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900/60" />
        ))}
      </div>
    );
  }

  if (recipes.length === 0) {
    return (
      <GlassCard className="space-y-3 border-zinc-800/80 bg-zinc-950/60">
        <p className="text-base font-semibold text-zinc-100">先从公开 Recipe 开始</p>
        <p className="text-sm leading-7 text-zinc-500">
          找一条步骤少、成功率高、已经有人公开回填结果的 Recipe，第一次跑通会比从零写工作流更快。
        </p>
        <Link href="/recipes?sort=trending&difficulty=beginner" className="text-sm text-cyan-300 transition hover:text-cyan-200">
          去看新手友好 Recipe →
        </Link>
      </GlassCard>
    );
  }

  return (
    <div className="grid gap-3">
      {recipes.map((recipe) => (
        <Link
          key={recipe.id}
          href={`/recipes/${recipe.slug || recipe.id}`}
          className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 text-left transition hover:border-cyan-500/30 hover:bg-zinc-900"
        >
          <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-zinc-500">
            <span className="rounded-full border border-zinc-700 px-2 py-1 text-cyan-300">新手友好</span>
            <span>{recipe.difficulty}</span>
          </div>
          <p className="mt-3 text-base font-semibold text-zinc-100">{recipe.title}</p>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500">
            {typeof recipe.execution_count === "number" ? <span>▶ {recipe.execution_count} 次执行</span> : null}
            {typeof recipe.success_rate === "number" ? (
              <span>✓ {Math.round(recipe.success_rate * 100)}% 成功率</span>
            ) : null}
            {typeof recipe.output_count === "number" ? <span>📺 {recipe.output_count} 条公开结果</span> : null}
          </div>
          <div className="mt-4 flex items-center justify-between text-xs text-zinc-500">
            <span>步骤少，适合先跑通一次</span>
            <span className="text-cyan-300">打开详情页 →</span>
          </div>
        </Link>
      ))}
    </div>
  );
}
