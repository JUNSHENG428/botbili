"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { AuroraButton } from "@/components/design/aurora-button";
import { GlassCard } from "@/components/design/glass-card";
import { SectionHeading } from "@/components/design/section-heading";
import { RecipeCard, RecipeCardSkeleton } from "@/components/recipes";
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
  }, [currentCategory, currentDifficulty, currentPlatformsKey, currentQuery, currentSort, currentTag]);

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

  function handleClearFilters() {
    const nextParams = new URLSearchParams();
    if (currentSort && currentSort !== "trending") {
      nextParams.set("sort", "trending");
    }

    setSearchInput("");
    startRouteTransition(() => {
      router.push(`/recipes${nextParams.toString() ? `?${nextParams.toString()}` : ""}`, { scroll: false });
    });
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
            subtitle="解决三个新手痛点：没有灵感时看 Trending Recipe，不会剪辑时一键执行，不知道矩阵规划时直接 Fork 现成方案。"
          >
            发现 Recipe
          </SectionHeading>

          <div className="flex flex-col gap-4 rounded-3xl border border-zinc-800/80 bg-gradient-to-br from-zinc-900 via-zinc-950 to-zinc-900 p-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-3">
              <p className="max-w-2xl text-sm leading-7 text-zinc-400">
                BotBili 是 GitHub for AI Video Recipes。你可以在这里看大佬怎么拆脚本、怎么做矩阵、怎么把一个视频流程沉淀成可复用的 Repo。
              </p>
              <div className="flex flex-wrap gap-2 text-xs text-zinc-500">
                <span>没灵感：看 Trending</span>
                <span>不会剪辑：一键执行</span>
                <span>不会做矩阵：Fork 现成方案</span>
              </div>
            </div>

            <AuroraButton href="/recipes/new" size="lg">
              创建 Recipe
            </AuroraButton>
          </div>
        </section>

        {showGuide ? (
          <GlassCard className="flex flex-col gap-3 border-cyan-500/20 bg-cyan-500/5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-zinc-200">
              👋 第一次来？先执行一个别人写好的 Recipe，看看 AI 视频是怎么生产的。
            </p>
            <Button
              type="button"
              variant="outline"
              className="border-cyan-500/30 bg-zinc-950/70 text-cyan-200 hover:border-cyan-400/40 hover:bg-zinc-900"
              onClick={handleGuideBrowseTrending}
            >
              浏览热门 Recipe ↓
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
            <GlassCard className="py-16 text-center">
              <div className="space-y-4">
                <div className="text-5xl">🔎</div>
                <div className="space-y-2">
                  <p className="text-2xl font-semibold text-zinc-100">没找到匹配的 Recipe</p>
                  <p className="mx-auto max-w-xl text-sm leading-7 text-zinc-500">
                    换个关键词，或者成为第一个发布这类 Recipe 的人。
                  </p>
                </div>
                <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <Button
                    type="button"
                    variant="outline"
                    className="border-zinc-700 bg-zinc-950/70"
                    onClick={handleClearFilters}
                  >
                    清除筛选
                  </Button>
                  <AuroraButton href={createRecipeHref} size="lg">
                    创建这个 Recipe
                  </AuroraButton>
                </div>
              </div>
            </GlassCard>
          ) : (
            <GlassCard className="py-16 text-center">
              <div className="space-y-4">
                <div className="text-5xl">🧪</div>
                <div className="space-y-2">
                  <p className="text-2xl font-semibold text-zinc-100">还没有 Recipe，来创建第一个</p>
                  <p className="mx-auto max-w-xl text-sm leading-7 text-zinc-500">
                    先把一个稳定可复用的视频流程写成 Recipe Repo，再让更多人 Star、Fork、执行和共创。
                  </p>
                </div>
                <AuroraButton href="/recipes/new" size="lg">
                  去创建 Recipe
                </AuroraButton>
              </div>
            </GlassCard>
          )}
        </section>
      </div>
    </main>
  );
}
