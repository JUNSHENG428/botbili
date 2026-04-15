"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

import { AuroraButton } from "@/components/design/aurora-button";
import { GlassCard } from "@/components/design/glass-card";
import { SectionHeading } from "@/components/design/section-heading";
import { RecipeCard, RecipeCardSkeleton } from "@/components/recipes";
import { EmptyStateActionCard } from "@/components/recipes/EmptyStateActionCard";
import { RecipeFilters } from "@/components/recipes/RecipeFilters";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { track } from "@/lib/analytics";
import { createClient } from "@/lib/supabase/client";
import type { Recipe } from "@/types/recipe";

interface RecipeAuthor {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  author_type: "human" | "ai_agent";
}

interface RecipeListItem extends Recipe {
  author?: RecipeAuthor;
}

interface RecipesResponsePayload {
  recipes: RecipeListItem[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

interface RecommendedRecipesPayload {
  recipes: RecipeListItem[];
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

interface TagItem {
  tag: string;
  count: number;
}

const PAGE_SIZE = 12;

function normalizePlatforms(searchParams: URLSearchParams): string[] {
  return searchParams
    .getAll("platforms")
    .flatMap((value) => value.split(","))
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

function buildRecipesUrl(params: {
  query: string;
  sort: string;
  category: string;
  difficulty: string;
  platforms: string[];
  tag: string | null;
  forkedFrom: string | null;
  page: number;
  limit?: number;
}): string {
  const search = new URLSearchParams();

  search.set("sort", params.sort);
  search.set("page", String(params.page));
  search.set("limit", String(params.limit ?? PAGE_SIZE));

  if (params.query.trim()) {
    search.set("q", params.query.trim());
  }

  if (params.category) {
    search.set("category", params.category);
  }

  if (params.difficulty) {
    search.set("difficulty", params.difficulty);
  }

  if (params.platforms.length > 0) {
    search.set("platforms", params.platforms.join(","));
  }

  if (params.tag) {
    search.set("tag", params.tag);
  }

  if (params.forkedFrom) {
    search.set("forked_from", params.forkedFrom);
  }

  return `/api/recipes?${search.toString()}`;
}

export default function RecipesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const searchParamsString = searchParams.toString();

  const currentSort = searchParams.get("sort") ?? "trending";
  const currentCategory = searchParams.get("category") ?? "";
  const currentDifficulty = searchParams.get("difficulty") ?? "";
  const currentPlatforms = normalizePlatforms(searchParams);
  const currentPlatformsKey = currentPlatforms.join(",");
  const currentQuery = searchParams.get("q") ?? "";
  const currentTag = searchParams.get("tag") ?? null;
  const currentForkedFrom = searchParams.get("forked_from") ?? null;

  const [searchInput, setSearchInput] = useState(currentQuery);
  const deferredSearchInput = useDeferredValue(searchInput);
  const [isRouting, startRouteTransition] = useTransition();

  const [recipes, setRecipes] = useState<RecipeListItem[]>([]);
  const [starredMap, setStarredMap] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const lastTrackedViewKeyRef = useRef<string | null>(null);
  const listSectionRef = useRef<HTMLElement | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [popularTags, setPopularTags] = useState<TagItem[]>([]);
  const [recommendedRecipes, setRecommendedRecipes] = useState<RecipeListItem[]>([]);
  const [recommendedLoading, setRecommendedLoading] = useState(false);
  const [starterRecipes, setStarterRecipes] = useState<RecipeListItem[]>([]);
  const [starterLoading, setStarterLoading] = useState(true);

  // 加载热门标签
  useEffect(() => {
    let active = true;
    fetch("/api/recipes/tags?limit=20")
      .then((res) => res.json())
      .then((data) => {
        if (active && data.tags) setPopularTags(data.tags);
      })
      .catch((err) => console.error("Failed to load popular tags:", err));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    setSearchInput(currentQuery);
  }, [currentQuery]);

  useEffect(() => {
    if (!userId) {
      setRecommendedRecipes([]);
      return;
    }

    let active = true;
    const controller = new AbortController();

    async function loadRecommendations() {
      try {
        setRecommendedLoading(true);
        const response = await fetch("/api/recipes/recommended?limit=3", {
          signal: controller.signal,
        });
        const payload = (await response.json()) as ApiResponse<RecommendedRecipesPayload>;

        if (!active || !response.ok || !payload.success || !payload.data) {
          return;
        }

        setRecommendedRecipes(payload.data.recipes);
      } catch (error) {
        if (controller.signal.aborted || !active) {
          return;
        }

        console.error("Failed to load recommended recipes:", error);
        setRecommendedRecipes([]);
      } finally {
        if (active) {
          setRecommendedLoading(false);
        }
      }
    }

    void loadRecommendations();

    return () => {
      active = false;
      controller.abort();
    };
  }, [userId]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function loadStarterRecipes() {
      try {
        setStarterLoading(true);
        const response = await fetch("/api/recipes/recommended?limit=3&mode=starter", {
          signal: controller.signal,
        });
        const payload = (await response.json()) as ApiResponse<RecommendedRecipesPayload>;

        if (!active || !response.ok || !payload.success || !payload.data) {
          return;
        }

        setStarterRecipes(payload.data.recipes);
      } catch (error) {
        if (!active || controller.signal.aborted) {
          return;
        }

        console.error("Failed to load starter recipes:", error);
        setStarterRecipes([]);
      } finally {
        if (active) {
          setStarterLoading(false);
        }
      }
    }

    void loadStarterRecipes();

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!active) {
        return;
      }

      const seenGuide = window.localStorage.getItem("botbili_recipes_guide_seen") === "true";
      setUserId(user?.id ?? null);
      setShowGuide(!seenGuide || !user?.id);
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const normalizedInput = deferredSearchInput.trim();
    const normalizedCurrent = currentQuery.trim();

    if (normalizedInput === normalizedCurrent) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      const nextParams = new URLSearchParams(searchParamsString);

      if (normalizedInput) {
        nextParams.set("q", normalizedInput);
      } else {
        nextParams.delete("q");
      }

      startRouteTransition(() => {
        router.replace(`/recipes${nextParams.toString() ? `?${nextParams.toString()}` : ""}`, {
          scroll: false,
        });
      });
    }, 300);

    return () => window.clearTimeout(timer);
  }, [currentQuery, deferredSearchInput, router, searchParamsString]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadFirstPage() {
      setLoading(true);
      setLoadError(null);

      try {
        const response = await fetch(
          buildRecipesUrl({
            query: currentQuery,
            sort: currentSort,
            category: currentCategory,
            difficulty: currentDifficulty,
            platforms: currentPlatforms,
            tag: currentTag,
            forkedFrom: currentForkedFrom,
            page: 1,
          }),
          {
            signal: controller.signal,
          },
        );

        const payload = (await response.json()) as ApiResponse<RecipesResponsePayload>;

        if (!response.ok || !payload.success || !payload.data) {
          throw new Error(payload.error?.message ?? "获取 Recipe 列表失败");
        }

        setRecipes(payload.data.recipes);
        setPage(payload.data.page);
        setTotal(payload.data.total);
        setHasMore(payload.data.hasMore);
        setStarredMap({});
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        const message = error instanceof Error ? error.message : "获取 Recipe 列表失败";
        setLoadError(message);
        setRecipes([]);
        setPage(1);
        setTotal(0);
        setHasMore(false);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadFirstPage();

    return () => controller.abort();
  }, [currentCategory, currentDifficulty, currentForkedFrom, currentPlatformsKey, currentQuery, currentSort, currentTag]);

  useEffect(() => {
    if (loading || loadError) {
      return;
    }

    const filters: Record<string, string> = {};
    if (currentQuery.trim()) {
      filters.q = currentQuery.trim();
    }
    if (currentCategory) {
      filters.category = currentCategory;
    }
    if (currentDifficulty) {
      filters.difficulty = currentDifficulty;
    }
    if (currentPlatforms.length > 0) {
      filters.platforms = currentPlatforms.join(",");
    }
    if (currentTag) {
      filters.tag = currentTag;
    }

    const trackingKey = JSON.stringify({
      sort: currentSort,
      filters,
    });

    if (lastTrackedViewKeyRef.current === trackingKey) {
      return;
    }

    lastTrackedViewKeyRef.current = trackingKey;
    track({
      name: "recipe_list_view",
      props: {
        sort: currentSort,
        filters,
      },
    });
  }, [currentCategory, currentDifficulty, currentPlatforms, currentQuery, currentSort, currentTag, loadError, loading]);

  function updateUrl(nextValues: {
    sort?: string;
    category?: string;
    difficulty?: string;
    platforms?: string[];
    tag?: string | null;
  }) {
    const nextParams = new URLSearchParams(searchParamsString);

    if (nextValues.sort !== undefined) {
      nextValues.sort ? nextParams.set("sort", nextValues.sort) : nextParams.delete("sort");
    }

    if (nextValues.category !== undefined) {
      nextValues.category ? nextParams.set("category", nextValues.category) : nextParams.delete("category");
    }

    if (nextValues.difficulty !== undefined) {
      nextValues.difficulty ? nextParams.set("difficulty", nextValues.difficulty) : nextParams.delete("difficulty");
    }

    if (nextValues.platforms !== undefined) {
      if (nextValues.platforms.length > 0) {
        nextParams.set("platforms", nextValues.platforms.join(","));
      } else {
        nextParams.delete("platforms");
      }
    }

    if (nextValues.tag !== undefined) {
      if (nextValues.tag) {
        nextParams.set("tag", nextValues.tag);
      } else {
        nextParams.delete("tag");
      }
    }

    startRouteTransition(() => {
      router.push(`/recipes${nextParams.toString() ? `?${nextParams.toString()}` : ""}`, {
        scroll: false,
      });
    });
  }

  async function loadMore() {
    const nextPage = page + 1;
    setLoadingMore(true);

    try {
      const response = await fetch(
        buildRecipesUrl({
          query: currentQuery,
          sort: currentSort,
          category: currentCategory,
          difficulty: currentDifficulty,
          platforms: currentPlatforms,
            tag: currentTag,
            forkedFrom: currentForkedFrom,
            page: nextPage,
          }),
      );

      const payload = (await response.json()) as ApiResponse<RecipesResponsePayload>;

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error?.message ?? "加载更多失败");
      }

      setRecipes((currentRecipes) => [...currentRecipes, ...payload.data!.recipes]);
      setPage(payload.data.page);
      setTotal(payload.data.total);
      setHasMore(payload.data.hasMore);
    } catch (error) {
      const message = error instanceof Error ? error.message : "加载更多失败";
      toast(message, { variant: "error" });
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleStarToggle(recipeId: string, newState: boolean) {
    const previousStarred = starredMap[recipeId] ?? false;

    setStarredMap((current) => ({
      ...current,
      [recipeId]: newState,
    }));
    setRecipes((currentRecipes) =>
      currentRecipes.map((recipe) =>
        recipe.id === recipeId
          ? {
              ...recipe,
              star_count: Math.max(0, recipe.star_count + (newState ? 1 : -1)),
            }
          : recipe,
      ),
    );
    setRecommendedRecipes((currentRecipes) =>
      currentRecipes.map((recipe) =>
        recipe.id === recipeId
          ? {
              ...recipe,
              star_count: Math.max(0, recipe.star_count + (newState ? 1 : -1)),
            }
          : recipe,
      ),
    );

    try {
      const response = await fetch(`/api/recipes/${recipeId}/star`, {
        method: "POST",
      });

      const payload = (await response.json()) as ApiResponse<{ starred: boolean; star_count: number }>;

      if (response.status === 401) {
        throw new Error("请先登录");
      }

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error?.message ?? "Star 操作失败");
      }

      setStarredMap((current) => ({
        ...current,
        [recipeId]: payload.data!.starred,
      }));
      setRecipes((currentRecipes) =>
        currentRecipes.map((recipe) =>
          recipe.id === recipeId
            ? {
                ...recipe,
                star_count: payload.data!.star_count,
              }
            : recipe,
        ),
      );
      setRecommendedRecipes((currentRecipes) =>
        currentRecipes.map((recipe) =>
          recipe.id === recipeId
            ? {
                ...recipe,
                star_count: payload.data!.star_count,
              }
            : recipe,
        ),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Star 操作失败";

      setStarredMap((current) => ({
        ...current,
        [recipeId]: previousStarred,
      }));
      setRecipes((currentRecipes) =>
        currentRecipes.map((recipe) =>
          recipe.id === recipeId
            ? {
                ...recipe,
                star_count: Math.max(0, recipe.star_count + (previousStarred ? 1 : -1)),
              }
            : recipe,
        ),
      );
      setRecommendedRecipes((currentRecipes) =>
        currentRecipes.map((recipe) =>
          recipe.id === recipeId
            ? {
                ...recipe,
                star_count: Math.max(0, recipe.star_count + (previousStarred ? 1 : -1)),
              }
            : recipe,
        ),
      );

      toast(message, { variant: message === "请先登录" ? "warning" : "error" });
    }
  }

  function handleGuideBrowseTrending() {
    window.localStorage.setItem("botbili_recipes_guide_seen", "true");
    setShowGuide(false);

    const nextParams = new URLSearchParams(searchParamsString);
    nextParams.set("sort", "trending");

    startRouteTransition(() => {
      router.push(`/recipes?${nextParams.toString()}`, { scroll: false });
    });

    window.setTimeout(() => {
      listSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }

  const hasActiveFilters = Boolean(
    currentQuery.trim() || currentCategory || currentDifficulty || currentPlatforms.length > 0 || currentTag,
  );
  const createRecipeHref = useMemo(() => {
    const query = currentQuery.trim();
    return query ? `/recipes/new?title=${encodeURIComponent(query)}` : "/recipes/new";
  }, [currentQuery]);

  const isBusy = loading || isRouting;

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="space-y-8">
        <section className="space-y-5">
          <SectionHeading
            className="text-left"
            subtitle="复制一个 Recipe，让 Agent 帮你做视频。先跑通一条公开 Recipe，再决定要不要 Fork、改参数和做矩阵。"
          >
            发现 Recipe
          </SectionHeading>

          <div className="flex flex-col gap-4 rounded-3xl border border-zinc-800/80 bg-gradient-to-br from-zinc-900 via-zinc-950 to-zinc-900 p-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-3">
              <p className="max-w-2xl text-sm leading-7 text-zinc-400">
                不会剪也能开始。先挑一条成功率高、有人公开回填结果的 Recipe，让 OpenClaw 帮你跑出第一条视频。
              </p>
              <div className="flex flex-wrap gap-2 text-xs text-zinc-500">
                <span>第一步：挑一条新手友好 Recipe</span>
                <span>第二步：连接 Agent</span>
                <span>第三步：执行并回填公开结果</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <AuroraButton href="/onboarding" size="lg">
                开始第一条成功路径
              </AuroraButton>
              <Link
                href="/recipes/new"
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-950/70 px-4 py-2 text-sm text-zinc-200 transition hover:border-zinc-600 hover:text-zinc-50"
              >
                创建 Recipe
              </Link>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-zinc-100">第一条成功路径</h2>
            <p className="text-sm text-zinc-500">
              这些 Recipe 更适合第一次执行：步骤少、成功率高、并且已经有人公开回填结果。
            </p>
          </div>

          {starterLoading ? (
            <div className="grid gap-4 md:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-40 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900/60" />
              ))}
            </div>
          ) : starterRecipes.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-3">
              {starterRecipes.map((recipe) => (
                <Link
                  key={recipe.id}
                  href={`/recipes/${recipe.slug || recipe.id}`}
                  className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5 transition hover:border-cyan-500/30 hover:bg-zinc-900"
                >
                  <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                    <span className="rounded-full border border-cyan-500/30 px-2 py-1 text-cyan-300">新手友好</span>
                    <span className="rounded-full border border-zinc-700 px-2 py-1">5 分钟跑通</span>
                  </div>
                  <p className="mt-4 text-lg font-semibold text-zinc-100">{recipe.title}</p>
                  <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500">
                    {typeof recipe.execution_count === "number" ? <span>▶ {recipe.execution_count} 次执行</span> : null}
                    {typeof recipe.success_rate === "number" ? (
                      <span>✓ {Math.round(recipe.success_rate * 100)}% 成功率</span>
                    ) : null}
                    {typeof recipe.output_count === "number" && recipe.output_count > 0 ? (
                      <span>📺 已有 {recipe.output_count} 条公开结果</span>
                    ) : null}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyStateActionCard
              icon="🚀"
              title="先跑一条公开 Recipe"
              description="从社区里已经验证过的 Recipe 开始，比从空白页写脚本更容易拿到第一条成功结果。"
              actionLabel="去看热门 Recipe"
              actionHref="/recipes?sort=trending"
              secondaryLabel="打开 onboarding"
              secondaryHref="/onboarding"
            />
          )}
        </section>

        {userId && (recommendedLoading || recommendedRecipes.length > 0) ? (
          <section className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-zinc-100">为你推荐</h2>
              <p className="text-sm text-zinc-500">
                根据你的执行历史、Star 记录和 Fork 链路，优先推荐更可能跑出结果的 Recipe。
              </p>
            </div>

            {recommendedLoading ? (
              <div className="flex gap-4 overflow-x-auto pb-1">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="min-w-[280px] flex-1">
                    <RecipeCardSkeleton />
                  </div>
                ))}
              </div>
            ) : recommendedRecipes.length > 0 ? (
              <div className="flex gap-4 overflow-x-auto pb-1">
                {recommendedRecipes.map((recipe) => (
                  <RecipeCard
                    key={recipe.id}
                    recipe={recipe}
                    isStarred={starredMap[recipe.id] ?? false}
                    onStarToggle={handleStarToggle}
                    className="min-w-[280px] max-w-[360px] flex-1"
                  />
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        {showGuide ? (
          <GlassCard className="flex flex-col gap-3 border-cyan-500/20 bg-cyan-500/5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-zinc-200">
              👋 第一次来？先执行一个新手友好的公开 Recipe，看一遍从执行到公开回填的完整路径。
            </p>
            <Button
              type="button"
              variant="outline"
              className="border-cyan-500/30 bg-zinc-950/70 text-cyan-200 hover:border-cyan-400/40 hover:bg-zinc-900"
              onClick={handleGuideBrowseTrending}
            >
              先挑第一条 Recipe ↓
            </Button>
          </GlassCard>
        ) : null}

        <section ref={listSectionRef} className="space-y-6">
          <RecipeFilters
            query={searchInput}
            sort={currentSort}
            category={currentCategory}
            difficulty={currentDifficulty}
            platforms={currentPlatforms}
            tags={popularTags}
            activeTag={currentTag}
            onQueryChange={setSearchInput}
            onSortChange={(value) => updateUrl({ sort: value })}
            onCategoryChange={(value) => updateUrl({ category: value })}
            onDifficultyChange={(value) => updateUrl({ difficulty: value })}
            onPlatformToggle={(value) => {
              const nextPlatforms = currentPlatforms.includes(value)
                ? currentPlatforms.filter((platform) => platform !== value)
                : [...currentPlatforms, value];
              updateUrl({ platforms: nextPlatforms });
            }}
            onTagChange={(tag) => updateUrl({ tag })}
          />

          {loadError ? (
            <GlassCard className="space-y-4 text-center">
              <div className="space-y-2">
                <p className="text-lg font-semibold text-zinc-100">Recipe 广场暂时没加载出来</p>
                <p className="text-sm text-zinc-500">{loadError}</p>
              </div>
              <Button type="button" variant="outline" className="border-zinc-700 bg-zinc-950/70" onClick={() => router.refresh()}>
                重新加载
              </Button>
            </GlassCard>
          ) : isBusy ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <RecipeCardSkeleton key={index} />
              ))}
            </div>
          ) : recipes.length > 0 ? (
            <section className="space-y-6">
              <div className="flex items-center justify-between gap-4">
                <div className="text-sm text-zinc-500">
                  共 <span className="font-medium text-zinc-200">{total}</span> 个 Recipe
                </div>
                <div className="text-xs text-zinc-600">像 GitHub Trending 一样，先看信号，再决定要不要 Fork</div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {recipes.map((recipe) => (
                  <RecipeCard
                    key={recipe.id}
                    recipe={recipe}
                    isStarred={starredMap[recipe.id] ?? false}
                    onStarToggle={handleStarToggle}
                  />
                ))}
              </div>

              {hasMore ? (
                <div className="flex justify-center">
                  <Button
                    type="button"
                    variant="outline"
                    className="border-zinc-700 bg-zinc-950/70 px-6"
                    onClick={loadMore}
                    disabled={loadingMore}
                  >
                    {loadingMore ? "加载中…" : "加载更多"}
                  </Button>
                </div>
              ) : null}
            </section>
          ) : hasActiveFilters ? (
            <EmptyStateActionCard
              icon="🔎"
              title="没找到匹配的 Recipe"
              description="换个关键词，或者先去看热门 Recipe 找灵感；如果你已经知道要做什么，也可以直接创建这一类 Recipe。"
              actionLabel="清除筛选，回到热门榜"
              actionHref="/recipes?sort=trending"
              secondaryLabel="创建这个 Recipe"
              secondaryHref={createRecipeHref}
            />
          ) : (
            <EmptyStateActionCard
              icon="🧪"
              title="还没有公开 Recipe"
              description="先去跑一条社区里的公开 Recipe，确认你的 Agent 链路跑通，再回来创建自己的第一份模板会更稳。"
              actionLabel="先跑一条热门 Recipe"
              actionHref="/recipes?sort=trending"
              secondaryLabel="直接创建 Recipe"
              secondaryHref="/recipes/new"
            />
          )}
        </section>
      </div>
    </main>
  );
}
