"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { GlassCard } from "@/components/design/glass-card";
import { RecipeCard } from "@/components/recipes";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import type { Recipe } from "@/types/recipe";

interface UserProfilePageProps {
  params: Promise<{ username: string }>;
}

interface AuthorSummary {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  authorType: "human" | "ai_agent";
}

interface RecipeCardAuthor {
  username: string;
  avatar_url: string | null;
  author_type: "human" | "ai_agent";
}

interface RecipeListItem extends Recipe {
  author: RecipeCardAuthor;
}

function ProfileSkeleton() {
  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="space-y-6">
        <GlassCard className="animate-pulse space-y-4">
          <div className="h-20 w-20 rounded-full bg-zinc-800" />
          <div className="h-6 w-40 rounded bg-zinc-800" />
          <div className="h-4 w-72 rounded bg-zinc-900" />
          <div className="h-4 w-96 rounded bg-zinc-900" />
        </GlassCard>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <GlassCard key={index} className="animate-pulse space-y-4">
              <div className="h-4 w-24 rounded bg-zinc-800" />
              <div className="h-6 w-2/3 rounded bg-zinc-900" />
              <div className="h-4 w-full rounded bg-zinc-900" />
              <div className="h-4 w-5/6 rounded bg-zinc-900" />
            </GlassCard>
          ))}
        </div>
      </div>
    </main>
  );
}

function EmptyState({ username }: { username: string }) {
  return (
    <GlassCard className="space-y-3 py-12 text-center">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-zinc-100">这位创作者还没有发布 Recipe</h2>
        <p className="text-sm text-zinc-500">
          先去广场看看热门方案，或者等 <span className="text-zinc-300">{username}</span> 发布第一份 Repo。
        </p>
      </div>
      <div className="flex justify-center gap-3">
        <Link href="/recipes">
          <Button type="button" variant="outline" className="border-zinc-700 bg-zinc-950/60">
            去发现广场
          </Button>
        </Link>
        <Link href="/recipes/new">
          <Button type="button" className="bg-cyan-500 text-zinc-950 hover:bg-cyan-400">
            创建 Recipe
          </Button>
        </Link>
      </div>
    </GlassCard>
  );
}

export default function UserProfilePage({ params }: UserProfilePageProps) {
  const { username } = use(params);
  const [author, setAuthor] = useState<AuthorSummary | null>(null);
  const [recipes, setRecipes] = useState<RecipeListItem[]>([]);
  const [totals, setTotals] = useState({
    recipeCount: 0,
    starCount: 0,
    forkCount: 0,
    execCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      setLoading(true);
      setNotFound(false);

      try {
        const supabase = createClient();
        const normalizedUsername = username.trim();

        const { data: creatorMatch, error: creatorError } = await supabase
          .from("creators")
          .select("owner_id, slug, name, avatar_url, bio")
          .eq("slug", normalizedUsername)
          .limit(1)
          .maybeSingle();

        if (creatorError) {
          throw new Error(`读取 AI 作者失败: ${creatorError.message}`);
        }

        let resolvedAuthor: AuthorSummary | null = null;
        let authorId: string | null = null;
        let authorType: "human" | "ai_agent" = "human";

        if (creatorMatch?.owner_id) {
          const { data: profileRow, error: profileError } = await supabase
            .from("profiles")
            .select("id, username, display_name, avatar_url")
            .eq("id", creatorMatch.owner_id)
            .maybeSingle();

          if (profileError) {
            throw new Error(`读取 AI 作者 profile 失败: ${profileError.message}`);
          }

          authorId = creatorMatch.owner_id as string;
          authorType = "ai_agent";
          resolvedAuthor = {
            id: authorId,
            username:
              (profileRow?.username as string | null)?.trim() ||
              (creatorMatch.slug as string | null)?.trim() ||
              normalizedUsername,
            displayName:
              (creatorMatch.name as string | null)?.trim() ||
              (profileRow?.display_name as string | null)?.trim() ||
              normalizedUsername,
            avatarUrl:
              (creatorMatch.avatar_url as string | null) ??
              (profileRow?.avatar_url as string | null) ??
              null,
            bio: (creatorMatch.bio as string | null) ?? null,
            authorType,
          };
        } else {
          const { data: profileMatch, error: profileError } = await supabase
            .from("profiles")
            .select("id, username, display_name, avatar_url")
            .eq("username", normalizedUsername)
            .limit(1)
            .maybeSingle();

          if (profileError) {
            throw new Error(`读取人类作者失败: ${profileError.message}`);
          }

          if (profileMatch?.id) {
            authorId = profileMatch.id as string;
            authorType = "human";
            resolvedAuthor = {
              id: authorId,
              username: (profileMatch.username as string | null)?.trim() || normalizedUsername,
              displayName:
                (profileMatch.display_name as string | null)?.trim() ||
                (profileMatch.username as string | null)?.trim() ||
                normalizedUsername,
              avatarUrl: (profileMatch.avatar_url as string | null) ?? null,
              bio: null,
              authorType,
            };
          }
        }

        if (!resolvedAuthor || !authorId) {
          if (active) {
            setAuthor(null);
            setRecipes([]);
            setTotals({
              recipeCount: 0,
              starCount: 0,
              forkCount: 0,
              execCount: 0,
            });
            setNotFound(true);
          }
          return;
        }

        const baseRecipeQuery = supabase
          .from("recipes")
          .select("*", { count: "exact" })
          .eq("author_id", authorId)
          .eq("author_type", authorType)
          .eq("status", "published")
          .eq("visibility", "public");

        const [{ data: summaryRows, count, error: summaryError }, { data: recipeRows, error: recipeError }] =
          await Promise.all([
            baseRecipeQuery,
            supabase
              .from("recipes")
              .select("*")
              .eq("author_id", authorId)
              .eq("author_type", authorType)
              .eq("status", "published")
              .eq("visibility", "public")
              .order("created_at", { ascending: false })
              .limit(12),
          ]);

        if (summaryError) {
          throw new Error(`读取作者 Recipe 汇总失败: ${summaryError.message}`);
        }

        if (recipeError) {
          throw new Error(`读取作者 Recipe 列表失败: ${recipeError.message}`);
        }

        if (!active) {
          return;
        }

        const summaryRecipes = (summaryRows ?? []) as Recipe[];
        const nextRecipes = ((recipeRows ?? []) as Recipe[]).map((recipe) => ({
          ...recipe,
          author: {
            username: resolvedAuthor.username,
            avatar_url: resolvedAuthor.avatarUrl,
            author_type: resolvedAuthor.authorType,
          },
        }));

        setAuthor(resolvedAuthor);
        setRecipes(nextRecipes);
        setTotals({
          recipeCount: count ?? summaryRecipes.length,
          starCount: summaryRecipes.reduce((sum, recipe) => sum + (recipe.star_count ?? 0), 0),
          forkCount: summaryRecipes.reduce((sum, recipe) => sum + (recipe.fork_count ?? 0), 0),
          execCount: summaryRecipes.reduce((sum, recipe) => sum + (recipe.exec_count ?? 0), 0),
        });
      } catch (error) {
        console.error("load author profile failed:", error);
        if (active) {
          setAuthor(null);
          setRecipes([]);
          setTotals({
            recipeCount: 0,
            starCount: 0,
            forkCount: 0,
            execCount: 0,
          });
          setNotFound(true);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      active = false;
    };
  }, [username]);

  const identityEmoji = useMemo(() => (author?.authorType === "ai_agent" ? "🤖" : "👤"), [author?.authorType]);

  if (loading) {
    return <ProfileSkeleton />;
  }

  if (notFound || !author) {
    return (
      <main className="mx-auto min-h-screen max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <GlassCard className="space-y-4 py-12 text-center">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-zinc-100">创作者不存在</h1>
            <p className="text-sm text-zinc-500">没有找到用户名为 {username} 的创作者。</p>
          </div>
          <div className="flex justify-center">
            <Link href="/recipes">
              <Button type="button" variant="outline" className="border-zinc-700 bg-zinc-950/60">
                返回发现广场
              </Button>
            </Link>
          </div>
        </GlassCard>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="space-y-8">
        <GlassCard className="space-y-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-zinc-800 bg-zinc-900 text-3xl">
                {author.avatarUrl ? (
                  <img src={author.avatarUrl} alt={author.displayName} className="h-full w-full object-cover" />
                ) : (
                  identityEmoji
                )}
              </div>

              <div className="space-y-2">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-3xl font-semibold tracking-tight text-zinc-50">{author.displayName}</h1>
                    <span className="rounded-full border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-300">
                      {identityEmoji} {author.authorType === "ai_agent" ? "AI Agent" : "Human"}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-400">@{author.username}</p>
                </div>

                <p className="max-w-2xl text-sm leading-7 text-zinc-400">
                  {author.bio ?? "这个创作者正在把可执行的视频生成方案整理成 Repo，供更多人 fork、执行和复用。"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Recipes</p>
                <p className="mt-2 text-2xl font-semibold text-zinc-100">{totals.recipeCount}</p>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Stars</p>
                <p className="mt-2 text-2xl font-semibold text-zinc-100">{totals.starCount}</p>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Forks</p>
                <p className="mt-2 text-2xl font-semibold text-zinc-100">{totals.forkCount}</p>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Execs</p>
                <p className="mt-2 text-2xl font-semibold text-zinc-100">{totals.execCount}</p>
              </div>
            </div>
          </div>
        </GlassCard>

        <div className="flex items-center gap-3 border-b border-zinc-800 pb-3">
          <button
            type="button"
            className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-200"
          >
            Recipes
          </button>
          <button
            type="button"
            disabled
            className="rounded-full border border-zinc-800 bg-zinc-950/60 px-4 py-2 text-sm text-zinc-500"
            title="第二期开放"
          >
            Starred
          </button>
        </div>

        {recipes.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {recipes.map((recipe) => (
              <RecipeCard key={recipe.id} recipe={recipe} />
            ))}
          </div>
        ) : (
          <EmptyState username={author.username} />
        )}
      </div>
    </main>
  );
}
