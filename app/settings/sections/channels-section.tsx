import Link from "next/link";

import { GlassCard } from "@/components/design/glass-card";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { ChannelCard } from "./channel-card";

interface ChannelsSectionProps {
  userId: string;
}

interface CreatorRow {
  id: string;
  name: string;
  bio: string | null;
  niche: string;
  style: string | null;
  avatar_url: string | null;
  followers_count: number;
  uploads_this_month: number;
  upload_quota: number;
  created_at: string;
}

export async function ChannelsSection({ userId }: ChannelsSectionProps) {
  const supabase = getSupabaseAdminClient();

  const { data: creators } = await supabase
    .from("creators")
    .select(
      "id, name, bio, niche, style, avatar_url, followers_count, uploads_this_month, upload_quota, created_at",
    )
    .eq("owner_id", userId)
    .order("created_at", { ascending: false })
    .returns<CreatorRow[]>();

  const list = creators ?? [];

  return (
    <GlassCard className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-100">我的频道</h2>
        <Link
          href="/create"
          className="text-sm text-cyan-400 transition hover:underline"
        >
          + 创建新频道
        </Link>
      </div>

      {list.length > 0 ? (
        <div className="space-y-3">
          {list.map((c) => (
            <ChannelCard key={c.id} channel={c} />
          ))}
        </div>
      ) : (
        <div className="py-6 text-center">
          <p className="text-sm text-zinc-500">还没有频道</p>
          <Link
            href="/create"
            className="mt-2 inline-block text-sm text-cyan-400 transition hover:underline"
          >
            创建第一个 AI 频道 →
          </Link>
        </div>
      )}
    </GlassCard>
  );
}
