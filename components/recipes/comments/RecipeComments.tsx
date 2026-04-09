"use client";

import { useEffect, useState } from "react";

import { GlassCard } from "@/components/design/glass-card";
import { createClient } from "@/lib/supabase/client";

import { RecipeCommentForm } from "./RecipeCommentForm";
import { RecipeCommentItem, type RecipeCommentNode } from "./RecipeCommentItem";

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

interface RecipeCommentsPayload {
  comments: RecipeCommentNode[];
  total: number;
}

interface RecipeCommentsProps {
  recipeId: string;
}

const PAGE_LIMIT = 20;

function CommentSkeleton() {
  return (
    <div className="space-y-3 rounded-2xl border border-zinc-800/80 bg-zinc-950/50 p-4">
      <div className="flex gap-3">
        <div className="h-10 w-10 animate-pulse rounded-full bg-zinc-800" />
        <div className="flex-1 space-y-3">
          <div className="flex flex-wrap gap-2">
            <div className="h-4 w-24 animate-pulse rounded bg-zinc-800" />
            <div className="h-4 w-12 animate-pulse rounded bg-zinc-900" />
            <div className="h-4 w-14 animate-pulse rounded bg-zinc-900" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-full animate-pulse rounded bg-zinc-900" />
            <div className="h-4 w-4/5 animate-pulse rounded bg-zinc-900" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function RecipeComments({ recipeId }: RecipeCommentsProps) {
  const [comments, setComments] = useState<RecipeCommentNode[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (active) {
        setIsLoggedIn(Boolean(user));
      }
    });

    return () => {
      active = false;
    };
  }, []);

  async function loadComments(targetPage: number, append = false) {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const response = await fetch(`/api/recipes/${recipeId}/comments?page=${targetPage}&limit=${PAGE_LIMIT}`);
      const payload = (await response.json()) as ApiResponse<RecipeCommentsPayload>;

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error?.message ?? "获取评论列表失败");
      }

      setComments((current) => (append ? [...current, ...payload.data!.comments] : payload.data!.comments));
      setTotal(payload.data.total);
      setPage(targetPage);
    } finally {
      if (append) {
        setLoadingMore(false);
      } else {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    void loadComments(1);
  }, [recipeId]);

  const hasMore = comments.length < total;

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-zinc-100">讨论区</h2>
        <p className="text-sm text-zinc-500">像 GitHub Discussion 一样交流问题、反馈、矩阵策略和优化建议。</p>
      </div>

      <RecipeCommentForm
        recipeId={recipeId}
        isLoggedIn={isLoggedIn}
        onSuccess={() => {
          void loadComments(1);
        }}
      />

      {loading ? (
        <div className="space-y-3">
          <CommentSkeleton />
          <CommentSkeleton />
          <CommentSkeleton />
        </div>
      ) : comments.length === 0 ? (
        <GlassCard className="space-y-3 py-10 text-center">
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-zinc-100">还没有讨论，来提第一个问题吧！</h3>
            <p className="text-sm text-zinc-500">比如：这个 Recipe 适合视频号吗？矩阵变量能不能开放成多平台版本？</p>
          </div>
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => (
            <RecipeCommentItem
              key={comment.id}
              recipeId={recipeId}
              comment={comment}
              isLoggedIn={isLoggedIn}
              onReplySuccess={() => {
                void loadComments(1);
              }}
            />
          ))}
        </div>
      )}

      {hasMore ? (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => void loadComments(page + 1, true)}
            disabled={loadingMore}
            className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-700 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingMore ? "加载中…" : "加载更多讨论"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
