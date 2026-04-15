"use client";

import Link from "next/link";
import { useMemo } from "react";

import { GlassCard } from "@/components/design/glass-card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
interface RecipeShareActionsProps {
  recipeTitle: string;
  recipeSlug: string;
  resultUrl?: string | null;
  resultTitle?: string | null;
  resultPlatform?: string | null;
  previewImageUrl?: string | null;
}

function buildRecipeUrl(recipeSlug: string): string {
  return `${window.location.origin}/recipes/${recipeSlug}`;
}

function buildShareText(input: {
  recipeTitle: string;
  recipeUrl: string;
  resultUrl?: string | null;
  resultTitle?: string | null;
  resultPlatform?: string | null;
}): string {
  const headline = input.resultTitle?.trim() || input.recipeTitle;
  const platformLine = input.resultPlatform ? `平台：${input.resultPlatform}` : "平台：BotBili Recipe";
  const resultLine = input.resultUrl ? `公开视频：${input.resultUrl}` : `Recipe 页面：${input.recipeUrl}`;
  const introLine = input.resultUrl
    ? `我刚在 BotBili 跑通了「${headline}」`
    : `我正在 BotBili 跑「${headline}」这条 Recipe，准备发布第一条结果`;

  return [
    introLine,
    platformLine,
    resultLine,
    `Recipe 来源：${input.recipeUrl}`,
    "Made with BotBili",
  ].join("\n");
}

export function RecipeShareActions({
  recipeTitle,
  recipeSlug,
  resultUrl,
  resultTitle,
  resultPlatform,
  previewImageUrl,
}: RecipeShareActionsProps) {
  const { toast } = useToast();
  const normalizedResultUrl = resultUrl?.trim() || null;
  const hasPublicResult = Boolean(normalizedResultUrl);

  const sharePayload = useMemo(() => {
    const recipeUrl = buildRecipeUrl(recipeSlug);
    const text = buildShareText({
      recipeTitle,
      recipeUrl,
      resultUrl: normalizedResultUrl,
      resultTitle,
      resultPlatform,
    });

    return {
      recipeUrl,
      text,
      xIntent: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
    };
  }, [normalizedResultUrl, recipeSlug, recipeTitle, resultPlatform, resultTitle]);

  async function copyText(value: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast(successMessage, { variant: "success" });
    } catch {
      toast("复制失败，请手动复制", { variant: "error" });
    }
  }

  async function handleNativeShare() {
    if (!navigator.share) {
      await copyText(sharePayload.text, "分享文案已复制");
      return;
    }

    try {
      await navigator.share({
        title: resultTitle || recipeTitle,
        text: sharePayload.text,
        url: normalizedResultUrl || sharePayload.recipeUrl,
      });
    } catch {
      // 用户取消分享时静默处理
    }
  }

  if (!hasPublicResult) {
    return (
      <GlassCard className="space-y-4 border-amber-500/20 bg-amber-500/5">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.18em] text-amber-300/80">Share</p>
          <h3 className="text-lg font-semibold text-zinc-100">先跑出第一条公开结果，再开始分享</h3>
          <p className="text-sm leading-7 text-zinc-400">
            当前还没有公开视频链接。先执行这条 Recipe，把结果发布到外部平台，再回填公开链接，分享转化会明显更高。
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
            <p className="text-sm font-medium text-zinc-100">1. 运行 Recipe</p>
            <p className="mt-2 text-xs leading-6 text-zinc-500">确认 execution 状态从等待领取变成执行中，再到已完成。</p>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
            <p className="text-sm font-medium text-zinc-100">2. 发布公开视频</p>
            <p className="mt-2 text-xs leading-6 text-zinc-500">发布到 B 站、YouTube、抖音等外部平台，让这条结果可验证、可传播。</p>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
            <p className="text-sm font-medium text-zinc-100">3. 回填后再分享</p>
            <p className="mt-2 text-xs leading-6 text-zinc-500">回到这个页面复制结果页链接和公开视频链接，带上 Made with BotBili。</p>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Button
            type="button"
            variant="outline"
            className="min-h-11 border-zinc-700 bg-zinc-950/70"
            onClick={() => void copyText(sharePayload.recipeUrl, "Recipe 页面链接已复制")}
          >
            复制 Recipe 页面
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 border-zinc-700 bg-zinc-950/70"
            onClick={() => void copyText(sharePayload.text, "预热分享文案已复制")}
          >
            复制预热文案
          </Button>
          <Link
            href="/setup-agent"
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-950/70 px-3 text-sm text-zinc-200 transition hover:border-zinc-600 hover:text-zinc-50"
          >
            去连接 Agent
          </Link>
          <Link
            href="/onboarding?step=5"
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 text-sm text-amber-100 transition hover:border-amber-400/40 hover:text-white"
          >
            看最后一步指引
          </Link>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="space-y-4 border-cyan-500/20 bg-cyan-500/5">
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-[0.18em] text-cyan-300/80">Share</p>
        <h3 className="text-lg font-semibold text-zinc-100">分享这次结果，让更多人跟着跑通</h3>
        <p className="text-sm leading-7 text-zinc-400">
          先复制结果页链接，再带上公开视频链接传播。分享内容会自动附带 “Made with BotBili” 回流信息。
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/80">
        <div className="grid gap-0 md:grid-cols-[180px_minmax(0,1fr)]">
          <div className="relative min-h-[180px] border-b border-zinc-800 bg-zinc-900 md:border-b-0 md:border-r">
            {previewImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewImageUrl} alt={resultTitle || recipeTitle} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full min-h-[180px] items-center justify-center bg-[radial-gradient(circle_at_30%_20%,rgba(34,211,238,0.14),transparent_36%),#09090b] text-sm text-zinc-500">
                Made with BotBili
              </div>
            )}
          </div>
          <div className="space-y-3 p-4">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Share Card</p>
              <p className="text-lg font-semibold text-zinc-100">{resultTitle || recipeTitle}</p>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500">
                <span>{resultPlatform ? `平台：${resultPlatform}` : "平台：BotBili Recipe"}</span>
                <span>来源：/recipes/{recipeSlug}</span>
                <span className="text-cyan-300">Made with BotBili</span>
              </div>
            </div>
            <p className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 text-xs leading-6 text-zinc-400 whitespace-pre-wrap">
              {sharePayload.text}
            </p>
            <div className="flex flex-wrap gap-2 text-xs text-zinc-500">
              <span className="rounded-full border border-zinc-700 px-2 py-1">适合发到社群</span>
              <span className="rounded-full border border-zinc-700 px-2 py-1">适合发到 X</span>
              <span className="rounded-full border border-zinc-700 px-2 py-1">适合放进评论区引流</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Button
          type="button"
          variant="outline"
          className="min-h-11 border-zinc-700 bg-zinc-950/70"
          onClick={() => void copyText(sharePayload.recipeUrl, "Recipe 页面链接已复制")}
        >
          复制结果页链接
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 border-zinc-700 bg-zinc-950/70"
          onClick={() => void copyText(normalizedResultUrl || sharePayload.recipeUrl, "公开视频链接已复制")}
        >
          复制公开视频链接
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 border-zinc-700 bg-zinc-950/70"
          onClick={() => void copyText(sharePayload.text, "分享文案已复制")}
        >
          复制分享文案
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <a
            href={sharePayload.xIntent}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-950/70 px-3 text-sm text-zinc-200 transition hover:border-zinc-600 hover:text-zinc-50"
          >
            分享到 X
          </a>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 border-zinc-700 bg-zinc-950/70"
            onClick={() => void handleNativeShare()}
          >
            系统分享
          </Button>
        </div>
      </div>
    </GlassCard>
  );
}
