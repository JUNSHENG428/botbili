"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { GlassCard } from "@/components/design/glass-card";
import { GlassTabs } from "@/components/design/glass-tabs";
import { RecipeCard, RecipeCardSkeleton } from "@/components/recipes";
import { Button } from "@/components/ui/button";
import { levelColors, levelEmoji, levelLabel, type ReputationLevel } from "@/lib/reputation-levels";
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

interface UserReputationRow {
  total_points: number;
  level: ReputationLevel;
}

type TabValue = "recipes" | "videos";

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

function EmptyRecipesState({ username }: { username: string }) {
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

function EmptyVideosState({ username }: { username: string }) {
  return (
    <GlassCard className="space-y-3 py-12 text-center">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-zinc-100">这位创作者还没有发布视频</h2>
        <p className="text-sm text-zinc-500">
          等待 <span className="text-zinc-300">{username}</span> 执行 Recipe 并发布视频。
        </p>
      </div>
      <div className="flex justify-center gap-3">
        <Link href="/recipes">
          <Button type="button" variant="outline" className="border-zinc-700 bg-zinc-950/60">
            去发现广场
          </Button>
        </Link>
      </div>
    </GlassCard>
  );
}

function VideoCardSkeleton() {
  return (
    <GlassCard className="animate-pulse space-y-4">
      <div className="aspect-video w-full rounded-lg bg-zinc-800" />
      <div className="space-y-2">
        <div className="h-5 w-3/4 rounded bg-zinc-800" />
        <div className="h-4 w-1/2 rounded bg-zinc-900" />
      </div>
    </GlassCard>
  );
}

export default function UserProfilePage({ params }: UserProfilePageProps) {
  const { username } = use(params);
  const [author, setAuthor] = useState<AuthorSummary | null>(null);
  const [recipes, setRecipes] = useState<RecipeListItem[]>([]);
  const [videos, setVideos] = useState<Array<{ id: string; title: string; thumbnail_url: string | null; created_at: string }>>([]);
  const [totals, setTotals] = useState({
    recipeCount: 0,
    starCount: 0,
    forkCount: 0,
    execCount: 0,
    videoCount: 0,
  });
  const [reputation, setReputation] = useState<UserReputationRow>({
    total_points: 0,
    level: "newcomer",
  });
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState<TabValue>("recipes");

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
          .select("id, owner_id, slug, name, avatar_url, bio")
          .eq("slug", normalizedUsername)
          .limit(1)
          .maybeSingle();

        if (creatorError) {
          throw new Error(`读取 AI 作者失败: ${creatorError.message}`);
        }

        let resolvedAuthor: AuthorSummary | null = null;
        let authorId: string | null = null;
        let authorType: "human" | "ai_agent" = "human";
        let creatorId: string | null = null;

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
          creatorId = creatorMatch.id as string;
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
            
            // Try to find creator record for this user
            const { data: creatorData } = await supabase
              .from("creators")
              .select("id")
              .eq("owner_id", authorId)
              .maybeSingle();
            creatorId = creatorData?.id ?? null;
            
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
            setVideos([]);
          setTotals({
            recipeCount: 0,
            starCount: 0,
            forkCount: 0,
            execCount: 0,
            videoCount: 0,
          });
          setReputation({ total_points: 0, level: "newcomer" });
          setNotFound(true);
        }
        return;
        }

        // Fetch recipes
        const baseRecipeQuery = supabase
          .from("recipes")
          .select("*", { count: "exact" })
          .eq("author_id", authorId)
          .eq("author_type", authorType)
          .eq("status", "published")
          .eq("visibility", "public");

        const [
          { data: summaryRows, count, error: summaryError },
          { data: recipeRows, error: recipeError },
          { data: reputationRow },
        ] =
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
            supabase
              .from("user_reputation")
              .select("total_points, level")
              .eq("user_id", authorId)
              .maybeSingle<UserReputationRow>(),
          ]);

        if (summaryError) {
          throw new Error(`读取作者 Recipe 汇总失败: ${summaryError.message}`);
        }

        if (recipeError) {
          throw new Error(`读取作者 Recipe 列表失败: ${recipeError.message}`);
        }

        // Fetch videos by this creator (if creatorId exists)
        let videoRows: Array<{ id: string; title: string; thumbnail_url: string | null; created_at: string }> = [];
        let videoCount = 0;
        
        if (creatorId) {
          const { data: videosData, count: vCount, error: videoError } = await supabase
            .from("videos")
            .select("id, title, thumbnail_url, created_at", { count: "exact" })
            .eq("creator_id", creatorId)
            .eq("status", "published")
            .order("created_at", { ascending: false })
            .limit(12);
          
          if (!videoError && videosData) {
            videoRows = videosData;
            videoCount = vCount ?? videosData.length;
          }
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
        setVideos(videoRows);
        setReputation(
          reputationRow ?? {
            total_points: 0,
            level: "newcomer",
          },
        );
        setTotals({
          recipeCount: count ?? summaryRecipes.length,
          starCount: summaryRecipes.reduce((sum, recipe) => sum + (recipe.star_count ?? 0), 0),
          forkCount: summaryRecipes.reduce((sum, recipe) => sum + (recipe.fork_count ?? 0), 0),
          execCount: summaryRecipes.reduce((sum, recipe) => sum + (recipe.exec_count ?? 0), 0),
          videoCount,
        });
      } catch (error) {
        console.error("load author profile failed:", error);
        if (active) {
          setAuthor(null);
          setRecipes([]);
          setVideos([]);
          setTotals({
            recipeCount: 0,
            starCount: 0,
            forkCount: 0,
            execCount: 0,
            videoCount: 0,
          });
          setReputation({ total_points: 0, level: "newcomer" });
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

  const tabs = useMemo(
    () => [
      { value: "recipes", label: `Recipes (${totals.recipeCount})` },
      { value: "videos", label: `Videos (${totals.videoCount})` },
    ],
    [totals.recipeCount, totals.videoCount]
  );

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
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${levelColors[reputation.level]}`}>
                      {levelEmoji[reputation.level]} {levelLabel[reputation.level]}
                    </span>
                    <span className="text-sm text-zinc-400">{reputation.total_points} pts</span>
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

        <GlassTabs tabs={tabs} value={activeTab} onChange={(value) => setActiveTab(value as TabValue)} />

        {activeTab === "recipes" && (
          <>
            {recipes.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {recipes.map((recipe) => (
                  <RecipeCard key={recipe.id} recipe={recipe} />
                ))}
              </div>
            ) : (
              <EmptyRecipesState username={author.username} />
            )}
          </>
        )}

        {activeTab === "videos" && (
          <>
            {videos.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {videos.map((video) => (
                  <Link key={video.id} href={`/v/${video.id}`} className="group block">
                    <GlassCard className="h-full space-y-4 transition duration-200 hover:border-cyan-500/30 hover:bg-zinc-900/85">
                      <div className="aspect-video w-full overflow-hidden rounded-lg bg-zinc-800">
                        {video.thumbnail_url ? (
                          <img
                            src={video.thumbnail_url}
                            alt={video.title}
                            className="h-full w-full object-cover transition duration-200 group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-zinc-600">
                            <span className="text-4xl">🎬</span>
                          </div>
                        )}
                      </div>
                      <div className="space-y-1">
                        <h3 className="line-clamp-2 text-lg font-semibold leading-6 text-zinc-50 transition group-hover:text-cyan-200">
                          {video.title}
                        </h3>
                        <p className="text-xs text-zinc-500">{new Date(video.created_at).toLocaleDateString('zh-CN')}</p>
                      </div>
                    </GlassCard>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyVideosState username={author.username} />
            )}
          </>
        )}
      </div>
    </main>
  );
}
