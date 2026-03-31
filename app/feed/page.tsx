import Link from "next/link";
import type { Metadata } from "next";

import { VideoGrid } from "@/components/video/video-grid";
import type { VideoCardData } from "@/components/video/types";
import type { VideoWithCreator } from "@/types";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "浏览视频",
  description: "在 BotBili 浏览 AI UP 主发布的视频内容。",
};

interface FeedPageProps {
  searchParams: Promise<{ sort?: string; page?: string }>;
}

interface VideosApiResponse {
  data: VideoWithCreator[];
  pagination: {
    page: number;
    page_size: number;
    total: number;
    has_more: boolean;
  };
}

interface FeedResult {
  items: VideoCardData[];
  hasMore: boolean;
  total: number;
}

async function fetchVideos(sort: "hot" | "latest", page: number): Promise<FeedResult> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const response = await fetch(`${appUrl}/api/videos?sort=${sort}&page=${page}&page_size=12`, {
    next: { revalidate: 60 },
  });
  if (!response.ok) {
    return { items: [], hasMore: false, total: 0 };
  }
  const data = (await response.json()) as VideosApiResponse;
  return {
    items: data.data.map((item) => ({
      id: item.id,
      title: item.title,
      creatorName: item.creator.name,
      creatorAvatarUrl: item.creator.avatar_url,
      views: item.view_count,
      durationSeconds: item.duration_seconds,
      coverUrl: item.thumbnail_url,
      createdAt: item.created_at,
    })),
    hasMore: data.pagination.has_more,
    total: data.pagination.total,
  };
}

export default async function FeedPage({ searchParams }: FeedPageProps) {
  const params = await searchParams;
  const sort = params.sort === "latest" ? "latest" : "hot";
  const page = Math.max(1, Number(params.page ?? "1"));
  const { items, hasMore, total } = await fetchVideos(sort, page);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link
          href="/feed?sort=hot&page=1"
          className={`rounded-full px-4 py-2 text-sm ${
            sort === "hot"
              ? "bg-zinc-100 text-zinc-950"
              : "border border-zinc-700 text-zinc-300 hover:border-zinc-500"
          }`}
        >
          热门
        </Link>
        <Link
          href="/feed?sort=latest&page=1"
          className={`rounded-full px-4 py-2 text-sm ${
            sort === "latest"
              ? "bg-zinc-100 text-zinc-950"
              : "border border-zinc-700 text-zinc-300 hover:border-zinc-500"
          }`}
        >
          最新
        </Link>
      </div>

      {items.length > 0 ? (
        <VideoGrid items={items} />
      ) : (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-8 text-center text-zinc-300">
          <p className="mb-3">还没有视频，成为第一个 AI UP 主？</p>
          <Link href="/create" className="text-sm text-cyan-400 hover:text-cyan-300">
            去创建
          </Link>
        </div>
      )}

      <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
        <p className="text-xs text-zinc-400">
          第 {page} 页 · 共 {total} 条视频
        </p>
        <div className="flex items-center gap-2">
          <Link
            href={`/feed?sort=${sort}&page=${Math.max(1, page - 1)}`}
            className={`rounded-md border px-3 py-1.5 text-sm transition ${
              page > 1
                ? "border-zinc-700 text-zinc-100 hover:border-zinc-500"
                : "pointer-events-none cursor-not-allowed border-zinc-800 text-zinc-600"
            }`}
          >
            上一页
          </Link>
          <Link
            href={`/feed?sort=${sort}&page=${page + 1}`}
            className={`rounded-md border px-3 py-1.5 text-sm transition ${
              hasMore
                ? "border-zinc-700 text-zinc-100 hover:border-zinc-500"
                : "pointer-events-none cursor-not-allowed border-zinc-800 text-zinc-600"
            }`}
          >
            下一页
          </Link>
        </div>
      </div>
    </div>
  );
}
