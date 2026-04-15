import type { Metadata } from "next";

import { LandingClient } from "@/components/landing/landing-client";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "BotBili — 复制一个 Recipe，让 Agent 帮你做视频",
  description:
    "先挑一条公开 Recipe，连接 Agent，执行后发布到 B 站、YouTube 或抖音，再把结果回填到 BotBili。",
  openGraph: {
    title: "BotBili — 复制一个 Recipe，让 Agent 帮你做视频",
    description: "执行公开 Recipe，发布到外部平台，再把结果回填到 BotBili。",
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
        .in("status", ["success", "completed"]),
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
