"use client";

import { useEffect, useRef, useState } from "react";

import { GlassCard } from "@/components/design/glass-card";

interface VisitorEntry {
  id: string;
  visitor_user_id: string | null;
  visitor_creator_id: string | null;
  visitor_name: string;
  visited_at: string;
}

interface LobsterVisitorsProps {
  creatorId: string;
  initialVisitorCount?: number;
}

function getInitial(name: string): string {
  return name?.[0]?.toUpperCase() ?? "?";
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "刚刚";
  if (mins < 60) return `${mins}分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时前`;
  return `${Math.floor(hours / 24)}天前`;
}

export function LobsterVisitors({ creatorId, initialVisitorCount = 0 }: LobsterVisitorsProps) {
  const [visitors, setVisitors] = useState<VisitorEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(initialVisitorCount);
  const visitRecorded = useRef(false);

  useEffect(() => {
    void fetchVisitors();
    // Record the current user's visit once per mount
    if (!visitRecorded.current) {
      visitRecorded.current = true;
      void recordVisit();
    }
  }, [creatorId]);

  async function fetchVisitors() {
    try {
      const res = await fetch(`/api/creators/${creatorId}/visitors`);
      if (!res.ok) return;
      const json = (await res.json()) as { data: VisitorEntry[] };
      setVisitors(json.data);
      if (json.data.length > totalCount) {
        setTotalCount(json.data.length);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }

  async function recordVisit() {
    try {
      const res = await fetch(`/api/creators/${creatorId}/visitors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const json = (await res.json()) as { recorded?: boolean };
        if (json.recorded) {
          // Increment local count optimistically
          setTotalCount((prev) => prev + 1);
          // Re-fetch to show the new visitor
          await fetchVisitors();
        }
      }
    } catch {
      // Silently fail — visit recording is best-effort
    }
  }

  const displayed = visitors.slice(0, 8);

  return (
    <GlassCard className="p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-300">👀 最近访客</h3>
        {totalCount > 0 && (
          <span className="text-xs text-zinc-500">共 {totalCount} 次访问</span>
        )}
      </div>

      {loading ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 w-20 animate-pulse rounded-lg bg-zinc-800/60" />
          ))}
        </div>
      ) : displayed.length === 0 ? (
        <p className="mt-2 text-xs text-zinc-500">还没有访客记录</p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {displayed.map((visitor) => (
            <div
              key={visitor.id}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-700/60 bg-zinc-800/40 px-2.5 py-1.5"
              title={relativeTime(visitor.visited_at)}
            >
              {/* Avatar initial */}
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-[10px] font-bold text-zinc-300">
                {getInitial(visitor.visitor_name)}
              </div>
              <span className="max-w-[72px] truncate text-xs text-zinc-300">
                {visitor.visitor_name}
              </span>
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  );
}
