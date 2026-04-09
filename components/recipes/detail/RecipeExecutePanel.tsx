"use client";

import { useState } from "react";
import Link from "next/link";
import type { ReactNode } from "react";

import { AuroraButton } from "@/components/design/aurora-button";
import { GlassCard } from "@/components/design/glass-card";
import { RecipeExecuteGate } from "@/components/recipes/RecipeExecuteGate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { formatRelativeTime } from "@/lib/format";
import type { Recipe } from "@/types/recipe";

interface PendingExecutionState {
  executionId: string;
  commandPreview: string;
}

interface RecipeExecutePanelProps {
  recipe: Recipe;
  starred: boolean;
  saved: boolean;
  commandPreview: string;
  pendingExecution: PendingExecutionState | null;
  disabledActions: boolean;
  authorActions?: ReactNode;
  onExecute: () => Promise<void>;
  onStar: () => Promise<void>;
  onFork: () => Promise<void>;
  onSave: () => Promise<void>;
}

function getRecipePlatforms(recipe: Recipe): string[] {
  const nextPlatforms = Array.isArray(recipe.platforms) ? recipe.platforms : [];
  const legacyPlatforms = Array.isArray(recipe.platform) ? recipe.platform : [];
  return nextPlatforms.length > 0 ? nextPlatforms : legacyPlatforms;
}

export function RecipeExecutePanel({
  recipe,
  starred,
  saved,
  commandPreview,
  pendingExecution,
  disabledActions,
  authorActions,
  onExecute,
  onStar,
  onFork,
  onSave,
}: RecipeExecutePanelProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [actionLoading, setActionLoading] = useState<"execute" | "star" | "fork" | "save" | null>(null);

  async function handleAction(action: "execute" | "star" | "fork" | "save", callback: () => Promise<void>) {
    if (disabledActions) {
      toast("请先登录", { variant: "warning" });
      return;
    }

    setActionLoading(action);
    try {
      await callback();
    } finally {
      setActionLoading(null);
    }
  }

  async function handleCopyCommand() {
    try {
      await navigator.clipboard.writeText(commandPreview);
      setCopied(true);
      toast("命令已复制到剪贴板", { variant: "success" });
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast("复制失败，请手动复制", { variant: "error" });
    }
  }

  const executeHook =
    recipe.exec_count === 0
      ? "成为第一个执行者 🚀"
      : recipe.exec_count < 10
        ? `已有 ${recipe.exec_count} 人执行过`
        : `热门 Recipe ⭐ 已执行 ${recipe.exec_count} 次`;

  const infoPanel = (
    <GlassCard className="space-y-5">
      {authorActions ? (
        <div className="space-y-2 rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">作者操作</p>
          {authorActions}
        </div>
      ) : null}

      <div className="space-y-3">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Action Panel</p>
          <h2 className="text-xl font-semibold text-zinc-100">执行 / Star / Fork / 收藏</h2>
        </div>

        <div className="rounded-2xl border border-cyan-500/15 bg-cyan-500/5 px-4 py-3">
          <p className="text-sm font-medium text-cyan-200">{executeHook}</p>
        </div>

        <RecipeExecuteGate recipeId={recipe.id}>
          <AuroraButton
            className="w-full justify-center"
            disabled={disabledActions || actionLoading === "execute"}
            onClick={() => void handleAction("execute", onExecute)}
            title={disabledActions ? "请先登录" : undefined}
          >
            {actionLoading === "execute" ? "执行中…" : "▶️ 执行这个 Recipe"}
          </AuroraButton>
        </RecipeExecuteGate>

        <div className="grid grid-cols-3 gap-2">
          <Button
            type="button"
            variant={starred ? "secondary" : "outline"}
            disabled={disabledActions || actionLoading !== null}
            onClick={() => void handleAction("star", onStar)}
            title={disabledActions ? "请先登录" : undefined}
            className="border-zinc-700 bg-zinc-950/70"
          >
            {starred ? "⭐ 已 Star" : "⭐ Star"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={disabledActions || actionLoading !== null}
            onClick={() => void handleAction("fork", onFork)}
            title={disabledActions ? "请先登录" : undefined}
            className="border-zinc-700 bg-zinc-950/70"
          >
            🍴 Fork
          </Button>
          <Button
            type="button"
            variant={saved ? "secondary" : "outline"}
            disabled={disabledActions || actionLoading !== null}
            onClick={() => void handleAction("save", onSave)}
            title={disabledActions ? "请先登录" : undefined}
            className="border-zinc-700 bg-zinc-950/70"
          >
            {saved ? "🔖 已收藏" : "🔖 收藏"}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">OpenClaw 命令</p>
          <button
            type="button"
            onClick={() => void handleCopyCommand()}
            className="text-xs text-cyan-300 transition hover:text-cyan-200"
          >
            {copied ? "已复制" : "复制"}
          </button>
        </div>
        <pre className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950/80 p-4 text-xs leading-6 text-zinc-300">
          <code>{commandPreview}</code>
        </pre>
        <p className="text-xs text-zinc-500">
          不熟悉 OpenClaw？点击执行按钮，我们会帮你生成完整步骤。
          <Link href="/setup-agent" className="ml-1 text-cyan-300 transition hover:text-cyan-200">
            去设置
          </Link>
        </p>
        {pendingExecution ? (
          <p className="text-xs text-zinc-500">
            最近一次执行已创建：<span className="text-zinc-300">{pendingExecution.executionId}</span>
          </p>
        ) : null}
      </div>

      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Recipe 信息</p>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="border-zinc-700 bg-zinc-950/70 text-zinc-300">
            难度：{recipe.difficulty}
          </Badge>
          {getRecipePlatforms(recipe).map((platform) => (
            <Badge key={platform} variant="outline" className="border-zinc-700 bg-zinc-950/70 text-zinc-300">
              {platform}
            </Badge>
          ))}
        </div>
        <p className="text-sm text-zinc-500">
          最近更新：<span className="text-zinc-300">{formatRelativeTime(recipe.updated_at)}</span>
        </p>
      </div>
    </GlassCard>
  );

  return (
    <>
      <div className="hidden lg:block lg:sticky lg:top-20">{infoPanel}</div>

      <div className="lg:hidden">
        <div className="h-20" />
        <div className="fixed inset-x-4 bottom-4 z-40 rounded-2xl border border-zinc-800/80 bg-zinc-950/95 p-3 shadow-2xl backdrop-blur">
          <p className="mb-2 text-center text-xs text-zinc-500">{executeHook}</p>
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <RecipeExecuteGate recipeId={recipe.id}>
                <AuroraButton
                  className="w-full justify-center"
                  disabled={disabledActions || actionLoading === "execute"}
                  onClick={() => void handleAction("execute", onExecute)}
                  title={disabledActions ? "请先登录" : undefined}
                >
                  {actionLoading === "execute" ? "执行中…" : "执行这个 Recipe"}
                </AuroraButton>
              </RecipeExecuteGate>
            </div>

            <Button
              type="button"
              variant={starred ? "secondary" : "outline"}
              disabled={disabledActions || actionLoading !== null}
              onClick={() => void handleAction("star", onStar)}
              title={disabledActions ? "请先登录" : undefined}
              className="shrink-0 border-zinc-700 bg-zinc-900 px-4"
            >
              {starred ? "⭐" : "☆"}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
