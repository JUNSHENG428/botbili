import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FollowButton } from "@/components/creator/follow-button";
import { CommentSection } from "@/components/video/comment-section";
import { LikeButton } from "@/components/video/like-button";
import { VideoPlayer } from "@/components/video/video-player";
import { VideoViewTracker } from "@/components/video/video-view-tracker";
import { formatViewCount } from "@/lib/format";
import { getFollowStatus } from "@/lib/follow-repository";
import { createClientForServer } from "@/lib/supabase/server";
import { getVideoById } from "@/lib/upload-repository";
import { getVideoInteractionSummary } from "@/lib/video-interactions";

interface VideoPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: VideoPageProps): Promise<Metadata> {
  const { id } = await params;
  const video = await getVideoById(id);
  if (!video) return { title: "视频不存在" };
  return {
    title: video.title,
    description: video.summary ?? video.description ?? `${video.creator.name} 的视频`,
    openGraph: {
      title: video.title,
      description: video.summary ?? video.description ?? undefined,
      images: video.thumbnail_url ? [{ url: video.thumbnail_url }] : undefined,
    },
  };
}

export default async function VideoPage({ params }: VideoPageProps) {
  const { id } = await params;
  const video = await getVideoById(id);
  if (!video) {
    notFound();
  }
  const supabase = await createClientForServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isLoggedIn = Boolean(user?.id);
  const isOwner = user?.id === video.creator.owner_id;
  const initialFollowing = user?.id ? await getFollowStatus(user.id, video.creator.id) : false;
  const interactions = await getVideoInteractionSummary(video.id);

  return (
    <div className="space-y-6">
      <VideoViewTracker videoId={video.id} />
      <VideoPlayer playbackUrl={video.cloudflare_playback_url ?? ""} title={video.title} />

      <div className="space-y-2">
        <h1 className="text-xl font-semibold text-zinc-100">{video.title}</h1>
        <div className="flex flex-wrap items-center gap-4">
          <p className="text-sm text-zinc-400">{formatViewCount(video.view_count)} 次播放</p>
          <LikeButton videoId={video.id} isLoggedIn={isLoggedIn} />
        </div>
      </div>

      {video.description ? <p className="text-sm text-zinc-300">{video.description}</p> : null}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <Link
          href={`/c/${video.creator.id}`}
          className="inline-flex rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-100 hover:border-zinc-500"
        >
          查看 UP 主：{video.creator.name}
        </Link>
        <FollowButton
          creatorId={video.creator.id}
          initialFollowing={initialFollowing}
          initialFollowersCount={video.creator.followers_count ?? 0}
          isLoggedIn={isLoggedIn}
          canFollow={!isOwner}
        />
      </div>

      {/* AI/Human 互动概览 */}
      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <h2 className="mb-1 text-sm font-semibold text-cyan-300">AI 区互动</h2>
          <p className="text-xs text-zinc-400">
            观看 {interactions.ai.view_count} · 点赞 {interactions.ai.like_count} · 转发{" "}
            {interactions.ai.share_count}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <h2 className="mb-1 text-sm font-semibold text-zinc-100">Human 区互动</h2>
          <p className="text-xs text-zinc-400">
            观看 {interactions.human.view_count} · 点赞 {interactions.human.like_count} · 转发{" "}
            {interactions.human.share_count}
          </p>
        </div>
      </section>

      {/* 独立评论区 */}
      <CommentSection videoId={video.id} isLoggedIn={isLoggedIn} />
    </div>
  );
}
