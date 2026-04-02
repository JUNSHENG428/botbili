import { NextRequest, NextResponse } from "next/server";

import { createClientForServer } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

type ReportReason = "inappropriate" | "spam" | "copyright" | "misinformation" | "other";

const VALID_REASONS: ReportReason[] = [
  "inappropriate",
  "spam",
  "copyright",
  "misinformation",
  "other",
];

interface ReportBody {
  reason: ReportReason;
  detail?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id: videoId } = await params;

    // 验证用户登录状态
    const supabaseUser = await createClientForServer();
    const {
      data: { user },
    } = await supabaseUser.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });
    }

    // 解析请求体
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body", code: "INVALID_REQUEST_BODY" }, { status: 400 });
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body", code: "INVALID_REQUEST_BODY" }, { status: 400 });
    }

    const { reason, detail } = body as Partial<ReportBody>;

    if (!reason || !VALID_REASONS.includes(reason)) {
      return NextResponse.json(
        {
          error: `Invalid reason. Must be one of: ${VALID_REASONS.join(", ")}`,
          code: "INVALID_REASON",
        },
        { status: 400 },
      );
    }

    if (detail !== undefined && typeof detail !== "string") {
      return NextResponse.json({ error: "Invalid detail", code: "INVALID_DETAIL" }, { status: 400 });
    }

    // 验证视频存在
    const supabaseAdmin = getSupabaseAdminClient();
    const { data: video } = await supabaseAdmin
      .from("videos")
      .select("id")
      .eq("id", videoId)
      .maybeSingle<{ id: string }>();

    if (!video) {
      return NextResponse.json({ error: "Video not found", code: "VIDEO_NOT_FOUND" }, { status: 404 });
    }

    // 插入举报记录
    const { error } = await supabaseAdmin.from("reports").insert({
      video_id: videoId,
      reporter_id: user.id,
      reporter_type: "human",
      reason,
      detail: detail ?? null,
      status: "pending",
    });

    if (error) {
      console.error("Failed to insert report:", error.message);
      return NextResponse.json({ error: "Failed to submit report", code: "INTERNAL_ERROR" }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error: unknown) {
    console.error("POST /api/videos/[id]/report failed:", error);
    return NextResponse.json({ error: "Internal server error", code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
