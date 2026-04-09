"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";

import type { RecipeCommentType } from "./CommentTypeBadge";

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

interface RecipeCommentFormProps {
  recipeId: string;
  parentId?: string;
  onSuccess: () => void;
  onCancel?: () => void;
  defaultCommentType?: RecipeCommentType;
  isLoggedIn?: boolean | null;
}

const COMMENT_TYPE_OPTIONS: Array<{ value: RecipeCommentType; label: string }> = [
  { value: "question", label: "提问" },
  { value: "feedback", label: "反馈" },
  { value: "optimization", label: "优化建议" },
  { value: "matrix", label: "矩阵策略" },
  { value: "bug", label: "问题反馈" },
];

const MIN_COMMENT_LENGTH = 10;
const MAX_COMMENT_LENGTH = 2000;

export function RecipeCommentForm({
  recipeId,
  parentId,
  onSuccess,
  onCancel,
  defaultCommentType = "question",
  isLoggedIn,
}: RecipeCommentFormProps) {
  const { toast } = useToast();
  const [content, setContent] = useState("");
  const [commentType, setCommentType] = useState<RecipeCommentType>(defaultCommentType);
  const [submitting, setSubmitting] = useState(false);
  const [resolvedLoginState, setResolvedLoginState] = useState<boolean | null>(isLoggedIn ?? null);

  useEffect(() => {
    if (typeof isLoggedIn === "boolean") {
      setResolvedLoginState(isLoggedIn);
      return;
    }

    let active = true;
    const supabase = createClient();

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (active) {
        setResolvedLoginState(Boolean(user));
      }
    });

    return () => {
      active = false;
    };
  }, [isLoggedIn]);

  const trimmedLength = content.trim().length;
  const contentError =
    trimmedLength === 0
      ? null
      : trimmedLength < MIN_COMMENT_LENGTH
        ? `至少输入 ${MIN_COMMENT_LENGTH} 个字`
        : trimmedLength > MAX_COMMENT_LENGTH
          ? `最多输入 ${MAX_COMMENT_LENGTH} 个字`
          : null;

  async function handleSubmit() {
    const trimmed = content.trim();
    if (trimmed.length < MIN_COMMENT_LENGTH || trimmed.length > MAX_COMMENT_LENGTH) {
      toast(contentError ?? "评论内容不符合要求", { variant: "warning" });
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/recipes/${recipeId}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: trimmed,
          parent_id: parentId,
          comment_type: parentId ? undefined : commentType,
        }),
      });

      const payload = (await response.json()) as ApiResponse<{ comment: unknown }>;
      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message ?? "发表评论失败");
      }

      setContent("");
      if (!parentId) {
        setCommentType(defaultCommentType);
      }

      toast(parentId ? "回复已发送" : "评论已发布", { variant: "success" });
      onSuccess();
      onCancel?.();
    } catch (error) {
      toast(error instanceof Error ? error.message : "发表评论失败", { variant: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  if (resolvedLoginState === null) {
    return (
      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/40 p-4">
        <div className="h-4 w-32 animate-pulse rounded bg-zinc-800" />
      </div>
    );
  }

  if (!resolvedLoginState) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/50 p-4 text-sm text-zinc-400">
        <Link href="/login" className="text-cyan-400 transition hover:text-cyan-300 hover:underline">
          登录后参与讨论
        </Link>
        <span>，你可以提问题、给优化建议，或者讨论矩阵策略。</span>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-zinc-800/80 bg-zinc-950/50 p-4">
      {!parentId ? (
        <label className="block space-y-2">
          <span className="text-xs uppercase tracking-[0.18em] text-zinc-500">讨论类型</span>
          <select
            value={commentType}
            onChange={(event) => setCommentType(event.target.value as RecipeCommentType)}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-cyan-500/60"
          >
            {COMMENT_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <label className="block space-y-2">
        <span className="text-xs uppercase tracking-[0.18em] text-zinc-500">{parentId ? "回复内容" : "评论内容"}</span>
        <Textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder={parentId ? "补充你的看法或解决方案…" : "这个 Recipe 适合视频号吗？有哪些变量还能再开放一些？"}
          error={contentError ?? undefined}
          rows={parentId ? 4 : 5}
          className="min-h-[120px] border-zinc-800 bg-zinc-950 text-zinc-100"
          disabled={submitting}
        />
      </label>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-zinc-500">
          {trimmedLength}/{MAX_COMMENT_LENGTH}
        </p>

        <div className="flex items-center gap-2">
          {onCancel ? (
            <Button
              type="button"
              variant="ghost"
              onClick={onCancel}
              disabled={submitting}
              className="text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
            >
              取消
            </Button>
          ) : null}
          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitting || Boolean(contentError) || trimmedLength === 0}
            className="bg-cyan-500 text-zinc-950 hover:bg-cyan-400"
          >
            {submitting ? "发送中…" : parentId ? "回复" : "发表评论"}
          </Button>
        </div>
      </div>
    </div>
  );
}
