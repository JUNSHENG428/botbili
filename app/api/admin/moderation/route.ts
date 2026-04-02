import { NextRequest, NextResponse } from "next/server";

import { createClientForServer } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

type ModerationAction = "dismiss" | "action";

interface ModerationBody {
  report_id: string;
  action: ModerationAction;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // 验证管理员身份
    const supabaseUser = await createClientForServer();
    const {
      data: { user },
    } = await supabaseUser.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });
    }

    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail || user.email !== adminEmail) {
      return NextResponse.json({ error: "Forbidden", code: "AUTH_FORBIDDEN" }, { status: 403 });
    }

    // 解析请求体
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body", code: "INVALID_REQUEST_BODY" },
        { status: 400 },
      );
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid request body", code: "INVALID_REQUEST_BODY" },
        { status: 400 },
      );
    }

    const { report_id, action } = body as Partial<ModerationBody>;

    if (typeof report_id !== "string" || !report_id) {
      return NextResponse.json(
        { error: "Missing report_id", code: "INVALID_REPORT_ID" },
        { status: 400 },
      );
    }

    if (action !== "dismiss" && action !== "action") {
      return NextResponse.json(
        { error: "Invalid action. Must be 'dismiss' or 'action'", code: "INVALID_ACTION" },
        { status: 400 },
      );
    }

    const supabase = getSupabaseAdminClient();

    // 获取举报记录
    const { data: report } = await supabase
      .from("reports")
      .select("id, video_id, status")
      .eq("id", report_id)
      .maybeSingle<{ id: string; video_id: string; status: string }>();

    if (!report) {
      return NextResponse.json(
        { error: "Report not found", code: "REPORT_NOT_FOUND" },
        { status: 404 },
      );
    }

    if (report.status !== "pending") {
      return NextResponse.json(
        { error: "Report already resolved", code: "REPORT_ALREADY_RESOLVED" },
        { status: 409 },
      );
    }

    if (action === "dismiss") {
      // 更新举报状态为 dismissed
      const { error } = await supabase
        .from("reports")
        .update({ status: "dismissed" })
        .eq("id", report_id);

      if (error) {
        console.error("Failed to dismiss report:", error.message);
        return NextResponse.json(
          { error: "Failed to update report", code: "INTERNAL_ERROR" },
          { status: 500 },
        );
      }
    } else {
      // action: 更新举报状态为 actioned + 将视频状态设为 rejected
      const { error: reportError } = await supabase
        .from("reports")
        .update({ status: "actioned" })
        .eq("id", report_id);

      if (reportError) {
        console.error("Failed to action report:", reportError.message);
        return NextResponse.json(
          { error: "Failed to update report", code: "INTERNAL_ERROR" },
          { status: 500 },
        );
      }

      const { error: videoError } = await supabase
        .from("videos")
        .update({ status: "rejected" })
        .eq("id", report.video_id);

      if (videoError) {
        console.error("Failed to reject video:", videoError.message);
        return NextResponse.json(
          { error: "Failed to update video", code: "INTERNAL_ERROR" },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("POST /api/admin/moderation failed:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}
