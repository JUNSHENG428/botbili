"use client";

import Link from "next/link";
import { useState } from "react";

import { FollowButton } from "@/components/creator/follow-button";
import { LobsterGifts } from "@/components/creator/lobster-gifts";
import { LobsterGuestbook } from "@/components/creator/lobster-guestbook";
import { LobsterFriends } from "@/components/creator/lobster-friends";
import { LobsterVisitors } from "@/components/creator/lobster-visitors";
import { GlassCard } from "@/components/design/glass-card";
import { VideoGrid } from "@/components/video/video-grid";
import { formatViewCount } from "@/lib/format";
import type { VideoCardData } from "@/components/video/types";

/* ── Types ── */

interface ChannelCreator {
  id: string;
  name: string;
  slug: string;
  bio: string;
  niche: string;
  avatarUrl: string | null;
  followersCount: number;
  videoCount: number;
  totalViews: number;
  totalLikes: number;
  createdAt: string;
  source?: "agent" | "human";
  giftCount?: number;
  visitorCount?: number;
  friendCount?: number;
}

interface ChannelProfileProps {
  creator: ChannelCreator;
  videos: VideoCardData[];
  isLoggedIn: boolean;
  isOwner: boolean;
  initialFollowing: boolean;
}

type Tab = "videos" | "about";

/* ── Component ── */

export function ChannelProfile({
  creator,
  videos,
  isLoggedIn,
  isOwner,
  initialFollowing,
}: ChannelProfileProps) {
  const [activeTab, setActiveTab] = useState<Tab>("videos");

  const joinDate = new Date(creator.createdAt);
  const joinStr = `${joinDate.getFullYear()} 年 ${joinDate.getMonth() + 1} 月`;
  const dashboardHref = `/dashboard?creator_id=${encodeURIComponent(creator.id)}`;
  const recipeStudioHref = `/recipes/new?creator_id=${encodeURIComponent(creator.id)}`;

  function rememberCreatorContext(): void {
    try {
      localStorage.setItem("botbili_creator_id", creator.id);
    } catch {
      // 忽略本地存储异常，dashboard 会继续读取 URL 查询参数。
    }
  }

  return (
    <div className="-mx-4 -mt-6">
      {/* ═══ Banner ═══ */}
      <div className="relative h-36 overflow-hidden sm:h-48">
        {/* Gradient banner */}
        <div
          className="absolute inset-0"
          style={{
            background:
              creator.source === "agent"
                ? "linear-gradient(135deg, rgba(139,92,246,0.3) 0%, rgba(6,182,212,0.2) 50%, rgba(139,92,246,0.15) 100%)"
                : "linear-gradient(135deg, rgba(6,182,212,0.3) 0%, rgba(59,130,246,0.2) 50%, rgba(6,182,212,0.15) 100%)",
          }}
        />
        {/* Decorative pattern */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "24px 24px",
          }}
        />
      </div>

      {/* ═══ Profile header ═══ */}
      <div className="relative mx-auto max-w-6xl px-4">
        {/* Avatar — overlaps banner */}
        <div className="-mt-12 flex items-end gap-4 sm:-mt-16 sm:gap-6">
          <div className="relative shrink-0">
            {creator.avatarUrl ? (
              <div
                className="h-24 w-24 rounded-full border-4 border-zinc-950 bg-zinc-800 bg-cover bg-center sm:h-32 sm:w-32"
                style={{ backgroundImage: `url(${creator.avatarUrl})` }}
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-zinc-950 bg-zinc-800 text-4xl sm:h-32 sm:w-32 sm:text-5xl">
                {creator.source === "agent" ? "🤖" : "👤"}
              </div>
            )}
            {/* Agent badge */}
            {creator.source === "agent" && (
              <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-zinc-950 bg-violet-500 text-xs">
                🤖
              </span>
            )}
          </div>

          {/* Name + actions */}
          <div className="flex min-w-0 flex-1 items-start justify-between gap-3 pb-1">
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold text-zinc-50 sm:text-2xl">
                {creator.name}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {creator.niche && (
                  <span className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs text-zinc-400">
                    {creator.niche}
                  </span>
                )}
                {creator.source === "agent" && (
                  <span className="rounded-full bg-violet-500/10 px-2.5 py-0.5 text-xs text-violet-400">
                    AI Agent
                  </span>
                )}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {isOwner && (
                <>
                  <Link
                    href={dashboardHref}
                    onClick={rememberCreatorContext}
                    className="rounded-lg bg-cyan-600 px-3.5 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-cyan-500"
                  >
                    管理频道
                  </Link>
                  <Link
                    href={recipeStudioHref}
                    onClick={rememberCreatorContext}
                    className="rounded-lg bg-zinc-700 px-3.5 py-1.5 text-sm font-medium text-zinc-100 shadow-sm transition hover:bg-zinc-600"
                  >
                    创建 Recipe
                  </Link>
                </>
              )}
              <FollowButton
                creatorId={creator.id}
                initialFollowing={initialFollowing}
                initialFollowersCount={creator.followersCount}
                isLoggedIn={isLoggedIn}
                canFollow={!isOwner}
              />
            </div>
          </div>
        </div>

        {/* ═══ Stats row ═══ */}
        <div className="mt-4 flex items-center gap-6 border-b border-zinc-800 pb-4 text-sm">
          {[
            { value: creator.videoCount, label: "视频" },
            { value: formatViewCount(creator.followersCount), label: "粉丝" },
            { value: formatViewCount(creator.totalViews), label: "播放量" },
            { value: formatViewCount(creator.totalLikes), label: "获赞" },
          ].map((stat) => (
            <div key={stat.label} className="flex items-baseline gap-1">
              <span className="font-semibold text-zinc-100">{stat.value}</span>
              <span className="text-zinc-500">{stat.label}</span>
            </div>
          ))}
        </div>

        {/* ═══ Tabs ═══ */}
        <div className="flex gap-1 border-b border-zinc-800">
          <TabButton
            active={activeTab === "videos"}
            onClick={() => setActiveTab("videos")}
            label={`视频 ${creator.videoCount}`}
          />
          <TabButton
            active={activeTab === "about"}
            onClick={() => setActiveTab("about")}
            label="龙虾档案"
          />
        </div>

        {/* ═══ Tab content ═══ */}
        <div className="py-6">
          {activeTab === "videos" && (
            <div>
              {videos.length > 0 ? (
                <VideoGrid items={videos} />
              ) : (
                <div className="py-16 text-center">
                  {isOwner ? (
                    <>
                      <p className="text-5xl">🦞</p>
                      <p className="mt-4 text-lg text-zinc-300">
                        你的龙虾还没开工
                      </p>
                      <p className="mt-2 text-sm text-zinc-500">
                        复制下方模板发给 OpenClaw，它会自动执行 Recipe 并把结果同步回来
                      </p>
                      <div className="mx-auto mt-6 max-w-md">
                        <PromptCopyCard
                          text={`帮我在 BotBili 频道「${creator.name}」上发一条关于今天 AI 行业热点的视频`}
                        />
                      </div>
                      <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                        <Link
                          href={dashboardHref}
                          onClick={rememberCreatorContext}
                          className="text-sm text-cyan-400 transition hover:underline"
                        >
                          去控制台查看更多模板 →
                        </Link>
                      </div>
                    </>
                  ) : (
                    <p className="text-lg text-zinc-500">
                      该 UP 主的龙虾还没开工，敬请期待
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === "about" && (
            <div className="mx-auto max-w-2xl space-y-4">
              {/* ── 频道简介 ── */}
              <GlassCard className="p-4">
                <h3 className="mb-2 text-sm font-semibold text-zinc-300">频道简介</h3>
                <p className="text-sm leading-relaxed text-zinc-200">
                  {creator.bio || "这位 UP 主很懒，还没有填写简介"}
                </p>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
                  <span>创建于 {joinStr}</span>
                  {creator.niche && <span>领域：{creator.niche}</span>}
                </div>

                {/* Agent-specific info */}
                {creator.source === "agent" && (
                  <div className="mt-3 space-y-1.5 border-t border-zinc-800 pt-3">
                    <p className="text-xs font-medium text-violet-400">Agent 信息</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-500">Agent Card:</span>
                      <a
                        href={`/api/creators/${creator.slug || creator.id}/agent.json`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-xs text-violet-400 transition hover:text-violet-300"
                      >
                        /api/creators/{creator.slug || creator.id}/agent.json
                      </a>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-500">Recipe Feed:</span>
                      <a
                        href={`/feed/${creator.slug || creator.id}.json`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-xs text-cyan-400 transition hover:text-cyan-300"
                      >
                        /feed/{creator.slug || creator.id}.json
                      </a>
                    </div>
                  </div>
                )}
              </GlassCard>

              {/* ── 礼物 ── */}
              <LobsterGifts
                creatorId={creator.id}
                initialGiftCount={creator.giftCount ?? 0}
              />

              {/* ── 留言板 ── */}
              <LobsterGuestbook creatorId={creator.id} />

              {/* ── 龙虾好友 ── */}
              <LobsterFriends
                creatorId={creator.id}
                initialFriendCount={creator.friendCount ?? 0}
              />

              {/* ── 最近访客 ── */}
              <LobsterVisitors
                creatorId={creator.id}
                initialVisitorCount={creator.visitorCount ?? 0}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative px-4 py-3 text-sm font-medium transition ${
        active
          ? "text-cyan-400"
          : "text-zinc-500 hover:text-zinc-300"
      }`}
    >
      {label}
      {active && (
        <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-cyan-400" />
      )}
    </button>
  );
}

function PromptCopyCard({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy(): void {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3">
      <p className="min-w-0 flex-1 text-sm text-zinc-200">{text}</p>
      <button
        type="button"
        onClick={handleCopy}
        className="shrink-0 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-400 transition hover:bg-cyan-500/20"
      >
        {copied ? "已复制 ✓" : "复制"}
      </button>
    </div>
  );
}
