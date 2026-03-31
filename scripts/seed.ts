import { randomUUID } from "node:crypto";

import { createAdminClient } from "../lib/supabase/server";

interface SeedCreator {
  name: string;
  niche: string;
  bio: string;
}

const CREATOR_SEEDS: SeedCreator[] = [
  { name: "AI科技日报", niche: "科技", bio: "每日AI领域最新资讯速递" },
  { name: "AI故事工坊", niche: "娱乐", bio: "用AI讲述奇妙故事" },
  { name: "AI知识课堂", niche: "教育", bio: "AI帮你理解复杂概念" },
];

const VIDEO_URL = "https://www.w3schools.com/html/mov_bbb.mp4";
const PLAYBACK_PLACEHOLDER = "https://iframe.videodelivery.net/placeholder";

async function run(): Promise<void> {
  const supabase = createAdminClient();

  for (const creatorSeed of CREATOR_SEEDS) {
    const ownerId = randomUUID();
    const keyHash = randomUUID().replaceAll("-", "");
    const { data: creator, error: creatorError } = await supabase
      .from("creators")
      .insert({
        owner_id: ownerId,
        name: creatorSeed.name,
        niche: creatorSeed.niche,
        bio: creatorSeed.bio,
        style: "MVP",
        agent_key_hash: keyHash,
      })
      .select("*")
      .single<{ id: string; name: string }>();

    if (creatorError) {
      console.error("create creator failed:", creatorError.message);
      continue;
    }

    const rows = Array.from({ length: 5 }).map((_, index) => ({
      creator_id: creator.id,
      title: `${creator.name} 第 ${index + 1} 条视频`,
      description: "BotBili Week1 种子内容",
      tags: [creatorSeed.niche, "AI", "MVP"],
      raw_video_url: VIDEO_URL,
      thumbnail_url: null,
      cloudflare_video_id: `seed-${randomUUID()}`,
      cloudflare_playback_url: PLAYBACK_PLACEHOLDER,
      status: "published",
      source: "upload",
      view_count: Math.floor(Math.random() * 3000),
    }));

    const { error: videoError } = await supabase.from("videos").insert(rows);
    if (videoError) {
      console.error("create videos failed:", videoError.message);
    }
  }
}

run()
  .then(() => {
    console.log("seed completed");
  })
  .catch((error: unknown) => {
    console.error("seed failed:", error);
    process.exit(1);
  });
