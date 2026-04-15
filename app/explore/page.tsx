import Link from "next/link";
import type { Metadata } from "next";

import { GlassCard } from "@/components/design/glass-card";
import { SectionHeading } from "@/components/design/section-heading";
import { EmptyStateActionCard } from "@/components/recipes/EmptyStateActionCard";
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

interface StarterRecipe {
  id: string;
  slug: string;
  title: string;
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

async function fetchStarterRecipes(): Promise<StarterRecipe[]> {
  try {
    const res = await fetch(`${getBaseUrl()}/api/recipes/recommended?limit=3&mode=starter`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) {
      return [];
    }

    const payload = (await res.json()) as StarterResponse;
    return payload.data?.recipes ?? [];
  } catch {
    return [];
  }
}

export default async function ExplorePage() {
  const [trends, rankings, starterRecipes] = await Promise.all([
    fetchTrends(),
    fetchLeaderboard(),
    fetchStarterRecipes(),
  ]);

  const hasTrends =
    trends &&
    (trends.hot_tags.length > 0 || trends.rising_topics.length > 0);

  return (
    <div className="space-y-10 py-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">发现</h1>
          <p className="mt-1 text-sm text-zinc-500">
            先找一条能快速跑通的 Recipe，再去看趋势和优质频道。
          </p>
      </div>

      {starterRecipes.length > 0 ? (
        <section>
          <div className="flex items-center justify-between">
            <SectionHeading>新手友好 Recipe</SectionHeading>
            <Link
              href="/recipes?sort=trending&difficulty=beginner"
              className="text-sm text-cyan-400/80 transition hover:text-cyan-300"
            >
              查看更多 →
            </Link>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {starterRecipes.map((recipe) => (
              <Link key={recipe.id} href={`/recipes/${recipe.slug || recipe.id}`}>
                <GlassCard className="space-y-3 transition hover:border-zinc-600">
                  <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                    <span className="rounded-full border border-cyan-500/30 px-2 py-1 text-cyan-300">新手友好</span>
                    <span className="rounded-full border border-zinc-700 px-2 py-1">先跑通再扩展</span>
                  </div>
                  <p className="text-base font-semibold text-zinc-100">{recipe.title}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500">
                    {typeof recipe.execution_count === "number" ? <span>▶ {recipe.execution_count} 次执行</span> : null}
                    {typeof recipe.success_rate === "number" ? (
                      <span>✓ {Math.round(recipe.success_rate * 100)}% 成功率</span>
                    ) : null}
                    {typeof recipe.output_count === "number" ? <span>📺 {recipe.output_count} 条公开结果</span> : null}
                  </div>
                </GlassCard>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

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
        <EmptyStateActionCard
          icon="🧭"
          title="先从一条可跑通的 Recipe 开始"
          description="趋势数据还在积累，但你不需要等。先去跑一条新手友好的公开 Recipe，拿到第一个公开结果再回来探索。"
          actionLabel="去看新手友好 Recipe"
          actionHref="/recipes?sort=trending&difficulty=beginner"
          secondaryLabel="打开 onboarding"
          secondaryHref="/onboarding"
        />
      )}
    </div>
  );
}
