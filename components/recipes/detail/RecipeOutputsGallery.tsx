"use client";

import { useEffect, useState } from "react";

import { GlassCard } from "@/components/design/glass-card";
import { RecipeExecutionOutput } from "@/components/recipes/detail/RecipeExecutionOutput";
import type { RecipeOutputExample } from "@/types/recipe";

interface RecipeOutputsGalleryProps {
  recipeId: string;
}

interface OutputsResponse {
  success: boolean;
  data?: {
    items: RecipeOutputExample[];
    total: number;
  };
  error?: {
    code: string;
    message: string;
  };
}

export function RecipeOutputsGallery({ recipeId }: RecipeOutputsGalleryProps) {
  const [items, setItems] = useState<RecipeOutputExample[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadOutputs() {
      try {
        setLoading(true);
        const response = await fetch(`/api/recipes/${recipeId}/outputs?limit=6`);
        const payload = (await response.json()) as OutputsResponse;

        if (!active || !response.ok || !payload.success || !payload.data) {
          setItems([]);
          setTotal(0);
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

    void loadOutputs();

    return () => {
      active = false;
    };
  }, [recipeId]);

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-zinc-100">执行示例输出</h2>
        <p className="text-sm text-zinc-500">
          只展示已经公开发布到外部平台的执行结果。这里的数据决定新手会不会相信这条 Recipe 真的能跑通。
          {total > 0 ? <span className="ml-2 text-zinc-400">已收录 {total} 条公开视频</span> : null}
        </p>
      </div>

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-72 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900/60" />
          ))}
        </div>
      ) : items.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {items.map((item) => (
            <RecipeExecutionOutput
              key={item.id}
              output={{
                platform: item.platform,
                video_url: item.video_url,
                title: item.title,
                thumbnail_url: item.thumbnail_url,
                gif_url: item.gif_url,
                published_at: item.published_at ?? item.completed_at ?? item.created_at,
              }}
              status="completed"
            />
          ))}
        </div>
      ) : (
        <GlassCard className="space-y-3 border-dashed border-zinc-800/90 bg-zinc-950/60 py-8 text-center">
          <p className="text-lg font-medium text-zinc-100">还没人公开分享这条 Recipe 的执行结果</p>
          <p className="mx-auto max-w-2xl text-sm leading-7 text-zinc-500">
            你可以成为第一个。跑通后把公开视频链接回填到 BotBili，这条 Recipe 的可信度和排序都会立刻上升。
          </p>
        </GlassCard>
      )}
    </section>
  );
}
