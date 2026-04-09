"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AuroraButton } from "@/components/design/aurora-button";
import { GlassCard } from "@/components/design/glass-card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { formatRelativeTime } from "@/lib/format";

interface MyRecipeListProps {
  userId: string;
}

interface RecipeRow {
  id: string;
  title: string;
  slug: string;
  status: "draft" | "published" | "archived" | "moderated";
  visibility: "public" | "unlisted" | "private";
  star_count: number;
  fork_count: number;
  exec_count: number;
  updated_at: string;
  created_at: string;
}

const STATUS_ORDER: Record<RecipeRow["status"], number> = {
  published: 0,
  draft: 1,
  archived: 2,
  moderated: 3,
};

const STATUS_CLASS_NAMES: Record<RecipeRow["status"], string> = {
  published: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  draft: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  archived: "border-zinc-700 bg-zinc-800/80 text-zinc-400",
  moderated: "border-red-500/30 bg-red-500/10 text-red-300",
};

function sortRecipes(rows: RecipeRow[]): RecipeRow[] {
  return [...rows].sort((left, right) => {
    const statusCompare = STATUS_ORDER[left.status] - STATUS_ORDER[right.status];
    if (statusCompare !== 0) {
      return statusCompare;
    }

    return new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime();
  });
}

function RecipeStatusBadge({ status }: { status: RecipeRow["status"] }) {
  const label =
    status === "published"
      ? "已发布"
      : status === "draft"
        ? "草稿"
        : status === "archived"
          ? "已归档"
          : "待处理";

  return (
    <span className={`rounded-full border px-2.5 py-1 text-xs ${STATUS_CLASS_NAMES[status]}`}>
      {label}
    </span>
  );
}

export function MyRecipeList({ userId }: MyRecipeListProps) {
  const { toast } = useToast();
  const [recipes, setRecipes] = useState<RecipeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionKey, setActionKey] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    async function loadRecipes() {
      setLoading(true);
      setError(null);

      try {
        const { data, error: recipesError } = await supabase
          .from("recipes")
          .select("id, title, slug, status, visibility, star_count, fork_count, exec_count, updated_at, created_at")
          .eq("author_id", userId)
          .order("updated_at", { ascending: false });

        if (recipesError) {
          throw new Error(recipesError.message);
        }

        if (!active) {
          return;
        }

        setRecipes(sortRecipes((data ?? []) as RecipeRow[]));
      } catch (loadErr) {
        if (!active) {
          return;
        }

        setError(loadErr instanceof Error ? loadErr.message : "加载 Recipe 列表失败");
        setRecipes([]);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    function handleRefresh() {
      void loadRecipes();
    }

    void loadRecipes();
    window.addEventListener("botbili-dashboard-refresh", handleRefresh);

    return () => {
      active = false;
      window.removeEventListener("botbili-dashboard-refresh", handleRefresh);
    };
  }, [userId]);

  async function updateRecipeStatus(recipeId: string, status: "published" | "archived") {
    setActionKey(`${recipeId}:${status}`);

    try {
      const response = await fetch(`/api/recipes/${recipeId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          status === "published"
            ? { status: "published", visibility: "public" }
            : { status: "archived" },
        ),
      });

      const payload = (await response.json()) as {
        success?: boolean;
        error?: { message?: string };
      };

      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message ?? "更新 Recipe 状态失败");
      }

      setRecipes((current) =>
        sortRecipes(
          current.map((recipe) =>
            recipe.id === recipeId
              ? {
                  ...recipe,
                  status,
                  visibility: status === "published" ? "public" : recipe.visibility,
                  updated_at: new Date().toISOString(),
                }
              : recipe,
          ),
        ),
      );

      window.dispatchEvent(new CustomEvent("botbili-dashboard-refresh"));
      toast(status === "published" ? "Recipe 已发布" : "Recipe 已归档", { variant: "success" });
    } catch (updateError) {
      toast(updateError instanceof Error ? updateError.message : "更新 Recipe 状态失败", { variant: "error" });
    } finally {
      setActionKey(null);
    }
  }

  const publishedCount = useMemo(
    () => recipes.filter((recipe) => recipe.status === "published").length,
    [recipes],
  );

  if (loading) {
    return (
      <GlassCard className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-zinc-100">我的 Recipe</h2>
          <p className="text-sm text-zinc-500">正在加载你的 Repo 列表…</p>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-20 animate-pulse rounded-2xl bg-zinc-900/70" />
          ))}
        </div>
      </GlassCard>
    );
  }

  if (error) {
    return (
      <GlassCard className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-zinc-100">我的 Recipe</h2>
          <p className="text-sm text-red-300">加载失败：{error}</p>
        </div>
      </GlassCard>
    );
  }

  if (recipes.length === 0) {
    return (
      <GlassCard className="space-y-4 py-10 text-center">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-zinc-100">你还没有创建 Recipe</h2>
          <p className="mx-auto max-w-xl text-sm leading-7 text-zinc-500">
            先把一个稳定可复用的视频工作流沉淀成 Recipe Repo，后面再让别人 Star、Fork 和执行它。
          </p>
        </div>
        <div className="flex justify-center">
          <AuroraButton href="/recipes/new" size="lg">
            创建第一个 Recipe
          </AuroraButton>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-zinc-100">我的 Recipe</h2>
          <p className="text-sm text-zinc-500">
            共 {recipes.length} 个 Repo，其中 {publishedCount} 个已发布。
          </p>
        </div>
        <AuroraButton href="/recipes/new">创建新 Recipe</AuroraButton>
      </div>

      <div className="space-y-3">
        {recipes.map((recipe) => {
          const isPublishing = actionKey === `${recipe.id}:published`;
          const isArchiving = actionKey === `${recipe.id}:archived`;

          return (
            <div
              key={recipe.id}
              className="flex flex-col gap-4 rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-4 lg:flex-row lg:items-center lg:justify-between"
            >
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/recipes/${recipe.slug || recipe.id}`}
                    className="truncate text-base font-semibold text-zinc-100 transition hover:text-cyan-300"
                  >
                    {recipe.title}
                  </Link>
                  <RecipeStatusBadge status={recipe.status} />
                </div>
                <div className="flex flex-wrap gap-4 text-xs text-zinc-500">
                  <span>⭐ {recipe.star_count}</span>
                  <span>🍴 {recipe.fork_count}</span>
                  <span>▶️ {recipe.exec_count}</span>
                  <span>更新于 {formatRelativeTime(recipe.updated_at || recipe.created_at)}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link href={`/recipes/${recipe.slug || recipe.id}`}>
                  <Button type="button" variant="outline" className="border-zinc-700 bg-zinc-950/70">
                    {recipe.status === "published" ? "查看" : "编辑"}
                  </Button>
                </Link>
                {recipe.status === "draft" ? (
                  <Button
                    type="button"
                    variant="secondary"
                    className="bg-cyan-500/15 text-cyan-200 hover:bg-cyan-500/20"
                    disabled={Boolean(actionKey)}
                    onClick={() => void updateRecipeStatus(recipe.id, "published")}
                  >
                    {isPublishing ? "发布中…" : "发布"}
                  </Button>
                ) : null}
                {recipe.status !== "archived" ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="border-zinc-700 bg-zinc-950/70"
                    disabled={Boolean(actionKey)}
                    onClick={() => void updateRecipeStatus(recipe.id, "archived")}
                  >
                    {isArchiving ? "归档中…" : "归档"}
                  </Button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}
