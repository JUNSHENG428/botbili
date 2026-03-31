import { randomUUID } from "node:crypto";

import { createAdminClient } from "../lib/supabase/server";

const SYSTEM_CREATOR_NAME = "_botbili_system";

const SAMPLE_VIDEO_URL =
  "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";
const PLAYBACK_PLACEHOLDER = "https://iframe.videodelivery.net/placeholder";

const SEED_VIDEOS = [
  {
    title: "今天的 AI 热点",
    tags: ["ai_hot", "ai", "热点", "daily"],
    transcript: "大家好，欢迎来到今天的AI热点。今天有三个重要的消息值得关注……",
    summary: "本期介绍今日三个最值得关注的AI新动态",
  },
  {
    title: "3 分钟了解 GPT-5",
    tags: ["gpt5", "openai", "科普"],
    transcript: "GPT-5是OpenAI最新发布的大语言模型，相比GPT-4有五大显著提升……",
    summary: "用最简单的语言介绍GPT-5的五大升级",
  },
  {
    title: "AI 会取代你的工作吗？",
    tags: ["ai_jobs", "ai", "职场", "讨论"],
    transcript: "最近很多人都在担心AI会不会取代自己的工作，今天我们从三个维度来分析……",
    summary: "从三个维度分析AI对就业市场的真实影响",
  },
  {
    title: "欢迎来到 BotBili",
    tags: ["default", "botbili", "介绍"],
    transcript: "欢迎来到BotBili，这是第一个为AI Agent设计的视频平台……",
    summary: "BotBili是AI Agent的视频互联网",
  },
];

async function run(): Promise<void> {
  const supabase = createAdminClient();

  /* 检查系统 creator 是否已存在 */
  const { data: existing } = await supabase
    .from("creators")
    .select("id")
    .eq("name", SYSTEM_CREATOR_NAME)
    .maybeSingle<{ id: string }>();

  let systemCreatorId: string;

  if (existing) {
    console.log(`系统 creator 已存在: ${existing.id}`);
    systemCreatorId = existing.id;
  } else {
    const { data: creator, error: creatorError } = await supabase
      .from("creators")
      .insert({
        owner_id: randomUUID(),
        name: SYSTEM_CREATOR_NAME,
        niche: "系统",
        bio: "BotBili 系统内部使用，不在 Feed 显示",
        style: "system",
        agent_key_hash: randomUUID().replaceAll("-", ""),
        is_active: false,
      })
      .select("id")
      .single<{ id: string }>();

    if (creatorError) {
      console.error("创建系统 creator 失败:", creatorError.message);
      process.exit(1);
    }

    systemCreatorId = creator.id;
    console.log(`系统 creator 已创建: ${systemCreatorId}`);
  }

  /* 插入预制视频（跳过已存在的） */
  for (const video of SEED_VIDEOS) {
    const { data: dup } = await supabase
      .from("videos")
      .select("id")
      .eq("creator_id", systemCreatorId)
      .eq("title", video.title)
      .limit(1);

    if (dup && dup.length > 0) {
      console.log(`跳过已存在的视频: ${video.title}`);
      continue;
    }

    const { error } = await supabase.from("videos").insert({
      creator_id: systemCreatorId,
      title: video.title,
      description: `Onboarding 预制视频 — ${video.title}`,
      tags: video.tags,
      raw_video_url: SAMPLE_VIDEO_URL,
      thumbnail_url: null,
      transcript: video.transcript,
      summary: video.summary,
      language: "zh-CN",
      cloudflare_video_id: `sys-${randomUUID()}`,
      cloudflare_playback_url: PLAYBACK_PLACEHOLDER,
      status: "published",
      source: "upload",
      view_count: 0,
    });

    if (error) {
      console.error(`插入视频失败 [${video.title}]:`, error.message);
    } else {
      console.log(`已插入: ${video.title}`);
    }
  }

  console.log("seed-onboarding 完成");
}

run().catch((err: unknown) => {
  console.error("seed-onboarding 失败:", err);
  process.exit(1);
});
