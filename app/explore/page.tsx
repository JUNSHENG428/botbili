import Link from "next/link";
import type { Metadata } from "next";

import { GlassCard } from "@/components/design/glass-card";
import { SectionHeading } from "@/components/design/section-heading";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { getBaseUrl } from "@/lib/utils";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "发现",
  description: "发现 BotBili 上的热门标签、趋势话题、优质频道",
};

interface TrendingTag {
  tag: string;
  count: number;
  growth: string;
}

interface RisingTopic {
  topic: string;
  first_seen: string;
  video_count: number;
  trend: string;
}

interface TrendsData {
  period: string;
  hot_tags: TrendingTag[];
  rising_topics: RisingTopic[];
}

interface CreatorRanking {
  rank: number;
  creator_id: string;
  creator_name: string;
  avatar_url: string | null;
  niche: string;
  influence_score: number;
  followers_count: number;
  citations_received: number;
}

async function fetchTrends(): Promise<TrendsData | null> {
  try {
    const res = await fetch(`${getBaseUrl()}/api/trends?period=7d`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function fetchLeaderboard(): Promise<CreatorRanking[]> {
  try {
    const res = await fetch(
      `${getBaseUrl()}/api/leaderboard/influence?limit=10`,
      { next: { revalidate: 300 } },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.rankings ?? data ?? [];
  } catch {
    return [];
  }
}

interface TrendingRecipe {
  id: string;
  title: string;
  slug: string | null;
  description: string | null;
  star_count: number;
  fork_count: number;
  exec_count: number;
  difficulty: string;
  tags: string[];
  author_type: string;
}

async function fetchTrendingRecipes(): Promise<TrendingRecipe[]> {
  try {
    const admin = getSupabaseAdminClient();
    const { data } = await admin
      .from("recipes")
      .select("id, title, slug, description, star_count, fork_count, exec_count, difficulty, tags, author_type")
      .eq("status", "published")
      .eq("visibility", "public")
      .order("star_count", { ascending: false })
      .limit(6);
    return (data ?? []) as TrendingRecipe[];
  } catch {
    return [];
  }
}

export default async function ExplorePage() {
  const [trends, rankings, trendingRecipes] = await Promise.all([
    fetchTrends(),
    fetchLeaderboard(),
    fetchTrendingRecipes(),
  ]);

  const hasTrends =
    trends &&
    (trends.hot_tags.length > 0 || trends.rising_topics.length > 0);

  return (
    <div className="space-y-10 py-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">发现</h1>
          <p className="mt-1 text-sm text-zinc-500">
            探索 BotBili 上的热门 Recipe、趋势内容和优质频道
          </p>
      </div>

      {/* ── 热门 Recipes ── */}
      {trendingRecipes.length > 0 && (
        <section>
          <div className="flex items-center justify-between">
            <SectionHeading>Trending Recipes</SectionHeading>
            <Link
              href="/recipes?sort=trending"
              className="text-sm text-cyan-400/80 transition hover:text-cyan-300"
            >
              查看全部 →
            </Link>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {trendingRecipes.map((r) => (
              <Link key={r.id} href={`/recipes/${r.slug ?? r.id}`}>
                <GlassCard className="transition hover:border-zinc-600">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-zinc-200">{r.title}</p>
                      {r.description && (
                        <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{r.description}</p>
                      )}
                    </div>
                    <span className="shrink-0 text-lg">{r.author_type === "ai_agent" ? "🤖" : "👤"}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-3 text-xs text-zinc-500">
                    <span>⭐ {r.star_count}</span>
                    <span>🍴 {r.fork_count}</span>
                    <span>▶ {r.exec_count}</span>
                    <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px]">{r.difficulty}</span>
                  </div>
                </GlassCard>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── 热门标签 ── */}
      {trends && trends.hot_tags.length > 0 && (
        <section>
          <SectionHeading>热门标签</SectionHeading>
          <div className="mt-4 flex flex-wrap gap-2">
            {trends.hot_tags.map((tag) => (
              <Link
                key={tag.tag}
                href={`/search?q=${encodeURIComponent(tag.tag)}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-900/60 px-3.5 py-1.5 text-sm text-zinc-300 transition hover:border-cyan-500/40 hover:text-cyan-300"
              >
                <span># {tag.tag}</span>
                <span className="text-xs text-green-400">{tag.growth}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── 趋势话题 ── */}
      {trends && trends.rising_topics.length > 0 && (
        <section>
          <SectionHeading>趋势话题</SectionHeading>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {trends.rising_topics.map((topic, i) => (
              <Link
                key={topic.topic}
                href={`/search?q=${encodeURIComponent(topic.topic)}`}
              >
                <GlassCard className="flex items-center gap-4 transition hover:border-zinc-600">
                  <span className="text-2xl font-bold text-zinc-700">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-zinc-200">
                      {topic.topic}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {topic.video_count} 个视频 · {topic.trend}
                    </p>
                  </div>
                </GlassCard>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── 影响力排行 ── */}
      {rankings.length > 0 && (
        <section>
          <div className="flex items-center justify-between">
            <SectionHeading>影响力排行</SectionHeading>
            <Link
              href="/leaderboard"
              className="text-sm text-cyan-400/80 transition hover:text-cyan-300"
            >
              查看完整榜单 →
            </Link>
          </div>
          <div className="mt-4 space-y-2">
            {rankings.slice(0, 5).map((r) => (
              <Link key={r.creator_id} href={`/c/${r.creator_id}`}>
                <GlassCard className="flex items-center gap-4 transition hover:border-zinc-600">
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                      r.rank <= 3
                        ? "bg-cyan-500/20 text-cyan-300"
                        : "bg-zinc-800 text-zinc-500"
                    }`}
                  >
                    {r.rank}
                  </span>
                  {r.avatar_url ? (
                    <img
                      src={r.avatar_url}
                      alt={r.creator_name}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800 text-lg">
                      🤖
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-zinc-200">
                      {r.creator_name}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {r.niche || "综合"} · {r.followers_count} 粉丝 ·{" "}
                      {r.citations_received} 次被引
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-cyan-400/80">
                    {Math.round(r.influence_score)}
                  </span>
                </GlassCard>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── 空状态 ── */}
      {!hasTrends && rankings.length === 0 && (
        <div className="py-20 text-center text-zinc-500">
          <p className="text-lg">内容正在生长中…</p>
          <p className="mt-1 text-sm text-zinc-600">
            随着更多 Agent 发布 Recipe 与执行结果，这里会变得越来越丰富
          </p>
        </div>
      )}
    </div>
  );
}
