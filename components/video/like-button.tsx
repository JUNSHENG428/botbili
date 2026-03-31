"use client";

import { useCallback, useEffect, useState } from "react";

import { useToast } from "@/components/ui/toast";
import { formatViewCount } from "@/lib/format";

interface LikeStatusData {
  liked: boolean;
  like_count: number;
  ai_like_count: number;
  human_like_count: number;
}

interface LikeButtonProps {
  videoId: string;
  isLoggedIn: boolean;
}

export function LikeButton({ videoId, isLoggedIn }: LikeButtonProps) {
  const { toast } = useToast();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [aiLikes, setAiLikes] = useState(0);
  const [humanLikes, setHumanLikes] = useState(0);
  const [loading, setLoading] = useState(false);

  const syncStatus = useCallback((status: LikeStatusData) => {
    setLiked(status.liked);
    setLikeCount(status.like_count);
    setAiLikes(status.ai_like_count);
    setHumanLikes(status.human_like_count);
  }, []);

  useEffect(() => {
    void fetch(`/api/videos/${videoId}/like`)
      .then((r) => r.json() as Promise<LikeStatusData>)
      .then(syncStatus)
      .catch(() => {});
  }, [videoId, syncStatus]);

  async function handleToggle(): Promise<void> {
    if (!isLoggedIn) {
      toast("请先登录后再点赞", { variant: "warning" });
      return;
    }
    if (loading) return;

    // 乐观更新
    const nextLiked = !liked;
    const delta = nextLiked ? 1 : -1;
    setLiked(nextLiked);
    setLikeCount((c) => Math.max(0, c + delta));
    setHumanLikes((c) => Math.max(0, c + delta));
    setLoading(true);

    try {
      const res = await fetch(`/api/videos/${videoId}/like`, {
        method: nextLiked ? "POST" : "DELETE",
      });
      if (!res.ok) throw new Error("like failed");
      const status = (await res.json()) as LikeStatusData;
      syncStatus(status);
    } catch {
      // 回滚
      setLiked(!nextLiked);
      setLikeCount((c) => Math.max(0, c - delta));
      setHumanLikes((c) => Math.max(0, c - delta));
      toast("操作失败，请稍后重试", { variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => void handleToggle()}
        disabled={loading}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition disabled:opacity-60 ${
          liked
            ? "border-red-500/40 bg-red-500/10 text-red-400"
            : "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
        }`}
      >
        {/* Heart SVG */}
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill={liked ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"
          />
        </svg>
        <span>{formatViewCount(likeCount)}</span>
      </button>

      <span className="text-[11px] text-zinc-500">
        AI {formatViewCount(aiLikes)} · 人类 {formatViewCount(humanLikes)}
      </span>
    </div>
  );
}
