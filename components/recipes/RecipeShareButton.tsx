"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Command, Copy, ExternalLink, Share2 } from "lucide-react";

import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

interface RecipeShareButtonProps {
  recipeId: string;
  recipeTitle: string;
  recipeSlug: string;
  className?: string;
}

type ShareMethod = "copy_link" | "twitter" | "openclaw_cmd";

const APP_ORIGIN = process.env.NEXT_PUBLIC_APP_URL ?? "https://botbili.com";

async function copyText(value: string): Promise<void> {
  await navigator.clipboard.writeText(value);
}

export function RecipeShareButton({
  recipeId,
  recipeTitle,
  recipeSlug,
  className,
}: RecipeShareButtonProps) {
  const { toast } = useToast();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [lastAction, setLastAction] = useState<ShareMethod | null>(null);

  const recipeUrl = useMemo(() => `${APP_ORIGIN}/recipes/${recipeId}`, [recipeId]);
  const command = useMemo(() => `openclaw run recipe:${recipeSlug}`, [recipeSlug]);
  const twitterUrl = useMemo(() => {
    const text = `${recipeTitle} — 发现这个 AI 视频 Recipe on BotBili\n${recipeUrl}`;
    return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
  }, [recipeTitle, recipeUrl]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  async function handleCopyLink() {
    try {
      await copyText(recipeUrl);
      setLastAction("copy_link");
      toast("链接已复制", { variant: "success" });
    } catch {
      toast("复制链接失败", { variant: "error" });
    }
  }

  async function handleCopyCommand() {
    try {
      await copyText(command);
      setLastAction("openclaw_cmd");
      toast("OpenClaw 命令已复制", { variant: "success" });
    } catch {
      toast("复制命令失败", { variant: "error" });
    }
  }

  function handleShareToTwitter() {
    window.open(twitterUrl, "_blank", "noopener,noreferrer");
    setLastAction("twitter");
    toast("已打开 X / Twitter 分享窗口", { variant: "success" });
    setOpen(false);
  }

  function getActionState(method: ShareMethod): boolean {
    return lastAction === method;
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-950/70 px-3 py-1.5 text-sm text-zinc-300 transition hover:border-zinc-600 hover:text-zinc-50"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <Share2 className="h-4 w-4" />
        <span>分享</span>
      </button>

      {open ? (
        <div
          className="absolute right-0 top-full z-30 mt-2 w-72 rounded-2xl border border-zinc-800/90 bg-zinc-950/95 p-2 shadow-2xl backdrop-blur"
          role="menu"
        >
          <button
            type="button"
            className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-zinc-900/80"
            onClick={() => void handleCopyLink()}
          >
            {getActionState("copy_link") ? (
              <Check className="mt-0.5 h-4 w-4 text-emerald-400" />
            ) : (
              <Copy className="mt-0.5 h-4 w-4 text-zinc-400" />
            )}
            <span className="space-y-1">
              <span className="block text-sm font-medium text-zinc-100">复制链接</span>
              <span className="block text-xs text-zinc-500">{recipeUrl}</span>
            </span>
          </button>

          <button
            type="button"
            className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-zinc-900/80"
            onClick={handleShareToTwitter}
          >
            {getActionState("twitter") ? (
              <Check className="mt-0.5 h-4 w-4 text-emerald-400" />
            ) : (
              <ExternalLink className="mt-0.5 h-4 w-4 text-zinc-400" />
            )}
            <span className="space-y-1">
              <span className="block text-sm font-medium text-zinc-100">分享到 X / Twitter</span>
              <span className="block text-xs text-zinc-500">带上标题和 BotBili 链接，一键打开分享窗口</span>
            </span>
          </button>

          <button
            type="button"
            className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-zinc-900/80"
            onClick={() => void handleCopyCommand()}
          >
            {getActionState("openclaw_cmd") ? (
              <Check className="mt-0.5 h-4 w-4 text-emerald-400" />
            ) : (
              <Command className="mt-0.5 h-4 w-4 text-zinc-400" />
            )}
            <span className="space-y-1">
              <span className="block text-sm font-medium text-zinc-100">复制 OpenClaw 命令</span>
              <span className="block text-xs text-zinc-500">{command}</span>
            </span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
