import { NextRequest, NextResponse } from "next/server";

import { createClientForServer, getSupabaseAdminClient } from "@/lib/supabase/server";

interface DashboardCreator {
  id: string;
  name: string;
  bio: string;
  niche: string;
  avatar_url: string | null;
  followers_count: number;
  agent_key_hash: string;
  is_active: boolean;
  owner_id: string;
  guardian_id: string | null;
}

interface DashboardVideo {
  id: string;
  title: string;
  thumbnail_url: string | null;
  status: string;
  view_count: number;
  like_count: number;
  comment_count: number;
  duration_seconds: number | null;
  created_at: string;
}

interface DashboardCreatorLookup {
  id: string;
}

interface GuardedChannel {
  id: string;
  name: string;
  avatar_url: string | null;
  source: string;
  is_active: boolean;
}

interface DashboardResponse {
  creator: {
    id: string;
    name: string;
    bio: string;
    avatar_url: string | null;
    followers_count: number;
    video_count: number;
    total_views: number;
  };
  videos: DashboardVideo[];
  guarded_channels?: GuardedChannel[];
}

/**
 * GET /api/dashboard?creator_id=xxx
 * 聚合返回频道信息 + 视频列表（MVP 无需认证）。
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const requestedCreatorId = req.nextUrl.searchParams.get("creator_id")?.trim() ?? "";
    const supabase = getSupabaseAdminClient();
    let creatorId = requestedCreatorId;

    // 允许已登录用户在未显式传 creator_id 时，自动解析自己的默认频道。
    if (!creatorId) {
      const userSupabase = await createClientForServer();
      const {
        data: { user },
      } = await userSupabase.auth.getUser();

      if (!user?.id) {
        return NextResponse.json({ error: "频道不存在" }, { status: 404 });
      }

      const { data: ownedCreator, error: ownedCreatorErr } = await supabase
        .from("creators")
        .select("id")
        .eq("owner_id", user.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<DashboardCreatorLookup>();

      if (ownedCreatorErr) {
        console.error("dashboard owner creator query error:", ownedCreatorErr);
        return NextResponse.json({ error: "加载频道失败" }, { status: 500 });
      }

      if (!ownedCreator) {
        return NextResponse.json({ error: "频道不存在" }, { status: 404 });
      }

      creatorId = ownedCreator.id;
    }

    const { data: creator, error: creatorErr } = await supabase
      .from("creators")
      .select("id, name, bio, niche, avatar_url, followers_count, agent_key_hash, is_active, owner_id, guardian_id")
      .eq("id", creatorId)
      .maybeSingle<DashboardCreator>();

    if (creatorErr || !creator) {
      return NextResponse.json({ error: "频道不存在" }, { status: 404 });
    }

    // When a specific creator_id was requested, verify current user is owner or guardian
    if (requestedCreatorId) {
      const authSupabase = await createClientForServer();
      const { data: { user: authUser } } = await authSupabase.auth.getUser();
      if (!authUser?.id || (creator.owner_id !== authUser.id && creator.guardian_id !== authUser.id)) {
        return NextResponse.json({ error: "无权访问此频道" }, { status: 403 });
      }
    }

    const { data: videos, error: videosErr } = await supabase
      .from("videos")
      .select("id, title, thumbnail_url, status, view_count, like_count, comment_count, duration_seconds, created_at")
      .eq("creator_id", creatorId)
      .order("created_at", { ascending: false })
      .returns<DashboardVideo[]>();

    if (videosErr) {
      console.error("dashboard videos query error:", videosErr);
      return NextResponse.json({ error: "加载视频列表失败" }, { status: 500 });
    }

    const videoList = videos ?? [];
    const totalViews = videoList.reduce((sum, v) => sum + v.view_count, 0);

    // 查询当前用户监护的频道
    let guardedChannels: GuardedChannel[] | undefined;
    try {
      const userSupabase2 = await createClientForServer();
      const { data: { user: currentUser } } = await userSupabase2.auth.getUser();
      if (currentUser?.id) {
        const { data: guarded } = await supabase
          .from("creators")
          .select("id, name, avatar_url, source, is_active")
          .eq("guardian_id", currentUser.id)
          .order("created_at", { ascending: false })
          .returns<GuardedChannel[]>();
        if (guarded && guarded.length > 0) {
          guardedChannels = guarded;
        }
      }
    } catch {
      // 监护频道查询失败不影响主流程
    }

    const response: DashboardResponse = {
      creator: {
        id: creator.id,
        name: creator.name,
        bio: creator.bio,
        avatar_url: creator.avatar_url,
        followers_count: creator.followers_count,
        video_count: videoList.length,
        total_views: totalViews,
      },
      videos: videoList,
      guarded_channels: guardedChannels,
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("GET /api/dashboard failed:", err);
    return NextResponse.json({ error: "服务暂时不可用" }, { status: 500 });
  }
}
