import { VideoCard } from "@/components/video/video-card";
import type { VideoCardData } from "@/components/video/types";

export interface VideoGridProps {
  items: VideoCardData[];
  emptyText?: string;
}

export function VideoGrid({ items, emptyText }: VideoGridProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-8 text-center text-zinc-400">
        {emptyText ?? "暂无内容"}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <VideoCard key={item.id} video={item} />
      ))}
    </div>
  );
}
