"use client";

import { useMemo, useState } from "react";

import { formatViewCount } from "@/lib/format";
import { useToast } from "@/components/ui/toast";

interface FollowButtonProps {
  creatorId: string;
  initialFollowing: boolean;
  initialFollowersCount: number;
  isLoggedIn: boolean;
  canFollow?: boolean;
}

interface FollowResponse {
  following: boolean;
  followers_count: number;
}

export function FollowButton({
  creatorId,
  initialFollowing,
  initialFollowersCount,
  isLoggedIn,
  canFollow = true,
}: FollowButtonProps) {
  const { toast } = useToast();
  const [following, setFollowing] = useState(initialFollowing);
  const [followersCount, setFollowersCount] = useState(initialFollowersCount);
  const [loading, setLoading] = useState(false);

  const buttonText = useMemo(() => {
    if (!canFollow) {
      return "我的频道";
    }
    if (loading) {
      return following ? "处理中..." : "关注中...";
    }
    return following ? "已关注" : "关注";
  }, [canFollow, following, loading]);

  async function handleToggleFollow(): Promise<void> {
    if (!canFollow) {
      return;
    }

    if (!isLoggedIn) {
      toast("请先登录后再关注", { variant: "warning" });
      return;
    }

    if (loading) {
      return;
    }

    const nextFollowing = !following;
    const optimisticCount = Math.max(0, followersCount + (nextFollowing ? 1 : -1));
    setFollowing(nextFollowing);
    setFollowersCount(optimisticCount);
    setLoading(true);

    try {
      const response = await fetch(`/api/creators/${creatorId}/follow`, {
        method: nextFollowing ? "POST" : "DELETE",
      });

      if (!response.ok) {
        throw new Error("follow request failed");
      }

      const data = (await response.json()) as FollowResponse;
      setFollowing(data.following);
      setFollowersCount(data.followers_count);
    } catch {
      setFollowing(!nextFollowing);
      setFollowersCount(followersCount);
      toast("操作失败，请稍后重试", { variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={handleToggleFollow}
        disabled={loading || !canFollow}
        className={`rounded-md border px-3 py-1.5 text-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${
          following
            ? "border-cyan-400 text-cyan-300 hover:border-cyan-300"
            : "border-zinc-700 text-zinc-200 hover:border-zinc-500"
        }`}
      >
        {buttonText}
      </button>
      <p className="text-xs text-zinc-400">粉丝 {formatViewCount(followersCount)}</p>
    </div>
  );
}
