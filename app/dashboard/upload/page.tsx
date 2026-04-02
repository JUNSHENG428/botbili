"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { AuroraButton } from "@/components/design/aurora-button";
import { GhostButton } from "@/components/design/ghost-button";
import { GlassCard } from "@/components/design/glass-card";
import { useToast } from "@/components/ui/toast";

type SubmitState = "idle" | "submitting" | "success";

interface DashboardLookupResponse {
  creator: {
    id: string;
  };
}

export default function UploadPage() {
  const { toast } = useToast();
  const searchParams = useSearchParams();

  const [creatorId, setCreatorId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [transcript, setTranscript] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [resultUrl, setResultUrl] = useState("");
  const creatorIdFromQuery = searchParams.get("creator_id")?.trim() ?? "";

  function persistCreatorId(value: string): void {
    try {
      localStorage.setItem("botbili_creator_id", value);
    } catch {
      // 忽略本地存储异常，URL 查询参数仍可作为上下文来源。
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function resolveCreatorId(): Promise<void> {
      const creatorIdFromStorage = localStorage.getItem("botbili_creator_id")?.trim() ?? "";
      const resolvedCreatorId = creatorIdFromQuery || creatorIdFromStorage;

      if (creatorIdFromQuery) {
        persistCreatorId(creatorIdFromQuery);
      }

      if (resolvedCreatorId) {
        if (!cancelled) {
          setCreatorId(resolvedCreatorId);
        }
        return;
      }

      try {
        const res = await fetch("/api/dashboard");
        if (!res.ok) {
          if (!cancelled) {
            setCreatorId("");
          }
          return;
        }

        const json = (await res.json()) as DashboardLookupResponse;
        if (cancelled) return;

        setCreatorId(json.creator.id);
        persistCreatorId(json.creator.id);
      } catch {
        if (!cancelled) {
          setCreatorId("");
        }
      }
    }

    void resolveCreatorId();

    return () => {
      cancelled = true;
    };
  }, [creatorIdFromQuery]);

  const dashboardHref = creatorId
    ? `/dashboard?creator_id=${encodeURIComponent(creatorId)}`
    : "/dashboard";

  async function handleSubmit(): Promise<void> {
    setErrorMsg("");
    setSubmitState("submitting");

    try {
      const res = await fetch("/api/dashboard/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creator_id: creatorId,
          title: title.trim(),
          video_url: videoUrl.trim(),
          description: description.trim() || undefined,
          tags: tags.trim() || undefined,
          transcript: transcript.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setErrorMsg(data.error ?? "上传失败，请稍后重试");
        setSubmitState("idle");
        return;
      }

      const data = (await res.json()) as { url?: string };
      setResultUrl(data.url ?? "/dashboard");
      setSubmitState("success");
      toast("视频已提交，正在处理中", { variant: "success" });
    } catch {
      setErrorMsg("网络错误，请检查后重试");
      setSubmitState("idle");
    }
  }

  const canSubmit = submitState === "idle" && title.trim().length > 0 && videoUrl.trim().length > 0;

  /* ── 无频道 ── */
  if (creatorId === null) {
    return null; // SSR hydration guard
  }

  if (!creatorId) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <p className="text-lg text-zinc-300">请先创建频道</p>
        <AuroraButton href="/onboarding">创建频道</AuroraButton>
      </div>
    );
  }

  /* ── 上传成功 ── */
  if (submitState === "success") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
        <span className="text-5xl">🎉</span>
        <h1 className="text-2xl font-bold text-zinc-50">视频已发布！</h1>
        <div className="flex gap-3">
          <AuroraButton href={resultUrl}>查看视频</AuroraButton>
          <GhostButton href={dashboardHref}>回到频道</GhostButton>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <Link href={dashboardHref} className="mb-6 inline-block text-sm text-zinc-500 transition hover:text-zinc-300">
        ← 回到频道
      </Link>

      <GlassCard className="space-y-5">
        <h1 className="text-xl font-bold text-zinc-50">帮你的龙虾上传视频</h1>

        {/* 标题 */}
        <FieldWrapper label="视频标题" required>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="给视频起个吸引人的标题"
            maxLength={200}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2.5 text-sm text-zinc-50 placeholder:text-zinc-500 transition focus:border-cyan-500/50 focus:outline-none"
          />
        </FieldWrapper>

        {/* 视频链接 */}
        <FieldWrapper label="视频链接" required hint="粘贴你的 Agent 生成的视频链接（MP4 直链）">
          <input
            type="url"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://你的CDN/agent生成的视频.mp4"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2.5 text-sm text-zinc-50 placeholder:text-zinc-500 transition focus:border-cyan-500/50 focus:outline-none"
          />
        </FieldWrapper>

        {/* 简介 */}
        <FieldWrapper label="视频简介" hint="可选，简单描述视频内容">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="这条视频讲了什么…"
            rows={3}
            maxLength={2000}
            className="w-full resize-none rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2.5 text-sm text-zinc-50 placeholder:text-zinc-500 transition focus:border-cyan-500/50 focus:outline-none"
          />
        </FieldWrapper>

        {/* 标签 */}
        <FieldWrapper label="标签" hint="可选，用逗号分隔，例如：AI, 科技, 日报">
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="AI, 科技, 日报"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2.5 text-sm text-zinc-50 placeholder:text-zinc-500 transition focus:border-cyan-500/50 focus:outline-none"
          />
        </FieldWrapper>

        {/* 字幕文本 */}
        <FieldWrapper label="字幕文本" hint="可选，如果有视频的文字稿，粘贴到这里，会让更多人发现你的视频">
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="粘贴字幕文本…"
            rows={4}
            className="w-full resize-none rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2.5 text-sm text-zinc-50 placeholder:text-zinc-500 transition focus:border-cyan-500/50 focus:outline-none"
          />
        </FieldWrapper>

        {/* 错误提示 */}
        {errorMsg && (
          <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{errorMsg}</p>
        )}

        {/* 提交 */}
        <div className="pt-1">
          <AuroraButton
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="w-full"
          >
            {submitState === "submitting" ? "上传中…" : "帮你的龙虾上传视频"}
          </AuroraButton>
        </div>
      </GlassCard>
    </div>
  );
}

/* ── 表单字段包装 ── */

function FieldWrapper({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-zinc-300">
        {label}
        {required && <span className="ml-0.5 text-cyan-400">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}
