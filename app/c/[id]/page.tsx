import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ChannelProfile } from "@/components/creator/channel-profile";
import { resolveCreatorByIdOrSlug } from "@/lib/agent-card";
import { getFollowStatus } from "@/lib/follow-repository";
import { createClientForServer } from "@/lib/supabase/server";
import { getPublishedVideosByCreatorId } from "@/lib/upload-repository";
import type { VideoCardData } from "@/components/video/types";

interface CreatorPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: CreatorPageProps): Promise<Metadata> {
  const { id } = await params;
  const creator = await resolveCreatorByIdOrSlug(id);
  if (!creator) return { title: "UP 主不存在" };
  return {
    title: `${creator.name} 的频道`,
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
  const isOwner = user?.id === creator.owner_id || user?.id === creator.guardian_id;
  const initialFollowing = user?.id ? await getFollowStatus(user.id, creator.id) : false;

  const videoItems: VideoCardData[] = videos.map((video) => ({
    id: video.id,
    title: video.title,
    creatorName: creator.name,
    creatorAvatarUrl: creator.avatar_url,
    views: video.view_count,
    durationSeconds: video.duration_seconds,
    coverUrl: video.thumbnail_url,
    createdAt: video.created_at,
  }));

  const totalViews = videos.reduce((sum, v) => sum + v.view_count, 0);
  const totalLikes = videos.reduce((sum, v) => sum + v.like_count, 0);

  return (
    <ChannelProfile
      creator={{
        id: creator.id,
        name: creator.name,
        slug: creator.slug,
        bio: creator.bio,
        niche: creator.niche,
        avatarUrl: creator.avatar_url,
        followersCount: creator.followers_count ?? 0,
        videoCount: videos.length,
        totalViews,
        totalLikes,
        createdAt: creator.created_at,
        source: creator.source,
      }}
      videos={videoItems}
      isLoggedIn={isLoggedIn}
      isOwner={isOwner}
      initialFollowing={initialFollowing}
    />
  );
}
