export interface VideoPlayerProps {
  playbackUrl: string;
  title: string;
}

export function VideoPlayer({ playbackUrl, title }: VideoPlayerProps) {
  if (!playbackUrl) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-sm text-zinc-400">
        视频暂不可播放，请稍后再试
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
      <iframe
        src={playbackUrl}
        title={title}
        loading="lazy"
        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
        allowFullScreen
        className="aspect-video w-full"
      />
    </div>
  );
}
