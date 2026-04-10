"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import type { ReactNode } from "react";

import { AuroraButton } from "@/components/design/aurora-button";
import { GlassCard } from "@/components/design/glass-card";
import { RecipeExecuteGate } from "@/components/recipes/RecipeExecuteGate";
import { RecipeExecutionOutput } from "@/components/recipes/detail/RecipeExecutionOutput";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { formatRelativeTime } from "@/lib/format";
import { getRecipePlatforms } from "@/lib/recipe-utils";
import type {
  Recipe,
  RecipeExecutionOutput as RecipeExecutionOutputData,
  RecipeExecutionStatus,
  VideoPlatform,
} from "@/types/recipe";

interface PendingExecutionState {
  executionId: string;
  commandPreview: string;
}

interface ExecutionStatusPayload {
  status: RecipeExecutionStatus;
  progress_pct: number;
  output: RecipeExecutionOutputData | null;
  output_external_url: string | null;
  output_thumbnail_url: string | null;
  output_platform: string | null;
  error_message: string | null;
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

function getExecutionStatusLabel(status: RecipeExecutionStatus): string {
  const labels: Record<RecipeExecutionStatus, string> = {
    pending: "等待中",
    running: "执行中",
    script_done: "脚本完成",
    edit_done: "剪辑完成",
    publishing: "发布中",
    success: "已完成",
    failed: "失败",
  };

  return labels[status];
}

function getExecutionStatusClassName(status: RecipeExecutionStatus): string {
  if (status === "success") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  }

  if (status === "failed") {
    return "border-red-500/30 bg-red-500/10 text-red-300";
  }

  if (status === "pending") {
    return "border-zinc-700 bg-zinc-800/80 text-zinc-300";
  }

  return "border-cyan-500/30 bg-cyan-500/10 text-cyan-300";
}

function getOutputStatus(status: RecipeExecutionStatus): "pending" | "running" | "completed" | "failed" {
  if (status === "success") {
    return "completed";
  }
  if (status === "failed") {
    return "failed";
  }
  if (status === "pending") {
    return "pending";
  }
  return "running";
}

function normalizeExecutionOutput(payload: ExecutionStatusPayload): RecipeExecutionOutputData | null {
  if (payload.output) {
    return payload.output;
  }

  if (!payload.output_external_url || !payload.output_platform) {
    return null;
  }

  return {
    platform: payload.output_platform as VideoPlatform,
    video_url: payload.output_external_url,
    title: "执行产出",
    thumbnail_url: payload.output_thumbnail_url ?? undefined,
  };
}

// 计算退避轮询间隔（毫秒）
function getPollingInterval(elapsedMs: number): number {
  if (elapsedMs < 30000) {
    return 2000; // 前30秒：每2秒
  } else if (elapsedMs < 120000) {
    return 5000; // 30-120秒：每5秒
  } else {
    return 15000; // 120秒以上：每15秒
  }
}

function ExecutionStatusBadge({ 
  executionId, 
  recipe,
  onRetry 
}: { 
  executionId: string;
  recipe: Recipe;
  onRetry?: () => void;
}) {
  const [statusState, setStatusState] = useState<ExecutionStatusPayload | null>(null);
  const [startTime] = useState(Date.now());

  useEffect(() => {
    let active = true;
    let timeoutId: NodeJS.Timeout | null = null;

    async function loadExecutionStatus() {
      try {
        const response = await fetch(`/api/executions/${executionId}`);
        const payload = (await response.json()) as {
          success?: boolean;
          data?: ExecutionStatusPayload;
        };

        if (!active || !response.ok || !payload.success || !payload.data) {
          return;
        }

        setStatusState(payload.data);

        // 如果已完成或失败，停止轮询
        if (payload.data.status === "success" || payload.data.status === "failed") {
          return;
        }

        // 计算下一次轮询间隔
        const elapsed = Date.now() - startTime;
        const nextInterval = getPollingInterval(elapsed);
        
        timeoutId = setTimeout(() => {
          void loadExecutionStatus();
        }, nextInterval);
      } catch {
        // 轮询失败不阻塞主流程，继续下一次
        if (active) {
          const elapsed = Date.now() - startTime;
          const nextInterval = getPollingInterval(elapsed);
          timeoutId = setTimeout(() => {
            void loadExecutionStatus();
          }, nextInterval);
        }
      }
    }

    void loadExecutionStatus();

    return () => {
      active = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [executionId, startTime]);

  if (!statusState) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full border border-zinc-700 bg-zinc-800/80 px-2.5 py-1 text-zinc-300">
          正在同步状态…
        </span>
        <Link href="/dashboard" className="text-cyan-300 transition hover:text-cyan-200">
          查看执行详情
        </Link>
      </div>
    );
  }

  const isRunning = statusState.status !== "pending" && statusState.status !== "success" && statusState.status !== "failed";
  const isCompleted = statusState.status === "success";
  const isFailed = statusState.status === "failed";
  const output = normalizeExecutionOutput(statusState);
  const progress = statusState.progress_pct ?? 0;

  return (
    <div className="space-y-3">
      {/* 状态徽章 */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 ${getExecutionStatusClassName(statusState.status)}`}>
          {isRunning ? (
            <span className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />
          ) : null}
          {getExecutionStatusLabel(statusState.status)}
          <span className="tabular-ums opacity-80">{progress}%</span>
        </span>
        <Link href="/dashboard" className="text-cyan-300 transition hover:text-cyan-200">
          查看执行详情
        </Link>
      </div>

      {/* 进度条（running 状态） */}
      {isRunning && (
        <div className="space-y-1">
          <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${progress}%`,
                background: 'linear-gradient(90deg, #4f98a3, #01696f)',
              }}
            />
          </div>
          <p className="text-sm text-white/60 tabular-nums">{progress}%</p>
        </div>
      )}

      {/* 成功状态：视频预览卡片 */}
      {isCompleted && statusState.output_external_url && (
        <>
          <div className="mt-4 rounded-xl overflow-hidden border border-white/10">
            <video
              src={statusState.output_external_url}
              controls
              className="w-full max-h-64 object-contain bg-black"
            />
            <div className="p-3 flex items-center justify-between bg-white/5">
              <span className="text-sm text-white/80">执行完成</span>
              <a
                href={statusState.output_external_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-teal-400 hover:text-teal-300 underline"
              >
                在新标签页打开
              </a>
            </div>
          </div>
          <ExecutionShareCard
            recipeTitle={recipe.title}
            recipeSlug={recipe.slug || recipe.id}
            videoUrl={statusState.output_external_url}
          />
        </>
      )}

      {/* 成功但未回填链接 */}
      {isCompleted && !statusState.output_external_url && (
        <div className="mt-4 p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10">
          <p className="text-sm text-emerald-300">执行完成，等待 Agent 回填视频链接</p>
        </div>
      )}

      {/* 失败状态：错误信息 + 重试按钮 */}
      {isFailed && (
        <div className="mt-4 space-y-2">
          {statusState.error_message && (
            <p className="text-sm text-red-400 bg-red-400/10 rounded-lg px-3 py-2">
              {statusState.error_message}
            </p>
          )}
          {onRetry && (
            <button
              onClick={onRetry}
              className="w-full py-2 rounded-lg border border-white/20 text-sm text-white/80 hover:bg-white/10 transition-colors"
            >
              重试
            </button>
          )}
        </div>
      )}

      {/* 输出卡片（如果有） */}
      {output && !isCompleted && (
        <RecipeExecutionOutput output={output} status={getOutputStatus(statusState.status)} />
      )}
    </div>
  );
}

interface ExecutionShareCardProps {
  recipeTitle: string;
  recipeSlug: string;
  videoUrl: string;
}

function ExecutionShareCard({ recipeTitle, recipeSlug, videoUrl }: ExecutionShareCardProps) {
  const [copied, setCopied] = useState(false);
  
  const shareText = `🎬 我刚用 @BotBili 执行了一个 AI 视频 Recipe！\n\n「${recipeTitle}」\n\n📹 ${videoUrl}\n\n#AI视频 #BotBili #AICreator`;
  
  const tweetText = encodeURIComponent(shareText);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 复制失败静默处理
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xl">🚀</span>
        <h4 className="font-semibold text-emerald-300">分享你的成果</h4>
      </div>
      
      <p className="text-sm text-emerald-200/70">
        帮助更多人发现这个 Recipe，传播飞轮从这里开始
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/20"
        >
          {copied ? "✅ 已复制" : "📋 复制分享文案"}
        </button>
        
        <a
          href={`https://twitter.com/intent/tweet?text=${tweetText}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-950/70 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:border-emerald-500/30 hover:text-emerald-300"
        >
          🐦 分享到 X
        </a>
      </div>

      <div className="rounded-lg border border-emerald-500/10 bg-black/20 p-3">
        <p className="text-xs text-emerald-200/60 font-mono whitespace-pre-wrap break-all">
          {shareText}
        </p>
      </div>
    </div>
  );
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
          <div className="space-y-2">
            <p className="text-xs text-zinc-500">
              最近一次执行已创建：<span className="text-zinc-300">{pendingExecution.executionId}</span>
            </p>
            <ExecutionStatusBadge 
              executionId={pendingExecution.executionId}
              recipe={recipe}
              onRetry={onExecute}
            />
          </div>
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
        <div className="fixed inset-x-4 bottom-4 z-40 rounded-2xl border border-zinc-800/80 bg-zinc-950/95 p-3 pb-safe shadow-2xl backdrop-blur">
          <p className="mb-2 text-center text-xs text-zinc-500">{executeHook}</p>
          <div className="space-y-2">
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

            <div className="grid grid-cols-3 gap-2">
              <Button
                type="button"
                variant={starred ? "secondary" : "outline"}
                disabled={disabledActions || actionLoading !== null}
                onClick={() => void handleAction("star", onStar)}
                title={disabledActions ? "请先登录" : undefined}
                className="border-zinc-700 bg-zinc-900"
              >
                {starred ? "⭐ Star" : "⭐ Star"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={disabledActions || actionLoading !== null}
                onClick={() => void handleAction("fork", onFork)}
                title={disabledActions ? "请先登录" : undefined}
                className="border-zinc-700 bg-zinc-900"
              >
                🍴 Fork
              </Button>
              <Button
                type="button"
                variant={saved ? "secondary" : "outline"}
                disabled={disabledActions || actionLoading !== null}
                onClick={() => void handleAction("save", onSave)}
                title={disabledActions ? "请先登录" : undefined}
                className="border-zinc-700 bg-zinc-900"
              >
                {saved ? "🔖 已收藏" : "🔖 收藏"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
