"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { formatRelativeTime } from "@/lib/format";

import { CommentTypeBadge, type RecipeCommentType } from "./CommentTypeBadge";
import { RecipeCommentForm } from "./RecipeCommentForm";

interface RecipeCommentAuthor {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  author_type: "human" | "ai_agent";
}

export interface RecipeCommentNode {
  id: string;
  recipe_id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  comment_type: RecipeCommentType;
  like_count: number;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
  author: RecipeCommentAuthor;
  viewer_liked?: boolean;
  replies?: RecipeCommentNode[];
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

interface RecipeCommentItemProps {
  recipeId: string;
  comment: RecipeCommentNode;
  onReplySuccess: () => void;
  isLoggedIn?: boolean | null;
  depth?: number;
}

const DEFAULT_VISIBLE_REPLIES = 2;

export function RecipeCommentItem({
  recipeId,
  comment,
  onReplySuccess,
  isLoggedIn,
  depth = 0,
}: RecipeCommentItemProps) {
  const { toast } = useToast();
  const [localComment, setLocalComment] = useState(comment);
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [showAllReplies, setShowAllReplies] = useState(false);
  const canReply = depth < 1;
  const replies = localComment.replies ?? [];
  const visibleReplies = showAllReplies ? replies : replies.slice(0, DEFAULT_VISIBLE_REPLIES);
  const hiddenReplyCount = Math.max(0, replies.length - DEFAULT_VISIBLE_REPLIES);

  useEffect(() => {
    setLocalComment(comment);
  }, [comment]);

  async function handleLikeToggle() {
    if (!isLoggedIn) {
      toast("请先登录", { variant: "warning" });
      return;
    }

    const previousLiked = Boolean(localComment.viewer_liked);
    const nextLiked = !previousLiked;

    setLocalComment((current) => ({
      ...current,
      viewer_liked: nextLiked,
      like_count: Math.max(0, current.like_count + (nextLiked ? 1 : -1)),
    }));

    try {
      const response = await fetch(`/api/recipes/${recipeId}/comments/${localComment.id}/like`, {
        method: "POST",
      });
      const payload = (await response.json()) as ApiResponse<{ liked: boolean; like_count: number }>;

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error?.message ?? "评论点赞失败");
      }

      setLocalComment((current) => ({
        ...current,
        viewer_liked: payload.data!.liked,
        like_count: payload.data!.like_count,
      }));
    } catch (error) {
      setLocalComment((current) => ({
        ...current,
        viewer_liked: previousLiked,
        like_count: Math.max(0, current.like_count + (previousLiked ? 1 : -1)),
      }));
      toast(error instanceof Error ? error.message : "评论点赞失败", { variant: "error" });
    }
  }

  const authorDisplayName = localComment.author.display_name ?? localComment.author.username;
  const avatarInitial = authorDisplayName.trim().charAt(0).toUpperCase() || "?";

  return (
    <article className="space-y-3 rounded-2xl border border-zinc-800/80 bg-zinc-950/55 p-4">
      <div className="flex gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-zinc-800 bg-zinc-900 text-xs font-medium text-zinc-300">
          {localComment.author.avatar_url ? (
            <img src={localComment.author.avatar_url} alt={authorDisplayName} className="h-full w-full object-cover" />
          ) : (
            avatarInitial
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-semibold text-zinc-100">{authorDisplayName}</span>
            <span
              className="text-xs text-zinc-500"
              title={localComment.author.author_type === "ai_agent" ? "AI Agent 作者" : "人类作者"}
            >
              {localComment.author.author_type === "ai_agent" ? "🤖" : "👤"}
            </span>
            <CommentTypeBadge type={localComment.comment_type} />
            {localComment.is_pinned ? (
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-200">
                作者置顶
              </span>
            ) : null}
            <span className="text-xs text-zinc-500">{formatRelativeTime(localComment.created_at)}</span>
          </div>

          <p className="whitespace-pre-wrap text-sm leading-7 text-zinc-300">{localComment.content}</p>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void handleLikeToggle()}
              className="h-8 px-2 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
            >
              {localComment.viewer_liked ? "👍 已赞" : "👍"} {localComment.like_count}
            </Button>

            {canReply ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowReplyForm((current) => !current)}
                className="h-8 px-2 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
              >
                {showReplyForm ? "收起回复" : "回复"}
              </Button>
            ) : null}
          </div>

          {showReplyForm ? (
            <RecipeCommentForm
              recipeId={recipeId}
              parentId={localComment.id}
              defaultCommentType={localComment.comment_type}
              isLoggedIn={isLoggedIn}
              onCancel={() => setShowReplyForm(false)}
              onSuccess={onReplySuccess}
            />
          ) : null}

          {visibleReplies.length > 0 ? (
            <div className="space-y-3 border-l border-zinc-800 pl-4">
              {visibleReplies.map((reply) => (
                <RecipeCommentItem
                  key={reply.id}
                  recipeId={recipeId}
                  comment={reply}
                  onReplySuccess={onReplySuccess}
                  isLoggedIn={isLoggedIn}
                  depth={depth + 1}
                />
              ))}

              {!showAllReplies && hiddenReplyCount > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAllReplies(true)}
                  className="h-8 px-2 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
                >
                  查看更多回复（{hiddenReplyCount}）
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}
