import { NextResponse } from "next/server";

import { moderateText } from "@/lib/moderation";
import { checkAndIncrementQuota } from "@/lib/quota";
import { createClientForServer, getSupabaseAdminClient } from "@/lib/supabase/server";
import { isHttpUrl } from "@/lib/utils";

interface UploadBody {
  creator_id?: string;
  title?: string;
  video_url?: string;
  description?: string;
  tags?: string;
  transcript?: string;
}

interface UploadResult {
  video_id: string;
  url: string;
  status: string;
}

const ERROR_MAP: Record<string, string> = {
  INVALID_TITLE: "请输入视频标题",
  INVALID_VIDEO_URL: "视频链接无效，请粘贴完整的 MP4 链接",
  QUOTA_EXCEEDED: "本月上传额度已用完，下月自动恢复",
  MODERATION_REJECTED: "内容审核未通过，请调整后再试",
  CREATOR_NOT_FOUND: "频道不存在",
};

/**
 * POST /api/dashboard/upload
 * 网页版上传：必须登录 + 验证频道所有权。
 */
export async function POST(
  request: Request,
): Promise<NextResponse<UploadResult | { error: string; code?: string }>> {
  try {
    // ── 登录验证 ──
    const authClient = await createClientForServer();
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "请求格式不正确" }, { status: 400 });
    }

    const { creator_id, title, video_url, description, tags, transcript } = (body ?? {}) as UploadBody;

    if (!creator_id?.trim()) {
      return NextResponse.json({ error: "缺少频道信息", code: "CREATOR_NOT_FOUND" }, { status: 400 });
    }

    const trimmedTitle = title?.trim() ?? "";
    if (!trimmedTitle || trimmedTitle.length > 200) {
      return NextResponse.json({ error: ERROR_MAP.INVALID_TITLE, code: "INVALID_TITLE" }, { status: 400 });
    }

    const trimmedUrl = video_url?.trim() ?? "";
    if (!trimmedUrl || !isHttpUrl(trimmedUrl)) {
      return NextResponse.json({ error: ERROR_MAP.INVALID_VIDEO_URL, code: "INVALID_VIDEO_URL" }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();

    /* 验证 creator 存在 + 所有权 */
    const { data: creator } = await supabase
      .from("creators")
      .select("id, is_active, owner_id")
      .eq("id", creator_id.trim())
      .maybeSingle<{ id: string; is_active: boolean; owner_id: string }>();

    if (!creator) {
      return NextResponse.json({ error: ERROR_MAP.CREATOR_NOT_FOUND, code: "CREATOR_NOT_FOUND" }, { status: 404 });
    }

    /* 所有权校验 */
    if (creator.owner_id !== user.id) {
      return NextResponse.json({ error: "无权操作此频道" }, { status: 403 });
    }

    /* 配额检查 */
    const quotaOk = await checkAndIncrementQuota(creator.id);
    if (!quotaOk) {
      return NextResponse.json({ error: ERROR_MAP.QUOTA_EXCEEDED, code: "QUOTA_EXCEEDED" }, { status: 429 });
    }

    /* 内容审核 */
    const modInput = `${trimmedTitle}\n${description ?? ""}`;
    const modResult = await moderateText(modInput);
    if (modResult.flagged) {
      return NextResponse.json({ error: ERROR_MAP.MODERATION_REJECTED, code: "MODERATION_REJECTED" }, { status: 422 });
    }

    /* 解析 tags */
    const tagList = tags
      ? tags.split(/[,，]/).map((t) => t.trim()).filter(Boolean).slice(0, 10)
      : [];

    /* 直接入库（MVP：跳过 Cloudflare 转码，status=published） */
    const { data: video, error: insertErr } = await supabase
      .from("videos")
      .insert({
        creator_id: creator.id,
        title: trimmedTitle,
        description: description?.trim() ?? "",
        tags: tagList,
        raw_video_url: trimmedUrl,
        thumbnail_url: null,
        transcript: transcript?.trim() || null,
        summary: null,
        language: "zh-CN",
        cloudflare_video_id: `web-${crypto.randomUUID()}`,
        cloudflare_playback_url: null,
        status: "published",
        source: "upload",
        view_count: 0,
      })
      .select("id")
      .single<{ id: string }>();

    if (insertErr || !video) {
      console.error("dashboard upload insert error:", insertErr);
      return NextResponse.json({ error: "上传失败，请稍后重试" }, { status: 500 });
    }

    return NextResponse.json(
      { video_id: video.id, url: `/v/${video.id}`, status: "published" },
      { status: 201 },
    );
  } catch (err) {
    console.error("POST /api/dashboard/upload failed:", err);
    return NextResponse.json({ error: "服务暂时不可用，请稍后重试" }, { status: 500 });
  }
}
