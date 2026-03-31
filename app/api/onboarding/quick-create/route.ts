import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { generateApiKey } from "@/lib/auth";
import { createCreator } from "@/lib/upload-repository";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const VALID_TOPICS = ["ai_hot", "gpt5", "ai_jobs", "custom"] as const;
type Topic = (typeof VALID_TOPICS)[number];

const TOPIC_TO_NICHE: Record<Topic, string> = {
  ai_hot: "科技",
  gpt5: "科技",
  ai_jobs: "职场",
  custom: "综合",
};

/** 系统预制 creator 的固定名称 */
const SYSTEM_CREATOR_NAME = "_botbili_system";

interface QuickCreateBody {
  channel_name?: string;
  topic?: string;
  custom_prompt?: string;
}

interface QuickCreateResponse {
  creator_id: string;
  creator_name: string;
  first_video: {
    id: string;
    title: string;
    thumbnail_url: string | null;
    url: string;
  } | null;
  channel_url: string;
}

/**
 * POST /api/onboarding/quick-create
 * Onboarding 一步到位：创建频道 + 匹配预制视频 + 返回结果。
 * MVP 阶段无需登录。
 */
export async function POST(
  request: Request,
): Promise<NextResponse<QuickCreateResponse | { error: string }>> {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "请求格式不正确" }, { status: 400 });
    }

    const { channel_name, topic, custom_prompt } = (body ?? {}) as QuickCreateBody;

    /* ── 校验 channel_name ── */
    const trimmedName = channel_name?.trim() ?? "";
    if (trimmedName.length < 2 || trimmedName.length > 30) {
      return NextResponse.json(
        { error: "频道名需要 2-30 个字符" },
        { status: 400 },
      );
    }

    /* ── 校验 topic ── */
    const validTopic: Topic =
      topic && VALID_TOPICS.includes(topic as Topic)
        ? (topic as Topic)
        : "custom";

    /* ── 唯一性检查 ── */
    const supabase = getSupabaseAdminClient();
    const { data: existing } = await supabase
      .from("creators")
      .select("id")
      .ilike("name", trimmedName)
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: "这个名字已被使用" },
        { status: 409 },
      );
    }

    /* ── 创建 creator ── */
    const niche = TOPIC_TO_NICHE[validTopic];
    const bio = `${trimmedName} · AI 视频频道`;
    const keyPair = generateApiKey();
    const ownerId = randomUUID();

    const creator = await createCreator(
      ownerId,
      { name: trimmedName, niche, bio },
      keyPair.hash,
    );

    /* ── 匹配预制视频并复制到新频道 ── */
    let firstVideo: QuickCreateResponse["first_video"] = null;

    const { data: systemCreator } = await supabase
      .from("creators")
      .select("id")
      .eq("name", SYSTEM_CREATOR_NAME)
      .maybeSingle<{ id: string }>();

    if (systemCreator) {
      const tagToMatch = validTopic === "custom" ? "default" : validTopic;

      const { data: templateVideos } = await supabase
        .from("videos")
        .select("*")
        .eq("creator_id", systemCreator.id)
        .eq("status", "published")
        .contains("tags", [tagToMatch])
        .limit(1);

      const template = templateVideos?.[0] as Record<string, unknown> | undefined;

      if (template) {
        const { data: newVideo, error: copyError } = await supabase
          .from("videos")
          .insert({
            creator_id: creator.id,
            title: template.title,
            description: template.description ?? "",
            tags: template.tags ?? [],
            raw_video_url: template.raw_video_url,
            thumbnail_url: template.thumbnail_url ?? null,
            transcript: template.transcript ?? null,
            summary: template.summary ?? null,
            language: template.language ?? "zh-CN",
            cloudflare_video_id: `onboard-${randomUUID()}`,
            cloudflare_playback_url: template.cloudflare_playback_url ?? null,
            status: "published",
            source: "upload",
            view_count: 0,
          })
          .select("id, title, thumbnail_url")
          .single<{ id: string; title: string; thumbnail_url: string | null }>();

        if (!copyError && newVideo) {
          firstVideo = {
            id: newVideo.id,
            title: newVideo.title,
            thumbnail_url: newVideo.thumbnail_url,
            url: `/v/${newVideo.id}`,
          };
        }
      }
    }

    /* 如果没找到预制视频（系统 creator 不存在或 tag 不匹配），用 custom_prompt 做 fallback 标题 */
    if (!firstVideo && validTopic === "custom" && custom_prompt?.trim()) {
      const { data: fallback, error: fbError } = await supabase
        .from("videos")
        .insert({
          creator_id: creator.id,
          title: custom_prompt.trim().slice(0, 80),
          description: "由 onboarding 自动创建",
          tags: ["onboarding", "自定义"],
          raw_video_url: "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
          thumbnail_url: null,
          transcript: null,
          summary: null,
          language: "zh-CN",
          cloudflare_video_id: `onboard-${randomUUID()}`,
          cloudflare_playback_url: null,
          status: "published",
          source: "upload",
          view_count: 0,
        })
        .select("id, title, thumbnail_url")
        .single<{ id: string; title: string; thumbnail_url: string | null }>();

      if (!fbError && fallback) {
        firstVideo = {
          id: fallback.id,
          title: fallback.title,
          thumbnail_url: fallback.thumbnail_url,
          url: `/v/${fallback.id}`,
        };
      }
    }

    return NextResponse.json(
      {
        creator_id: creator.id,
        creator_name: trimmedName,
        first_video: firstVideo,
        channel_url: `/c/${creator.id}`,
      },
      { status: 201 },
    );
  } catch (err: unknown) {
    console.error("POST /api/onboarding/quick-create failed:", err);
    const message = err instanceof Error ? err.message : "";
    if (message.includes("duplicate key value")) {
      return NextResponse.json({ error: "这个名字已被使用" }, { status: 409 });
    }
    return NextResponse.json({ error: "服务暂时不可用，请稍后重试" }, { status: 500 });
  }
}
