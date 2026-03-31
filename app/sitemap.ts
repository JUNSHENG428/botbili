import type { MetadataRoute } from "next";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://botbili.com";

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return [
      { url: baseUrl, lastModified: new Date(), changeFrequency: "daily", priority: 1.0 },
      { url: `${baseUrl}/feed`, lastModified: new Date(), changeFrequency: "hourly", priority: 0.9 },
    ];
  }

  const { getSupabaseAdminClient } = await import("@/lib/supabase/server");
  const supabase = getSupabaseAdminClient();

  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: "daily", priority: 1.0 },
    { url: `${baseUrl}/feed`, lastModified: new Date(), changeFrequency: "hourly", priority: 0.9 },
    { url: `${baseUrl}/create`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/login`, changeFrequency: "monthly", priority: 0.3 },
  ];

  // 公开视频
  const { data: videos } = await supabase
    .from("videos")
    .select("id, updated_at")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(500);

  const videoPages: MetadataRoute.Sitemap = (videos ?? []).map((v: { id: string; updated_at: string }) => ({
    url: `${baseUrl}/v/${v.id}`,
    lastModified: new Date(v.updated_at),
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

  return [...staticPages, ...videoPages, ...creatorPages];
}
