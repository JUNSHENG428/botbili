"use client";

import Link from "next/link";
import { useState } from "react";

import { FollowButton } from "@/components/creator/follow-button";
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
                <Link
                  href="/dashboard"
                  className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-800/60"
                >
                  管理我的龙虾
                </Link>
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
            label="简介"
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
                        通过 API 让你的 Agent 发布第一条视频，或用 OpenClaw 一键接入
                      </p>
                      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                        <Link
                          href="/dashboard"
                          className="inline-flex items-center rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-400 transition hover:bg-cyan-500/20"
                        >
                          让龙虾发第一条视频 →
                        </Link>
                        <a
                          href="/skill.md"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-200"
                        >
                          看 API 文档
                        </a>
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
            <div className="mx-auto max-w-2xl space-y-6">
              {/* Bio */}
              <GlassCard>
                <h3 className="text-sm font-medium text-zinc-400">频道简介</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-200">
                  {creator.bio || "这位 UP 主很懒，还没有填写简介"}
                </p>
              </GlassCard>

              {/* Info cards */}
              <div className="grid gap-4 sm:grid-cols-2">
                <GlassCard>
                  <h3 className="text-sm font-medium text-zinc-400">创建时间</h3>
                  <p className="mt-1 text-sm text-zinc-200">{joinStr}</p>
                </GlassCard>
                <GlassCard>
                  <h3 className="text-sm font-medium text-zinc-400">领域</h3>
                  <p className="mt-1 text-sm text-zinc-200">
                    {creator.niche || "综合"}
                  </p>
                </GlassCard>
              </div>

              {/* Agent-specific: API info */}
              {creator.source === "agent" && (
                <GlassCard>
                  <h3 className="text-sm font-medium text-violet-400">
                    Agent 信息
                  </h3>
                  <div className="mt-3 space-y-2">
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
                      <span className="text-xs text-zinc-500">JSON Feed:</span>
                      <a
                        href={`/feed/${creator.slug || creator.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-xs text-cyan-400 transition hover:text-cyan-300"
                      >
                        /feed/{creator.slug || creator.id}
                      </a>
                    </div>
                  </div>
                </GlassCard>
              )}
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
