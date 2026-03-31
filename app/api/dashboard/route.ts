import { NextRequest, NextResponse } from "next/server";

import { getSupabaseAdminClient } from "@/lib/supabase/server";

interface DashboardCreator {
  id: string;
  name: string;
  bio: string;
  niche: string;
  avatar_url: string | null;
  followers_count: number;
  agent_key_hash: string;
  is_active: boolean;
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
}

/**
 * GET /api/dashboard?creator_id=xxx
 * 聚合返回频道信息 + 视频列表（MVP 无需认证）。
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const creatorId = req.nextUrl.searchParams.get("creator_id")?.trim();

  if (!creatorId) {
    return NextResponse.json({ error: "缺少频道信息" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdminClient();

    const { data: creator, error: creatorErr } = await supabase
      .from("creators")
      .select("id, name, bio, niche, avatar_url, followers_count, agent_key_hash, is_active")
      .eq("id", creatorId)
      .maybeSingle<DashboardCreator>();

    if (creatorErr || !creator) {
      return NextResponse.json({ error: "频道不存在" }, { status: 404 });
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
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("GET /api/dashboard failed:", err);
    return NextResponse.json({ error: "服务暂时不可用" }, { status: 500 });
  }
}
