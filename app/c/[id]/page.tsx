import { notFound } from "next/navigation";

import { VideoGrid } from "@/components/video/video-grid";
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

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
        <h1 className="text-xl font-semibold text-zinc-100">{creator.name}</h1>
        {creator.bio ? <p className="mt-2 text-sm text-zinc-300">{creator.bio}</p> : null}
        <p className="mt-2 text-xs text-zinc-500">{creator.niche}</p>
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
