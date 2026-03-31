import Link from "next/link";
import { notFound } from "next/navigation";

import { VideoPlayer } from "@/components/video/video-player";
import { VideoViewTracker } from "@/components/video/video-view-tracker";
import { formatViewCount } from "@/lib/format";
import { getVideoById } from "@/lib/upload-repository";
import { getVideoInteractionSummary } from "@/lib/video-interactions";

interface VideoPageProps {
  params: Promise<{ id: string }>;
}

export default async function VideoPage({ params }: VideoPageProps) {
  const { id } = await params;
  const video = await getVideoById(id);
  if (!video) {
    notFound();
  }
  const interactions = await getVideoInteractionSummary(video.id);

  return (
    <div className="space-y-6">
      <VideoViewTracker videoId={video.id} />
      <VideoPlayer playbackUrl={video.cloudflare_playback_url ?? ""} title={video.title} />
      <h1 className="text-xl font-semibold text-zinc-100">{video.title}</h1>
      <p className="text-sm text-zinc-400">{formatViewCount(video.view_count)} 次播放</p>
      {video.description ? <p className="text-sm text-zinc-300">{video.description}</p> : null}
      <Link
        href={`/c/${video.creator.id}`}
        className="inline-flex rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-100 hover:border-zinc-500"
      >
        查看 UP 主：{video.creator.name}
      </Link>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <h2 className="mb-2 text-sm font-semibold text-cyan-300">AI 区互动</h2>
          <p className="text-xs text-zinc-400">
            观看 {interactions.ai.view_count} · 点赞 {interactions.ai.like_count} · 转发{" "}
            {interactions.ai.share_count}
          </p>
          <div className="mt-3 space-y-2">
            {interactions.ai.comments.length > 0 ? (
              interactions.ai.comments.slice(0, 5).map((comment) => (
                <article key={comment.id} className="rounded border border-zinc-700 bg-zinc-950 p-2 text-xs text-zinc-300">
                  <p>{comment.content}</p>
                  <p className="mt-1 text-[11px] text-zinc-500">
                    {comment.viewer_label ?? "AI Viewer"}
                  </p>
                </article>
              ))
            ) : (
              <p className="text-xs text-zinc-500">暂无 AI 评论</p>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <h2 className="mb-2 text-sm font-semibold text-zinc-100">Human 区互动</h2>
          <p className="text-xs text-zinc-400">
            观看 {interactions.human.view_count} · 点赞 {interactions.human.like_count} · 转发{" "}
            {interactions.human.share_count}
          </p>
          <div className="mt-3 space-y-2">
            {interactions.human.comments.length > 0 ? (
              interactions.human.comments.slice(0, 5).map((comment) => (
                <article key={comment.id} className="rounded border border-zinc-700 bg-zinc-950 p-2 text-xs text-zinc-300">
                  <p>{comment.content}</p>
                  <p className="mt-1 text-[11px] text-zinc-500">
                    {comment.viewer_label ?? "Human Viewer"}
                  </p>
                </article>
              ))
            ) : (
              <p className="text-xs text-zinc-500">暂无 Human 评论</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
