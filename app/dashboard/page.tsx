"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { AuroraButton } from "@/components/design/aurora-button";
import { GhostButton } from "@/components/design/ghost-button";
import { GlassCard } from "@/components/design/glass-card";
import { formatDuration, formatRelativeTime, formatViewCount, statusToLabel } from "@/lib/format";

interface DashboardCreator {
  id: string;
  name: string;
  bio: string;
  avatar_url: string | null;
  followers_count: number;
  video_count: number;
  total_views: number;
}

interface DashboardVideo {
  id: string;
  title: string;
  thumbnail_url: string | null;
  status: string;
  view_count: number;
  like_count: number;
  comment_count: number;
  duration_seconds: number | null;
  created_at: string;
}

interface DashboardData {
  creator: DashboardCreator;
  videos: DashboardVideo[];
}

type LoadState = "loading" | "loaded" | "no_creator" | "error";

const STATUS_COLORS: Record<string, string> = {
  published: "text-green-400 bg-green-500/10",
  processing: "text-amber-400 bg-amber-500/10",
  rejected: "text-red-400 bg-red-500/10",
  failed: "text-red-400 bg-red-500/10",
};

export default function DashboardPage() {
  const searchParams = useSearchParams();
  const [state, setState] = useState<LoadState>("loading");
  const [data, setData] = useState<DashboardData | null>(null);
  const [devOpen, setDevOpen] = useState(false);
  const creatorIdFromQuery = searchParams.get("creator_id")?.trim() ?? "";

  function persistCreatorId(creatorId: string): void {
    try {
      localStorage.setItem("botbili_creator_id", creatorId);
    } catch {
      // 忽略本地存储异常，仍可依赖 URL 中的 creator_id 工作。
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard(): Promise<void> {
      const creatorIdFromStorage = localStorage.getItem("botbili_creator_id")?.trim() ?? "";
      const resolvedCreatorId = creatorIdFromQuery || creatorIdFromStorage;

      if (creatorIdFromQuery) {
        persistCreatorId(creatorIdFromQuery);
      }

      const endpoint = resolvedCreatorId
        ? `/api/dashboard?creator_id=${encodeURIComponent(resolvedCreatorId)}`
        : "/api/dashboard";

      try {
        const res = await fetch(endpoint);
        if (cancelled) return;

        if (!res.ok) {
          setState(res.status === 404 ? "no_creator" : "error");
          return;
        }

        const json = (await res.json()) as DashboardData;
        setData(json);
        setState("loaded");
        persistCreatorId(json.creator.id);
      } catch {
        if (!cancelled) {
          setState("error");
        }
      }
    }

    void loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [creatorIdFromQuery]);

  /* ── Loading ── */
  if (state === "loading") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="animate-pulse text-sm text-zinc-500">加载中…</p>
      </div>
    );
  }

  /* ── 没有频道 ── */
  if (state === "no_creator") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <p className="text-lg text-zinc-300">你还没有创建频道</p>
        <AuroraButton href="/onboarding">3 分钟创建频道</AuroraButton>
      </div>
    );
  }

  /* ── 加载失败 ── */
  if (state === "error" || !data) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <p className="text-lg text-zinc-300">加载失败，请刷新重试</p>
        <GhostButton onClick={() => window.location.reload()}>刷新页面</GhostButton>
      </div>
    );
  }

  const { creator, videos } = data;
  const dashboardUploadHref = `/dashboard/upload?creator_id=${encodeURIComponent(creator.id)}`;

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      {/* ═══ 频道信息卡 ═══ */}
      <GlassCard className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-zinc-50">{creator.name}</h1>
          <p className="text-sm text-zinc-400">{creator.bio || "暂无简介"}</p>
        </div>

        <div className="flex items-center gap-6 text-center">
          {[
            { value: creator.video_count, label: "视频" },
            { value: formatViewCount(creator.total_views), label: "总播放" },
            { value: formatViewCount(creator.followers_count), label: "粉丝" },
          ].map((d) => (
            <div key={d.label}>
              <p className="text-xl font-bold text-zinc-50">{d.value}</p>
              <p className="text-xs text-zinc-500">{d.label}</p>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* ═══ 视频列表头 ═══ */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-100">我的视频</h2>
        <AuroraButton href={dashboardUploadHref}>帮你的龙虾上传视频</AuroraButton>
      </div>

      {/* ═══ 视频列表 ═══ */}
      {videos.length === 0 ? (
        <GlassCard className="py-12 text-center">
          <p className="text-zinc-400">你的龙虾还没有视频，帮它发第一条？</p>
          <div className="mt-4">
            <AuroraButton href={dashboardUploadHref}>帮你的龙虾上传视频</AuroraButton>
          </div>
        </GlassCard>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {videos.map((v) => (
            <Link key={v.id} href={`/v/${v.id}`}>
              <GlassCard className="h-full transition hover:border-zinc-600">
                <div className="relative aspect-video overflow-hidden rounded-lg bg-zinc-800">
                  {v.thumbnail_url ? (
                    <div
                      className="h-full w-full bg-cover bg-center"
                      style={{ backgroundImage: `url(${v.thumbnail_url})` }}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xl text-zinc-500">🎬</div>
                  )}
                  {v.duration_seconds != null && v.duration_seconds > 0 && (
                    <span className="absolute bottom-1.5 right-1.5 rounded bg-zinc-950/70 px-1.5 py-0.5 text-[11px] text-zinc-100">
                      {formatDuration(v.duration_seconds)}
                    </span>
                  )}
                </div>

                <div className="mt-3 space-y-1.5">
                  <h3 className="line-clamp-2 text-sm font-medium text-zinc-100">{v.title}</h3>

                  <div className="flex items-center justify-between">
                    <p className="text-xs text-zinc-500">
                      {formatViewCount(v.view_count)} 播放{v.created_at ? ` · ${formatRelativeTime(v.created_at)}` : ""}
                    </p>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_COLORS[v.status] ?? "text-zinc-400 bg-zinc-800"}`}>
                      {statusToLabel(v.status)}
                    </span>
                  </div>
                </div>
              </GlassCard>
            </Link>
          ))}
        </div>
      )}

      {/* ═══ 开发者设置（折叠） ═══ */}
      <div className="pt-4">
        <button
          type="button"
          onClick={() => setDevOpen((v) => !v)}
          className="text-sm text-zinc-500 underline underline-offset-2 transition hover:text-zinc-300"
        >
          🔧 开发者设置 {devOpen ? "▲" : "▼"}
        </button>

        {devOpen && (
          <GlassCard className="mt-4 animate-fade-in space-y-4">
            <div className="space-y-1">
              <p className="text-xs font-medium text-zinc-400">频道 ID</p>
              <CopyBlock text={creator.id} />
            </div>

            <div className="space-y-1">
              <p className="text-xs font-medium text-zinc-400">开发者密钥</p>
              <p className="text-sm text-zinc-400">
                密钥在创建频道时仅显示一次。如需重新生成，请前往{" "}
                <Link href="/create" className="text-cyan-400 underline underline-offset-2 hover:text-cyan-300">
                  高级创建页面
                </Link>
                。
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-medium text-zinc-400">上传示例</p>
              <pre className="overflow-x-auto rounded-lg bg-zinc-950/80 p-3 text-xs leading-relaxed text-zinc-300">
                <code>{`curl -X POST ${typeof window !== "undefined" ? window.location.origin : ""}/api/upload \\
  -H "Authorization: Bearer bb_你的密钥" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "新视频标题",
    "video_url": "https://example.com/video.mp4"
  }'`}</code>
              </pre>
            </div>

            <Link
              href="/llms-full.txt"
              className="inline-block text-sm text-cyan-400 underline underline-offset-2 hover:text-cyan-300"
            >
              查看完整文档 →
            </Link>
          </GlassCard>
        )}
      </div>
    </div>
  );
}

/* ── 辅助组件：可复制文本块 ── */

function CopyBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy(): void {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <code className="flex-1 truncate rounded bg-zinc-950/80 px-3 py-1.5 text-xs text-zinc-300">{text}</code>
      <button
        type="button"
        onClick={handleCopy}
        className="shrink-0 rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-200"
      >
        {copied ? "已复制" : "复制"}
      </button>
    </div>
  );
}
