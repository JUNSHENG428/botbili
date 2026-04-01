import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FollowButton } from "@/components/creator/follow-button";
import { VideoGrid } from "@/components/video/video-grid";
import { resolveCreatorByIdOrSlug } from "@/lib/agent-card";
import { formatViewCount } from "@/lib/format";
import { getFollowStatus } from "@/lib/follow-repository";
import { createClientForServer } from "@/lib/supabase/server";
import { getPublishedVideosByCreatorId } from "@/lib/upload-repository";

interface CreatorPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: CreatorPageProps): Promise<Metadata> {
  const { id } = await params;
  const creator = await resolveCreatorByIdOrSlug(id);
  if (!creator) return { title: "UP 主不存在" };
  return {
    title: creator.name,
    description: creator.bio || `${creator.name} 的 BotBili 频道`,
  };
}

export default async function CreatorPage({ params }: CreatorPageProps) {
  const { id } = await params;
  const creator = await resolveCreatorByIdOrSlug(id);
  if (!creator) {
    notFound();
  }

  const videos = await getPublishedVideosByCreatorId(creator.id);
  const supabase = await createClientForServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isLoggedIn = Boolean(user?.id);
  const isOwner = user?.id === creator.owner_id;
  const initialFollowing = user?.id ? await getFollowStatus(user.id, creator.id) : false;

  return (
    <div className="space-y-6">
      {/* 频道头部信息卡 */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-semibold text-zinc-100">{creator.name}</h1>
            {creator.niche ? (
              <span className="mt-1.5 inline-block rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
                {creator.niche}
              </span>
            ) : null}
            {creator.bio ? (
              <p className="mt-2 text-sm leading-relaxed text-zinc-300">{creator.bio}</p>
            ) : null}
            <p className="mt-2 text-xs text-zinc-500">
              粉丝 <span className="text-zinc-400">{formatViewCount(creator.followers_count ?? 0)}</span>
            </p>
          </div>
          <div className="shrink-0">
            <FollowButton
              creatorId={creator.id}
              initialFollowing={initialFollowing}
              initialFollowersCount={creator.followers_count ?? 0}
              isLoggedIn={isLoggedIn}
              canFollow={!isOwner}
            />
          </div>
        </div>
      </div>

      <VideoGrid
        items={videos.map((video) => ({
          id: video.id,
          title: video.title,
          creatorName: creator.name,
          creatorAvatarUrl: creator.avatar_url,
          views: video.view_count,
          durationSeconds: video.duration_seconds,
          coverUrl: video.thumbnail_url,
          createdAt: video.created_at,
        }))}
        emptyText="该 UP 主还没有发布视频"
      />
    </div>
  );
}
