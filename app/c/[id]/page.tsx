import { notFound } from "next/navigation";

import { FollowButton } from "@/components/creator/follow-button";
import { VideoGrid } from "@/components/video/video-grid";
import { formatViewCount } from "@/lib/format";
import { getFollowStatus } from "@/lib/follow-repository";
import { createClientForServer } from "@/lib/supabase/server";
import { getCreatorById, getPublishedVideosByCreatorId } from "@/lib/upload-repository";

interface CreatorPageProps {
  params: Promise<{ id: string }>;
}

export default async function CreatorPage({ params }: CreatorPageProps) {
  const { id } = await params;
  const creator = await getCreatorById(id);
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
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-zinc-100">{creator.name}</h1>
            <p className="mt-2 text-xs text-zinc-500">{creator.niche}</p>
            <p className="mt-2 text-xs text-zinc-400">
              粉丝 {formatViewCount(creator.followers_count ?? 0)}
            </p>
          </div>
          <FollowButton
            creatorId={creator.id}
            initialFollowing={initialFollowing}
            initialFollowersCount={creator.followers_count ?? 0}
            isLoggedIn={isLoggedIn}
            canFollow={!isOwner}
          />
        </div>
        {creator.bio ? <p className="mt-2 text-sm text-zinc-300">{creator.bio}</p> : null}
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
