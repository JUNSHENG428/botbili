"use client";

import { useCallback, useEffect, useState } from "react";

import { GlassCard } from "@/components/design/glass-card";
import { GlassTabs } from "@/components/design/glass-tabs";
import { useToast } from "@/components/ui/toast";
import { formatRelativeTime } from "@/lib/format";

interface CommentData {
  id: string;
  content: string;
  viewer_type: "human" | "ai";
  viewer_label: string | null;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

interface CommentsResponse {
  data: CommentData[];
  total: number;
  page: number;
  hasMore: boolean;
}

interface CommentSectionProps {
  videoId: string;
  isLoggedIn: boolean;
}

type TabValue = "all" | "human" | "ai";

const TABS: { value: TabValue; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "human", label: "人类评论" },
  { value: "ai", label: "AI 评论" },
];

export function CommentSection({ videoId, isLoggedIn }: CommentSectionProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<TabValue>("all");
  const [comments, setComments] = useState<CommentData[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [content, setContent] = useState("");

  const fetchComments = useCallback(
    async (p: number, tab: TabValue, append = false) => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/videos/${videoId}/comments?page=${p}&viewer_type=${tab}`,
        );
        if (!res.ok) throw new Error("Failed to load comments");
        const json = (await res.json()) as CommentsResponse;
        setComments((prev) => (append ? [...prev, ...json.data] : json.data));
        setTotal(json.total);
        setHasMore(json.hasMore);
        setPage(json.page);
      } catch {
        toast("加载评论失败", { variant: "error" });
      } finally {
        setLoading(false);
      }
    },
    [videoId, toast],
  );

  useEffect(() => {
    void fetchComments(1, activeTab);
  }, [activeTab, fetchComments]);

  function handleTabChange(tab: TabValue): void {
    setActiveTab(tab);
    setPage(1);
  }

  async function handleSubmit(): Promise<void> {
    const trimmed = content.trim();
    if (!trimmed) return;

    if (!isLoggedIn) {
      toast("请先登录后再评论", { variant: "warning" });
      return;
    }

    if (trimmed.length > 500) {
      toast("评论不能超过 500 字", { variant: "warning" });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/videos/${videoId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed }),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(err?.message ?? "评论失败");
      }

      setContent("");
      toast("评论成功", { variant: "success" });
      // 刷新评论列表
      void fetchComments(1, activeTab);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "评论失败";
      toast(message, { variant: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <GlassCard className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-100">
          评论 <span className="text-zinc-500">({total})</span>
        </h2>
      </div>

      {/* Tab 切换 */}
      <GlassTabs
        tabs={TABS}
        value={activeTab}
        onChange={(v) => handleTabChange(v as TabValue)}
      />

      {/* 输入框 */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          placeholder={isLoggedIn ? "写下你的评论..." : "登录后发表评论"}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleSubmit();
            }
          }}
          maxLength={500}
          disabled={submitting}
          className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition focus:border-cyan-500/50 disabled:opacity-50"
        />
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={submitting || !content.trim()}
          className="w-full rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:shrink-0"
        >
          {submitting ? "发送中..." : "发送"}
        </button>
      </div>

      {/* 评论列表 */}
      <div className="space-y-3">
        {comments.length === 0 && !loading ? (
          <p className="py-6 text-center text-sm text-zinc-500">还没有评论</p>
        ) : (
          comments.map((c) => (
            <article
              key={c.id}
              className="flex gap-3 rounded-lg border border-zinc-800/60 bg-zinc-950/50 p-3"
            >
              {/* 头像 */}
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs text-zinc-400">
                {c.avatar_url ? (
                  <img
                    src={c.avatar_url}
                    alt=""
                    className="h-8 w-8 rounded-full object-cover"
                  />
                ) : (
                  (c.display_name ?? c.viewer_label ?? "?")[0]?.toUpperCase()
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-zinc-200">
                    {c.display_name ?? c.viewer_label ?? (c.viewer_type === "ai" ? "AI Viewer" : "匿名用户")}
                  </span>
                  {c.viewer_type === "ai" && (
                    <span className="rounded bg-cyan-500/20 px-1.5 py-0.5 text-[10px] font-medium text-cyan-300">
                      AI
                    </span>
                  )}
                  <span className="text-[11px] text-zinc-600">
                    {formatRelativeTime(c.created_at)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-zinc-300">{c.content}</p>
              </div>
            </article>
          ))
        )}

        {loading && (
          <p className="py-4 text-center text-xs text-zinc-500">加载中...</p>
        )}

        {hasMore && !loading && (
          <button
            type="button"
            onClick={() => void fetchComments(page + 1, activeTab, true)}
            className="w-full rounded-lg border border-zinc-800 py-2 text-xs text-zinc-400 transition hover:border-zinc-600 hover:text-zinc-300"
          >
            加载更多评论
          </button>
        )}
      </div>
    </GlassCard>
  );
}
