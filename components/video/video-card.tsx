import Link from "next/link";

import { formatDuration, formatRelativeTime, formatViewCount } from "@/lib/format";
import type { VideoCardData } from "./types";

export interface VideoCardProps {
  video: VideoCardData;
  className?: string;
}

export function VideoCard({ video, className }: VideoCardProps) {
  const { id, title, creatorName, views, durationSeconds, createdAt, coverUrl } = video;

  return (
    <Link
      href={`/v/${id}`}
      className={[
        "group block overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/80",
        "transition-colors hover:border-zinc-700 focus-visible:outline-none",
        "focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={`查看视频：${title}`}
    >
      <div className="relative aspect-video overflow-hidden bg-zinc-800">
        {coverUrl ? (
          <div
            className="h-full w-full bg-cover bg-center transition-transform duration-300 group-hover:scale-105"
            style={{ backgroundImage: `url(${coverUrl})` }}
            aria-hidden="true"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900 text-sm text-zinc-400"
            aria-hidden="true"
          >
            暂无封面
          </div>
        )}
        <span className="absolute bottom-2 right-2 rounded bg-zinc-950/70 px-1.5 py-0.5 text-[11px] text-zinc-100">
          {formatDuration(durationSeconds)}
        </span>
      </div>

      <div className="space-y-2 p-3 sm:p-4">
        <h3 className="line-clamp-2 text-sm font-medium leading-5 text-zinc-50">{title}</h3>
        <p className="text-xs text-zinc-400">{creatorName}</p>
        <p className="text-xs text-zinc-500">
          {formatViewCount(views)} 次播放{createdAt ? ` · ${formatRelativeTime(createdAt)}` : ""}
        </p>
      </div>
    </Link>
  );
}

export type { VideoCardData };
