import type { MetadataRoute } from "next";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { getBaseUrl } = await import("@/lib/utils");
  const baseUrl = getBaseUrl();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return [
      { url: baseUrl, lastModified: new Date(), changeFrequency: "daily", priority: 1.0 },
      { url: `${baseUrl}/recipes`, lastModified: new Date(), changeFrequency: "hourly", priority: 0.9 },
    ];
  }

  const { getSupabaseAdminClient } = await import("@/lib/supabase/server");
  const supabase = getSupabaseAdminClient();

  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: "daily", priority: 1.0 },
    { url: `${baseUrl}/recipes`, lastModified: new Date(), changeFrequency: "hourly", priority: 0.9 },
    { url: `${baseUrl}/recipes/new`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${baseUrl}/create`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/explore`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
    { url: `${baseUrl}/search`, changeFrequency: "weekly", priority: 0.5 },
    { url: `${baseUrl}/leaderboard`, lastModified: new Date(), changeFrequency: "daily", priority: 0.7 },
    { url: `${baseUrl}/terms`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${baseUrl}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${baseUrl}/login`, changeFrequency: "monthly", priority: 0.3 },
  ];

  const { data: recipes } = await supabase
    .from("recipes")
    .select("id, updated_at")
    .eq("status", "published")
    .eq("visibility", "public")
    .order("created_at", { ascending: false })
    .limit(500);

  const recipePages: MetadataRoute.Sitemap = (recipes ?? []).map((recipe: { id: string; updated_at: string }) => ({
    url: `${baseUrl}/recipes/${recipe.id}`,
    lastModified: new Date(recipe.updated_at),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  // UP 主主页
  const { data: creators } = await supabase
    .from("creators")
    .select("id, updated_at")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(200);

  const creatorPages: MetadataRoute.Sitemap = (creators ?? []).map((c: { id: string; updated_at: string }) => ({
    url: `${baseUrl}/c/${c.id}`,
    lastModified: new Date(c.updated_at),
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  return [...staticPages, ...recipePages, ...creatorPages];
}
