import { GlassCard } from "@/components/design/glass-card";
import { formatRelativeTime, formatViewCount, getPlatformColor, getPlatformLabel } from "@/lib/format";
import type { RecipeExecutionOutput as RecipeExecutionOutputData } from "@/types/recipe";

interface RecipeExecutionOutputProps {
  output: RecipeExecutionOutputData | null;
  status: "pending" | "running" | "completed" | "failed";
}

function OutputSkeleton({ status }: { status: RecipeExecutionOutputProps["status"] }) {
  const message =
    status === "failed"
      ? "执行失败，暂无可展示的发布结果"
      : "等待 Agent 回填结果...";

  return (
    <GlassCard className="space-y-4 border-dashed border-zinc-800/90 bg-zinc-950/55">
      <div className="flex items-center justify-between gap-3">
        <div className="h-5 w-24 animate-pulse rounded-full bg-zinc-800" />
        <div className="h-4 w-28 animate-pulse rounded bg-zinc-900" />
      </div>
      <div className="aspect-video animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900/70" />
      <p className="text-sm text-zinc-500">{message}</p>
    </GlassCard>
  );
}

export function RecipeExecutionOutput({
  output,
  status,
}: RecipeExecutionOutputProps) {
  if (!output) {
    return <OutputSkeleton status={status} />;
  }

  const platformLabel = getPlatformLabel(output.platform);
  const publishedAt = output.published_at ? formatRelativeTime(output.published_at) : "发布时间待同步";
  const previewImage = output.thumbnail_url ?? output.gif_url;

  return (
    <GlassCard className="group space-y-4 overflow-hidden border-zinc-800/90 bg-zinc-950/70 p-4 transition hover:border-cyan-500/30">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${getPlatformColor(output.platform)}`}>
              {platformLabel}
            </span>
            {output.platform_video_id ? (
              <span className="font-mono text-xs text-zinc-500">{output.platform_video_id}</span>
            ) : null}
          </div>
          <h3 className="line-clamp-2 text-base font-semibold leading-6 text-zinc-100">{output.title}</h3>
        </div>
      </div>

      <a
        href={output.video_url}
        target="_blank"
        rel="noopener noreferrer"
        className="block overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950"
      >
        <div className="relative aspect-video">
          {previewImage ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewImage}
                alt={output.title}
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
              />
              {output.gif_url && output.thumbnail_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={output.gif_url}
                  alt={`${output.title} GIF 预览`}
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover opacity-0 transition duration-300 group-hover:opacity-100"
                />
              ) : null}
            </>
          ) : (
            <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_30%_20%,rgba(34,211,238,0.16),transparent_36%),#09090b] text-sm text-zinc-500">
              暂无封面
            </div>
          )}
        </div>
      </a>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <p className="text-zinc-500">
          发布于 <span className="text-zinc-300">{publishedAt}</span>
          {typeof output.view_count === "number" ? (
            <>
              <span className="mx-2 text-zinc-700">·</span>
              <span className="text-zinc-300">{formatViewCount(output.view_count)} 播放</span>
            </>
          ) : null}
        </p>
        <a
          href={output.video_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1.5 text-xs font-medium text-cyan-200 transition hover:border-cyan-300/40 hover:text-cyan-100"
        >
          → 在 {platformLabel} 观看
        </a>
      </div>
    </GlassCard>
  );
}
