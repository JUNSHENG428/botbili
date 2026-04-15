"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { GlassCard } from "@/components/design/glass-card";
import { formatRelativeTime } from "@/lib/format";

interface ForkFamilyAuthor {
  username: string;
  avatar_url: string | null;
}

interface ForkFamilyRecipe {
  id: string;
  slug: string;
  title: string;
  execution_count: number;
  success_rate: number;
  updated_at: string;
  author: ForkFamilyAuthor | null;
}

interface ForkFamilyResponse {
  success: boolean;
  data?: {
    items: ForkFamilyRecipe[];
    total: number;
  };
  error?: {
    code: string;
    message: string;
  };
}

interface ForkFamilyListProps {
  recipeId: string;
}

export function ForkFamilyList({ recipeId }: ForkFamilyListProps) {
  const [items, setItems] = useState<ForkFamilyRecipe[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadForks() {
      try {
        setLoading(true);
        const response = await fetch(`/api/recipes/${recipeId}/forks`);
        const payload = (await response.json()) as ForkFamilyResponse;

        if (!active || !response.ok || !payload.success || !payload.data) {
          return;
        }

        setItems(payload.data.items);
        setTotal(payload.data.total);
      } catch {
        if (active) {
          setItems([]);
          setTotal(0);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadForks();

    return () => {
      active = false;
    };
  }, [recipeId]);

  if (loading) {
    return (
      <GlassCard className="space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-14 animate-pulse rounded-xl bg-zinc-900/70" />
        ))}
      </GlassCard>
    );
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <GlassCard className="space-y-3">
        {items.map((item) => (
          <Link
            key={item.id}
            href={`/recipes/${item.slug || item.id}`}
            className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-800/60 bg-zinc-950/40 px-4 py-3 transition hover:border-cyan-500/30 hover:bg-zinc-900/70"
          >
            <div className="min-w-0 space-y-1">
              <p className="truncate text-sm font-medium text-zinc-100">{item.title}</p>
              <p className="truncate text-xs text-zinc-500">
                by @{item.author?.username ?? "unknown"} · {formatRelativeTime(item.updated_at)}
              </p>
            </div>
            <div className="shrink-0 text-right text-xs text-zinc-400">
              <p>▶ {item.execution_count} 次执行</p>
              <p>✓ {Math.round((item.success_rate ?? 0) * 100)}% 成功率</p>
            </div>
          </Link>
        ))}
      </GlassCard>

      {total > items.length ? (
        <Link
          href={`/recipes?forked_from=${encodeURIComponent(recipeId)}`}
          className="inline-flex text-sm text-cyan-300 transition hover:text-cyan-200"
        >
          查看全部 {total} 个衍生 →
        </Link>
      ) : null}
    </div>
  );
}
