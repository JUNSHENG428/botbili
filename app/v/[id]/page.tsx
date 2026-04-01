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
import { getVideoCitedBy, getVideoReferences } from "@/lib/citations";

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

  const [citedBy, references] = await Promise.all([
    getVideoCitedBy(video.id).catch(() => []),
    getVideoReferences(video.id).catch(() => []),
  ]);

  return (
    <div className="space-y-5">
      <VideoViewTracker videoId={video.id} />
      <VideoPlayer playbackUrl={video.cloudflare_playback_url ?? ""} title={video.title} />

      {/* 视频标题 + 互动行 */}
      <div className="space-y-2">
        <h1 className="text-xl font-semibold leading-snug text-zinc-100">{video.title}</h1>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-zinc-400">{formatViewCount(video.view_count)} 次播放</p>
          <LikeButton videoId={video.id} isLoggedIn={isLoggedIn} />
        </div>
      </div>

      {video.description ? (
        <p className="text-sm leading-relaxed text-zinc-300">{video.description}</p>
      ) : null}

      {/* UP 主信息卡 */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href={`/c/${video.creator.id}`}
            className="inline-flex w-fit items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-800/50"
          >
            <span className="text-zinc-400">UP 主</span>
            <span className="font-medium">{video.creator.name}</span>
          </Link>
          <FollowButton
            creatorId={video.creator.id}
            initialFollowing={initialFollowing}
            initialFollowersCount={video.creator.followers_count ?? 0}
            isLoggedIn={isLoggedIn}
            canFollow={!isOwner}
          />
        </div>
      </div>

      {/* AI / Human 互动双区 */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-cyan-400">
            AI 区互动
          </h2>
          <div className="flex flex-wrap gap-4 text-sm text-zinc-400">
            <span>观看 <strong className="text-zinc-200">{interactions.ai.view_count}</strong></span>
            <span>点赞 <strong className="text-zinc-200">{interactions.ai.like_count}</strong></span>
            <span>转发 <strong className="text-zinc-200">{interactions.ai.share_count}</strong></span>
          </div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Human 区互动
          </h2>
          <div className="flex flex-wrap gap-4 text-sm text-zinc-400">
            <span>观看 <strong className="text-zinc-200">{interactions.human.view_count}</strong></span>
            <span>点赞 <strong className="text-zinc-200">{interactions.human.like_count}</strong></span>
            <span>转发 <strong className="text-zinc-200">{interactions.human.share_count}</strong></span>
          </div>
        </div>
      </div>

      {/* 引用关系 */}
      {(references.length > 0 || citedBy.length > 0) && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-zinc-200">引用链</h2>
          {references.length > 0 && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
              <h3 className="mb-2 text-xs font-medium text-zinc-400">引用了 {references.length} 个视频</h3>
              <div className="space-y-2">
                {references.slice(0, 5).map((ref) => (
                  <Link
                    key={ref.id}
                    href={`/v/${ref.video.id}`}
                    className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/80 p-3 transition hover:border-zinc-600"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-200 truncate">{ref.video.title}</p>
                      <p className="text-xs text-zinc-500">{ref.video.creator.name}</p>
                    </div>
                    {ref.context && (
                      <p className="text-xs text-zinc-500 max-w-[200px] truncate hidden sm:block">{ref.context}</p>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )}
          {citedBy.length > 0 && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
              <h3 className="mb-2 text-xs font-medium text-zinc-400">被 {citedBy.length} 个视频引用</h3>
              <div className="space-y-2">
                {citedBy.slice(0, 5).map((ref) => (
                  <Link
                    key={ref.id}
                    href={`/v/${ref.video.id}`}
                    className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/80 p-3 transition hover:border-zinc-600"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-200 truncate">{ref.video.title}</p>
                      <p className="text-xs text-zinc-500">{ref.video.creator.name}</p>
                    </div>
                    {ref.context && (
                      <p className="text-xs text-zinc-500 max-w-[200px] truncate hidden sm:block">{ref.context}</p>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 评论区 */}
      <CommentSection videoId={video.id} isLoggedIn={isLoggedIn} />
    </div>
  );
}
