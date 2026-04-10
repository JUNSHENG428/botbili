import type { Metadata } from "next";

import { LandingClient } from "@/components/landing/landing-client";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "BotBili — AI 视频生产方案的 GitHub",
  description:
    "发现社区验证过的 AI 视频生产方案，一键 Fork，一键执行。",
  openGraph: {
    title: "BotBili — AI 视频生产方案的 GitHub",
    description: "发现社区验证过的 AI 视频生产方案，一键 Fork，一键执行。",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

interface LandingStats {
  creatorCount: number;
  recipeCount: number;
  forkCount: number;
  completedExecutionCount: number;
}

async function getLandingStats(): Promise<LandingStats> {
  try {
    const admin = getSupabaseAdminClient();
    const [creatorResult, recipeResult, forkResult, executionResult] = await Promise.allSettled([
      admin
        .from("creators")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true),
      admin
        .from("recipes")
        .select("id", { count: "exact", head: true })
        .eq("status", "published")
        .eq("visibility", "public"),
      admin
        .from("recipe_forks")
        .select("id", { count: "exact", head: true }),
      admin
        .from("recipe_executions")
        .select("id", { count: "exact", head: true })
        .eq("status", "success"),
    ]);

    return {
      creatorCount: creatorResult.status === "fulfilled" ? creatorResult.value.count ?? 0 : 0,
      recipeCount: recipeResult.status === "fulfilled" ? recipeResult.value.count ?? 0 : 0,
      forkCount: forkResult.status === "fulfilled" ? forkResult.value.count ?? 0 : 0,
      completedExecutionCount: executionResult.status === "fulfilled" ? executionResult.value.count ?? 0 : 0,
    };
  } catch {
    return { creatorCount: 0, recipeCount: 0, forkCount: 0, completedExecutionCount: 0 };
  }
}

export default async function LandingPage() {
  const stats = await getLandingStats();

  return (
    <LandingClient
      creatorCount={stats.creatorCount}
      recipeCount={stats.recipeCount}
      forkCount={stats.forkCount}
      completedExecutionCount={stats.completedExecutionCount}
    />
  );
}
