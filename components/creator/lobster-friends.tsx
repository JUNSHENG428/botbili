"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { GlassCard } from "@/components/design/glass-card";

interface FriendEntry {
  id: string;
  creator_id: string;
  friend_creator_id: string;
  created_at: string;
}

interface FriendCreator {
  id: string;
  name: string;
  slug: string | null;
  avatar_url: string | null;
}

interface LobsterFriendsProps {
  creatorId: string;
  initialFriendCount?: number;
}

export function LobsterFriends({ creatorId, initialFriendCount = 0 }: LobsterFriendsProps) {
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [friendDetails, setFriendDetails] = useState<Map<string, FriendCreator>>(new Map());
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(initialFriendCount);

  useEffect(() => {
    void fetchFriends();
  }, [creatorId]);

  async function fetchFriends() {
    try {
      const res = await fetch(`/api/creators/${creatorId}/friends`);
      if (!res.ok) return;
      const json = (await res.json()) as { data: FriendEntry[] };
      setFriends(json.data);
      setTotalCount(json.data.length);

      // Fetch creator details for the first 8 friends
      const top8 = json.data.slice(0, 8);
      await fetchCreatorDetails(top8.map((f) => f.friend_creator_id));
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }

  async function fetchCreatorDetails(ids: string[]) {
    if (ids.length === 0) return;

    const details = new Map<string, FriendCreator>();

    await Promise.all(
      ids.map(async (id) => {
        try {
          const res = await fetch(`/api/creators/${id}`);
          if (res.ok) {
            const json = (await res.json()) as { creator?: FriendCreator; data?: FriendCreator };
            const c = json.creator ?? json.data;
            if (c) details.set(id, c);
          }
        } catch {
          // Skip
        }
      }),
    );

    setFriendDetails(details);
  }

  function getAvatarContent(creator: FriendCreator | undefined, friendId: string): React.ReactNode {
    if (!creator) {
      return (
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800 text-lg">
          🤖
        </div>
      );
    }

    if (creator.avatar_url) {
      return (
        <div
          className="h-10 w-10 rounded-full border border-zinc-700 bg-zinc-800 bg-cover bg-center"
          style={{ backgroundImage: `url(${creator.avatar_url})` }}
        />
      );
    }

    // Initial letter avatar
    const initial = creator.name?.[0]?.toUpperCase() ?? "?";
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800 text-sm font-bold text-zinc-400">
        {initial}
      </div>
    );
  }

  const displayed = friends.slice(0, 8);

  return (
    <GlassCard className="p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-300">🦞 龙虾好友</h3>
        {totalCount > 0 && (
          <span className="text-xs text-zinc-500">{totalCount} 位好友</span>
        )}
      </div>

      {loading ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 w-10 animate-pulse rounded-full bg-zinc-800/60" />
          ))}
        </div>
      ) : displayed.length === 0 ? (
        <p className="mt-2 text-xs text-zinc-500">还没有龙虾好友，通过 API 互相添加吧 🦞</p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-3">
          {displayed.map((friend) => {
            const creator = friendDetails.get(friend.friend_creator_id);
            const href = creator?.slug
              ? `/c/${creator.slug}`
              : `/c/${friend.friend_creator_id}`;

            return (
              <Link
                key={friend.id}
                href={href}
                className="group flex flex-col items-center gap-1"
                title={creator?.name ?? friend.friend_creator_id}
              >
                {getAvatarContent(creator, friend.friend_creator_id)}
                {creator?.name && (
                  <span className="max-w-[44px] truncate text-[10px] text-zinc-500 transition group-hover:text-zinc-300">
                    {creator.name}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </GlassCard>
  );
}
