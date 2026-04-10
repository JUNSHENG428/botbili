"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { GlassCard } from "@/components/design/glass-card";
import { RecipePublishButton } from "@/components/recipes/RecipePublishButton";
import { RecipeShareButton } from "@/components/recipes/RecipeShareButton";
import { RecipeComments } from "@/components/recipes/comments";
import { RecipeExecutePanel } from "@/components/recipes/detail/RecipeExecutePanel";
import { RecipeExecutionHistory } from "@/components/recipes/detail/RecipeExecutionHistory";
import { RecipeExecutionOutput } from "@/components/recipes/detail/RecipeExecutionOutput";
import { RecipeHeader } from "@/components/recipes/detail/RecipeHeader";
import { RecipeStoryboard } from "@/components/recipes/detail/RecipeStoryboard";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { track } from "@/lib/analytics";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type {
  Recipe,
  RecipeExecutionOutput as RecipeExecutionOutputData,
  RecipeExecutionStatus,
  VideoPlatform,
} from "@/types/recipe";

interface RecipeDetailPageProps {
  params: Promise<{ id: string }>;
}

interface RecipeAuthor {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  author_type: "human" | "ai_agent";
}

interface RecipeExecutionHistoryItem {
  id: string;
  status: RecipeExecutionStatus;
  command_text: string | null;
  command_preview: string | null;
  output_external_url: string | null;
  output_thumbnail_url: string | null;
  output_platform: string | null;
  output: RecipeExecutionOutputData | null;
  created_at: string;
  updated_at: string;
}

interface RecipeDetailPayload {
  recipe: Recipe & {
    author?: RecipeAuthor;
  };
  viewer: {
    starred: boolean;
    saved: boolean;
  };
  recent_executions: RecipeExecutionHistoryItem[];
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

interface ForkSourceSummary {
  id: string;
  slug: string;
  author?: RecipeAuthor;
}

interface PendingExecutionState {
  executionId: string;
  commandPreview: string;
}

function renderReadmeBlocks(value: Record<string, unknown> | string | null) {
  if (!value) {
    return [];
  }

  if (typeof value === "string") {
    return value
      .split(/\n{2,}/)
      .map((block) => block.trim())
      .filter(Boolean)
      .map((block, index) => ({
        title: index === 0 ? "概览" : `说明 ${index + 1}`,
        content: block,
      }));
  }

  return Object.entries(value)
    .filter(([, content]) => content !== null && content !== undefined && content !== "")
    .map(([key, content]) => ({
      title: key,
      content: Array.isArray(content)
        ? content.join("、")
        : typeof content === "object"
          ? JSON.stringify(content, null, 2)
          : String(content),
    }));
}

function RecipeReadmeSection({ recipe }: { recipe: Recipe }) {
  const readmeBlocks =
    renderReadmeBlocks(recipe.readme_json) ||
    renderReadmeBlocks(recipe.readme_md) ||
    renderReadmeBlocks(recipe.description);

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-zinc-100">README</h2>
        <p className="text-sm text-zinc-500">这里解释这个 Recipe 解决什么问题、适合谁、输入输出是什么，以及如何做矩阵扩展。</p>
      </div>

      <GlassCard className="space-y-5">
        {readmeBlocks.length > 0 ? (
          readmeBlocks.map((block) => (
            <div key={block.title} className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-400">{block.title}</h3>
              <p className="whitespace-pre-wrap text-sm leading-7 text-zinc-300">{block.content}</p>
            </div>
          ))
        ) : (
          <p className="text-sm leading-7 text-zinc-400">
            这份 Recipe 还没有 README。建议补上适合谁、输入输出、素材来源、矩阵变量和发布平台建议。
          </p>
        )}
      </GlassCard>
    </div>
  );
}

function RecipeDetailSkeleton() {
  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <GlassCard className="animate-pulse space-y-4">
            <div className="h-4 w-32 rounded bg-zinc-800" />
            <div className="h-10 w-4/5 rounded bg-zinc-800" />
            <div className="h-5 w-full rounded bg-zinc-900" />
            <div className="h-5 w-2/3 rounded bg-zinc-900" />
          </GlassCard>
          <GlassCard className="animate-pulse space-y-3">
            <div className="h-6 w-40 rounded bg-zinc-800" />
            <div className="h-4 w-full rounded bg-zinc-900" />
            <div className="h-4 w-5/6 rounded bg-zinc-900" />
            <div className="h-4 w-2/3 rounded bg-zinc-900" />
          </GlassCard>
        </div>
        <GlassCard className="hidden animate-pulse space-y-4 lg:block">
          <div className="h-10 w-full rounded bg-zinc-800" />
          <div className="h-24 w-full rounded bg-zinc-900" />
          <div className="h-9 w-full rounded bg-zinc-900" />
        </GlassCard>
      </div>
    </main>
  );
}

function RecipeDetailError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <main className="mx-auto min-h-screen max-w-4xl px-4 py-10 sm:px-6">
      <GlassCard className="space-y-4 py-12 text-center">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-zinc-100">Recipe 暂时打不开</h1>
          <p className="text-sm text-zinc-500">{message}</p>
        </div>
        <div className="flex justify-center gap-3">
          <Button type="button" variant="outline" className="border-zinc-700 bg-zinc-950/70" onClick={onRetry}>
            重新加载
          </Button>
          <Link
            href="/recipes"
            className={cn(
              "inline-flex items-center justify-center rounded-lg border border-zinc-700 bg-zinc-950/70 px-4 py-2 text-sm text-zinc-200 transition hover:border-zinc-600 hover:text-zinc-50",
            )}
          >
            返回广场
          </Link>
        </div>
      </GlassCard>
    </main>
  );
}

function getExecutionOutput(execution: RecipeExecutionHistoryItem): RecipeExecutionOutputData | null {
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

export default function RecipeDetailPage({ params }: RecipeDetailPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { toast } = useToast();

  const [recipeData, setRecipeData] = useState<RecipeDetailPayload | null>(null);
  const [forkSource, setForkSource] = useState<ForkSourceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [pendingExecution, setPendingExecution] = useState<PendingExecutionState | null>(null);
  const lastTrackedRecipeViewRef = useRef<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (active) {
        setUserId(user?.id ?? null);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadRecipe() {
      setLoading(true);
      setError(null);
      setForkSource(null);

      try {
        const response = await fetch(`/api/recipes/${id}`);
        const payload = (await response.json()) as ApiResponse<RecipeDetailPayload>;

        if (!response.ok || !payload.success || !payload.data) {
          throw new Error(payload.error?.message ?? "获取 Recipe 详情失败");
        }

        if (!active) {
          return;
        }

        setRecipeData(payload.data);

        if (payload.data.recipe.forked_from) {
          void fetch(`/api/recipes/${payload.data.recipe.forked_from}`)
            .then(async (sourceResponse) => {
              const sourcePayload = (await sourceResponse.json()) as ApiResponse<RecipeDetailPayload>;

              if (!active || !sourceResponse.ok || !sourcePayload.success || !sourcePayload.data) {
                return;
              }

              setForkSource({
                id: sourcePayload.data.recipe.id,
                slug: sourcePayload.data.recipe.slug,
                author: sourcePayload.data.recipe.author,
              });
            })
            .catch(() => {
              if (active) {
                setForkSource(null);
              }
            });
        }
      } catch (fetchError) {
        if (!active) {
          return;
        }

        setError(fetchError instanceof Error ? fetchError.message : "获取 Recipe 详情失败");
        setRecipeData(null);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadRecipe();

    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    if (!recipeData?.recipe) {
      return;
    }

    const trackKey = `${recipeData.recipe.id}:${recipeData.recipe.slug}`;
    if (lastTrackedRecipeViewRef.current === trackKey) {
      return;
    }

    lastTrackedRecipeViewRef.current = trackKey;
    track({
      name: "recipe_detail_view",
      props: {
        recipe_id: recipeData.recipe.id,
        recipe_slug: recipeData.recipe.slug,
      },
    });
  }, [recipeData]);

  async function handleStar() {
    if (!recipeData) return;

    const response = await fetch(`/api/recipes/${recipeData.recipe.id}/star`, { method: "POST" });
    const payload = (await response.json()) as ApiResponse<{ starred: boolean; star_count: number }>;

    if (!response.ok || !payload.success || !payload.data) {
      throw new Error(payload.error?.message ?? "Star 操作失败");
    }

    setRecipeData((current) =>
      current
        ? {
            ...current,
            recipe: {
              ...current.recipe,
              star_count: payload.data!.star_count,
            },
            viewer: {
              ...current.viewer,
              starred: payload.data!.starred,
            },
          }
        : current,
    );
    track({
      name: "recipe_star",
      props: {
        recipe_id: recipeData.recipe.id,
        starred: payload.data.starred,
      },
    });
    toast(payload.data.starred ? "已加入你的 Star 清单" : "已取消 Star", { variant: "success" });
  }

  async function handleSave() {
    if (!recipeData) return;

    const response = await fetch(`/api/recipes/${recipeData.recipe.id}/save`, { method: "POST" });
    const payload = (await response.json()) as ApiResponse<{ saved: boolean; save_count: number }>;

    if (!response.ok || !payload.success || !payload.data) {
      throw new Error(payload.error?.message ?? "收藏操作失败");
    }

    setRecipeData((current) =>
      current
        ? {
            ...current,
            recipe: {
              ...current.recipe,
              save_count: payload.data!.save_count,
            },
            viewer: {
              ...current.viewer,
              saved: payload.data!.saved,
            },
          }
        : current,
    );
    toast(payload.data.saved ? "已加入收藏清单" : "已取消收藏", { variant: "success" });
  }

  async function handleFork() {
    if (!recipeData) return;

    const response = await fetch(`/api/recipes/${recipeData.recipe.id}/fork`, { method: "POST" });
    const payload = (await response.json()) as ApiResponse<{ recipe: Recipe }>;

    if (!response.ok || !payload.success || !payload.data) {
      throw new Error(payload.error?.message ?? "Fork 失败");
    }

    track({
      name: "recipe_fork",
      props: {
        recipe_id: recipeData.recipe.id,
      },
    });
    toast("已 Fork 到你的草稿库", { variant: "success" });
    router.push(`/recipes/${payload.data.recipe.slug || payload.data.recipe.id}`);
  }

  async function handleExecute() {
    if (!recipeData) return;

    track({
      name: "recipe_execute_click",
      props: {
        recipe_id: recipeData.recipe.id,
        recipe_slug: recipeData.recipe.slug,
      },
    });

    const response = await fetch(`/api/recipes/${recipeData.recipe.id}/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    const payload = (await response.json()) as ApiResponse<{
      execution_id: string;
      command_preview: string;
      status: string;
    }>;

    if (!response.ok || !payload.success || !payload.data) {
      throw new Error(payload.error?.message ?? "执行 Recipe 失败");
    }

    setPendingExecution({
      executionId: payload.data.execution_id,
      commandPreview: payload.data.command_preview,
    });
    toast("执行任务已创建，可以开始轮询 execution 状态了", { variant: "success" });
  }

  function handlePublished() {
    setRecipeData((current) =>
      current
        ? {
            ...current,
            recipe: {
              ...current.recipe,
              status: "published",
              visibility: "public",
            },
          }
        : current,
    );
  }

  if (loading) {
    return <RecipeDetailSkeleton />;
  }

  if (error || !recipeData) {
    return <RecipeDetailError message={error ?? "Recipe 不存在"} onRetry={() => router.refresh()} />;
  }

  const { recipe, viewer, recent_executions: recentExecutions } = recipeData;
  const commandPreview = pendingExecution?.commandPreview ?? `openclaw run recipe:${recipe.slug}`;
  const readmeBlocks = renderReadmeBlocks(recipe.readme_json);
  const fallbackReadmeRecipe = readmeBlocks.length > 0 ? recipe : { ...recipe, readme_json: recipe.readme_md || recipe.description };
  const isAuthor = Boolean(userId && recipe.author_id === userId);
  const latestOutputs = recentExecutions
    .map((execution) => ({ id: execution.id, output: getExecutionOutput(execution) }))
    .filter((item): item is { id: string; output: RecipeExecutionOutputData } => Boolean(item.output))
    .slice(0, 3);

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-8">
          <RecipeHeader
            recipe={recipe}
            forkSource={forkSource}
            actions={<RecipeShareButton recipeId={recipe.id} recipeTitle={recipe.title} recipeSlug={recipe.slug} />}
          />

          {latestOutputs.length > 0 ? (
            <section className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-xl font-semibold text-zinc-100">最新产出</h2>
                <p className="text-sm text-zinc-500">
                  Agent 已经把这些执行结果发布到外部平台，BotBili 只展示可追溯的结果卡片。
                </p>
              </div>
              <div className="grid gap-4 lg:grid-cols-3">
                {latestOutputs.map((item) => (
                  <RecipeExecutionOutput key={item.id} output={item.output} status="completed" />
                ))}
              </div>
            </section>
          ) : null}

          <RecipeReadmeSection recipe={fallbackReadmeRecipe} />

          <RecipeStoryboard scriptTemplate={recipe.script_template} isAuthor={isAuthor} />

          <RecipeExecutionHistory executions={recentExecutions} />

          <RecipeComments recipeId={recipe.id} />
        </div>

        <RecipeExecutePanel
          recipe={recipe}
          starred={viewer.starred}
          saved={viewer.saved}
          commandPreview={commandPreview}
          pendingExecution={pendingExecution}
          disabledActions={!userId}
          authorActions={
            isAuthor ? (
              <RecipePublishButton
                recipeId={recipe.id}
                currentStatus={recipe.status}
                onPublished={handlePublished}
              />
            ) : undefined
          }
          onExecute={handleExecute}
          onStar={handleStar}
          onFork={handleFork}
          onSave={handleSave}
        />
      </div>
    </main>
  );
}
