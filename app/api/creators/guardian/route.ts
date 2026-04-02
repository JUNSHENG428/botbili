import { NextRequest, NextResponse } from "next/server";

import { createClientForServer, getSupabaseAdminClient } from "@/lib/supabase/server";

/**
 * POST /api/creators/guardian
 *
 * 监护人操作：暂停/恢复频道、删除视频。
 *
 * Body:
 *   { action: "pause_channel", creator_id: "xxx" }
 *   { action: "resume_channel", creator_id: "xxx" }
 *   { action: "delete_video", creator_id: "xxx", video_id: "yyy" }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // 1. 验证登录
    const userSupabase = await createClientForServer();
    const {
      data: { user },
    } = await userSupabase.auth.getUser();

    if (!user?.id) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    // 2. 读取 body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "请求格式不正确" }, { status: 400 });
    }

    const { action, creator_id, video_id } = (body ?? {}) as {
      action?: string;
      creator_id?: string;
      video_id?: string;
    };

    if (!action || !creator_id) {
      return NextResponse.json({ error: "缺少 action 或 creator_id" }, { status: 400 });
    }

    // 3. 验证监护权限：guardian_id = user.id 或 owner_id = user.id
    const supabase = getSupabaseAdminClient();
    const { data: creator, error: findErr } = await supabase
      .from("creators")
      .select("id, name, guardian_id, owner_id, is_active")
      .eq("id", creator_id)
      .maybeSingle();

    if (findErr || !creator) {
      return NextResponse.json({ error: "频道不存在" }, { status: 404 });
    }

    const isGuardian = creator.guardian_id === user.id;
    const isOwner = creator.owner_id === user.id;

    if (!isGuardian && !isOwner) {
      return NextResponse.json(
        { error: "你没有该频道的管理权限" },
        { status: 403 },
      );
    }

    // 4. 执行操作
    switch (action) {
      case "pause_channel": {
        const { error } = await supabase
          .from("creators")
          .update({ is_active: false })
          .eq("id", creator_id);
        if (error) throw error;
        return NextResponse.json({
          success: true,
          message: `「${creator.name}」已暂停`,
        });
      }

      case "resume_channel": {
        const { error } = await supabase
          .from("creators")
          .update({ is_active: true })
          .eq("id", creator_id);
        if (error) throw error;
        return NextResponse.json({
          success: true,
          message: `「${creator.name}」已恢复`,
        });
      }

      case "delete_video": {
        if (!video_id) {
          return NextResponse.json({ error: "缺少 video_id" }, { status: 400 });
        }

        // 确认视频属于该频道
        const { data: video, error: videoErr } = await supabase
          .from("videos")
          .select("id, creator_id")
          .eq("id", video_id)
          .eq("creator_id", creator_id)
          .maybeSingle();

        if (videoErr || !video) {
          return NextResponse.json({ error: "视频不存在" }, { status: 404 });
        }

        const { error: deleteErr } = await supabase
          .from("videos")
          .delete()
          .eq("id", video_id);

        if (deleteErr) throw deleteErr;
        return NextResponse.json({
          success: true,
          message: "视频已删除",
        });
      }

      default:
        return NextResponse.json(
          { error: `不支持的操作: ${action}` },
          { status: 400 },
        );
    }
  } catch (err) {
    console.error("POST /api/creators/guardian failed:", err);
    return NextResponse.json(
      { error: "操作失败，请重试" },
      { status: 500 },
    );
  }
}
