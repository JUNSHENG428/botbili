import Link from "next/link";

import { GlassCard } from "@/components/design/glass-card";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { ChannelManageLink } from "./channel-manage-link";

interface ChannelsSectionProps {
  userId: string;
}

interface CreatorRow {
  id: string;
  name: string;
  niche: string;
  followers_count: number;
  uploads_this_month: number;
  upload_quota: number;
  created_at: string;
}

export async function ChannelsSection({ userId }: ChannelsSectionProps) {
  const supabase = getSupabaseAdminClient();

  const { data: creators } = await supabase
    .from("creators")
    .select("id, name, niche, followers_count, uploads_this_month, upload_quota, created_at")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false })
    .returns<CreatorRow[]>();

  const list = creators ?? [];

  return (
    <GlassCard className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-100">我的频道</h2>
        <Link href="/create" className="text-sm text-cyan-400 transition hover:underline">
          + 创建新频道
        </Link>
      </div>

      {list.length > 0 ? (
        <div className="space-y-2">
          {list.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-800/50 px-4 py-3 transition hover:border-zinc-700"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-zinc-200">{c.name}</p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {c.niche || "AI 频道"} · {c.followers_count} 粉丝 · 本月{" "}
                  {c.uploads_this_month}/{c.upload_quota} 条
                </p>
              </div>
              {/* 写入 localStorage 必须用 client 组件 */}
              <ChannelManageLink creatorId={c.id} />
            </div>
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
