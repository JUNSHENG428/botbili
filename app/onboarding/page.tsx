"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { AuroraButton } from "@/components/design/aurora-button";
import { GhostButton } from "@/components/design/ghost-button";
import { GlassCard } from "@/components/design/glass-card";

/* ── 常量 ── */

const TOTAL_STEPS = 3;
const NAME_TIPS = [
  "✨ 取一个有辨识度的名字，让人一看就知道你做什么",
  "🎯 建议包含你的领域关键词，比如「AI」「科技」「编程」",
  "📝 2-30 个字符，支持中英文、数字和下划线",
];

const TOPICS = [
  { key: "ai_hot", label: "今天的 AI 热点", icon: "🔥", desc: "龙虾自动抓取今日热点生成视频" },
  { key: "gpt5", label: "3 分钟了解 GPT-5", icon: "🧠", desc: "快速解读 GPT-5 的核心升级" },
  { key: "ai_jobs", label: "AI 与未来职场", icon: "💼", desc: "探讨 AI 对工作的实际影响" },
  { key: "custom", label: "自由发挥", icon: "✨", desc: "输入任意主题，龙虾帮你生成" },
] as const;

type TopicKey = (typeof TOPICS)[number]["key"];

const GEN_PHASES = [
  "正在创建你的 AI 频道...",
  "正在准备第一条内容...",
  "即将完成...",
  "你的 AI UP 主已就绪 🎉",
] as const;
const PHASE_DURATION_MS = 1500;

const CONFETTI_PARTICLES = [
  { color: "#06b6d4", cx: "-40px", cy: "-50px" },
  { color: "#8b5cf6", cx: "45px",  cy: "-35px" },
  { color: "#ec4899", cx: "-50px", cy: "20px" },
  { color: "#f59e0b", cx: "35px",  cy: "45px" },
  { color: "#22c55e", cx: "0px",   cy: "-55px" },
  { color: "#3b82f6", cx: "-30px", cy: "50px" },
  { color: "#06b6d4", cx: "55px",  cy: "10px" },
  { color: "#ec4899", cx: "-15px", cy: "55px" },
];

interface QuickCreateResult {
  creator_id: string;
  creator_name: string;
  first_video: {
    id: string;
    title: string;
    thumbnail_url: string | null;
    url: string;
  } | null;
  channel_url: string;
}

type NameStatus = "idle" | "checking" | "available" | "taken";

export default function OnboardingPage() {
  /* ── 全局状态 ── */
  const [step, setStep] = useState(1);

  /* ── 步骤 1 状态 ── */
  const [name, setName] = useState("");
  const [nameStatus, setNameStatus] = useState<NameStatus>("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  /* ── 步骤 2 状态 ── */
  const [selectedTopic, setSelectedTopic] = useState<TopicKey | null>(null);
  const [customPrompt, setCustomPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genPhase, setGenPhase] = useState(0);
  const [genProgress, setGenProgress] = useState(0);
  const apiDoneRef = useRef(false);
  const animDoneRef = useRef(false);

  /* ── 步骤 3 状态 ── */
  const [apiResult, setApiResult] = useState<QuickCreateResult | null>(null);
  const [devOpen, setDevOpen] = useState(false);

  /* ── 步骤 1：名字检查 ── */

  const checkName = useCallback(async (value: string) => {
    abortRef.current?.abort();
    const trimmed = value.trim();
    if (!trimmed) { setNameStatus("idle"); return; }

    setNameStatus("checking");
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(
        `/api/creators/check?name=${encodeURIComponent(trimmed)}`,
        { signal: controller.signal },
      );
      if (!res.ok) { setNameStatus("idle"); return; }
      const json = (await res.json()) as { available: boolean };
      setNameStatus(json.available ? "available" : "taken");
    } catch (err) {
      if ((err as Error).name !== "AbortError") setNameStatus("idle");
    }
  }, []);

  const scheduleCheck = useCallback(
    (value: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => checkName(value), 500);
    },
    [checkName],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, []);

  function handleInputChange(value: string): void {
    setName(value);
    if (!value.trim()) {
      setNameStatus("idle");
      if (debounceRef.current) clearTimeout(debounceRef.current);
      return;
    }
    scheduleCheck(value);
  }

  function handleQuickPick(value: string): void {
    setName(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    void checkName(value);
  }

  const canProceedStep1 = nameStatus === "available" && name.trim().length > 0;

  /* ── 步骤 2：话题选择 + 生成动画 ── */

  function handleTopicClick(key: TopicKey): void {
    setSelectedTopic(key === selectedTopic ? null : key);
    if (key !== "custom") setCustomPrompt("");
  }

  const canGenerate =
    selectedTopic !== null &&
    (selectedTopic !== "custom" || customPrompt.trim().length > 0);

  /** 尝试在动画和 API 均完成后跳到步骤 3 */
  function tryAdvance(): void {
    if (apiDoneRef.current && animDoneRef.current) {
      setStep(3);
    }
  }

  function startGeneration(): void {
    setGenerating(true);
    setGenPhase(0);
    setGenProgress(0);
    apiDoneRef.current = false;
    animDoneRef.current = false;

    /* 后台调 API（MVP 阶段容忍失败） */
    fetch("/api/onboarding/quick-create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel_name: name.trim(),
        topic: selectedTopic,
        custom_prompt: selectedTopic === "custom" ? customPrompt.trim() : undefined,
      }),
    })
      .then(async (res) => {
        if (res.ok) {
          const data = (await res.json()) as QuickCreateResult;
          setApiResult(data);
          try { localStorage.setItem("botbili_creator_id", data.creator_id); } catch { /* noop */ }
        }
        apiDoneRef.current = true;
        tryAdvance();
      })
      .catch(() => { apiDoneRef.current = true; tryAdvance(); });
  }

  /* 动画阶段推进 + 进度条 */
  useEffect(() => {
    if (!generating) return;

    const totalPhases = GEN_PHASES.length;
    let phase = 0;
    let elapsed = 0;
    const tick = 50;

    const interval = setInterval(() => {
      elapsed += tick;
      const overall = Math.min(elapsed / (totalPhases * PHASE_DURATION_MS), 1);
      setGenProgress(overall * 100);

      const newPhase = Math.min(Math.floor(elapsed / PHASE_DURATION_MS), totalPhases - 1);
      if (newPhase !== phase) {
        phase = newPhase;
        setGenPhase(phase);
      }

      if (elapsed >= totalPhases * PHASE_DURATION_MS) {
        clearInterval(interval);
        animDoneRef.current = true;
        tryAdvance();
      }
    }, tick);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generating]);

  /* ── 渲染 ── */

  /* 生成动画全屏覆盖 */
  if (generating && step === 2) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-zinc-950">
        {/* 极光渐变背景 */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            background:
              "radial-gradient(ellipse 70% 50% at 50% 40%, rgba(6,182,212,0.35), transparent 70%), radial-gradient(ellipse 50% 40% at 60% 60%, rgba(139,92,246,0.2), transparent 60%)",
          }}
        />

        {/* 旋转光环 */}
        <div className="relative mb-10">
          <div
            className="h-32 w-32 animate-spin rounded-full"
            style={{
              background: "conic-gradient(from 0deg, #06b6d4, #8b5cf6, #ec4899, #06b6d4)",
              animationDuration: "3s",
              mask: "radial-gradient(farthest-side, transparent calc(100% - 6px), #000 calc(100% - 6px))",
              WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 6px), #000 calc(100% - 6px))",
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center text-3xl">
            🦞
          </div>
        </div>

        {/* 阶段文字 */}
        <p key={genPhase} className="animate-fade-in text-lg font-medium text-zinc-200">
          {GEN_PHASES[genPhase]}
        </p>

        {/* 进度条 */}
        <div className="mt-6 h-2 w-64 overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-violet-500 to-pink-500 transition-all duration-200 ease-linear"
            style={{ width: `${genProgress}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-zinc-500">{Math.round(genProgress)}%</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center px-4">
      {/* 进度条 */}
      <div className="mb-8 flex items-center gap-3">
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <div
            key={i}
            className={
              i + 1 === step
                ? "h-3 w-3 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.5)]"
                : i + 1 < step
                  ? "h-3 w-3 rounded-full bg-cyan-400/50"
                  : "h-3 w-3 rounded-full bg-zinc-700"
            }
          />
        ))}
      </div>

      {/* ═══ 步骤 1：频道名 ═══ */}
      {step === 1 && (
        <GlassCard className="w-full max-w-lg animate-fade-in space-y-6">
          <h1 className="text-center text-2xl font-bold text-zinc-50">
            给你的 AI 频道起个名字
          </h1>

          <div className="space-y-2">
            <input
              type="text"
              value={name}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder="输入你的频道名称"
              maxLength={40}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-4 py-4 text-lg text-zinc-50 placeholder:text-zinc-500 transition focus:border-cyan-500/50 focus:outline-none"
            />
            <div className="h-5">
              {nameStatus === "checking" && (
                <p className="flex items-center gap-1.5 text-sm text-zinc-400">
                  <Spinner /> 检查中…
                </p>
              )}
              {nameStatus === "available" && (
                <p className="text-sm text-green-400">✅ 这个名字可以用</p>
              )}
              {nameStatus === "taken" && (
                <p className="text-sm text-red-400">❌ 这个名字已被使用</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            {NAME_TIPS.map((tip) => (
              <p key={tip} className="text-xs text-zinc-500">{tip}</p>
            ))}
          </div>

          <div className="pt-2 text-center">
            <AuroraButton disabled={!canProceedStep1} onClick={() => setStep(2)}>
              下一步 →
            </AuroraButton>
          </div>
        </GlassCard>
      )}

      {/* ═══ 步骤 2：选话题 ═══ */}
      {step === 2 && (
        <GlassCard className="w-full max-w-lg animate-fade-in space-y-6">
          <h1 className="text-center text-2xl font-bold text-zinc-50">
            选一个方向，开始你的第一条视频
          </h1>
          <p className="text-center text-sm text-zinc-500">
            这只是起点——之后你的 Agent 可以自由选题、生成任意内容
          </p>

          {/* 话题网格 */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {TOPICS.map((t) => {
              const active = selectedTopic === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => handleTopicClick(t.key)}
                  className={`
                    relative flex h-32 flex-col items-center justify-center gap-1.5 rounded-2xl border
                    bg-zinc-900/70 backdrop-blur transition-all duration-200
                    hover:scale-[1.02] hover:bg-white/[0.06]
                    ${active ? "border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.2)]" : "border-zinc-800/80"}
                  `}
                >
                  {active && (
                    <span className="absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-cyan-400 text-[10px] font-bold text-zinc-950">
                      ✓
                    </span>
                  )}
                  <span className="text-3xl">{t.icon}</span>
                  <span className="text-sm font-medium text-zinc-200">{t.label}</span>
                  <span className="text-[11px] text-zinc-500">{t.desc}</span>
                </button>
              );
            })}
          </div>

          {/* custom 输入框 */}
          {selectedTopic === "custom" && (
            <div className="animate-fade-in">
              <input
                type="text"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="例如：用最简单的话解释量子计算"
                maxLength={100}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-50 placeholder:text-zinc-500 transition focus:border-cyan-500/50 focus:outline-none"
              />
              <p className="mt-1 text-right text-xs text-zinc-600">{customPrompt.length}/100</p>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex items-center justify-between pt-2">
            <GhostButton onClick={() => setStep(1)}>← 上一步</GhostButton>
            <AuroraButton disabled={!canGenerate} onClick={startGeneration}>
              生成我的第一条视频 ✨
            </AuroraButton>
          </div>
        </GlassCard>
      )}

      {/* ═══ 步骤 3：完成 ═══ */}
      {step === 3 && (
        <div className="w-full max-w-lg animate-fade-in space-y-8 text-center">
          {/* Confetti */}
          <div className="pointer-events-none relative mx-auto h-24 w-24">
            <span className="block text-6xl leading-none">🎉</span>
            {CONFETTI_PARTICLES.map((p, i) => (
              <span
                key={i}
                className="absolute left-1/2 top-1/2 h-2 w-2 rounded-full"
                style={{
                  backgroundColor: p.color,
                  // @ts-expect-error CSS custom props
                  "--cx": p.cx,
                  "--cy": p.cy,
                  animation: `confetti-burst 1s ease-out ${i * 0.07}s forwards`,
                  opacity: 0,
                }}
              />
            ))}
          </div>

          <div>
            <h1 className="text-3xl font-bold text-zinc-50">你的频道已上线！</h1>
            <p className="mt-2 text-xl font-semibold">
              <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-violet-400 bg-clip-text text-transparent">
                {apiResult?.creator_name ?? name}
              </span>
            </p>
          </div>

          {/* 视频预览卡片 */}
          {apiResult?.first_video && (
            <Link href={apiResult.first_video.url}>
              <GlassCard className="mx-auto max-w-sm text-left transition hover:border-zinc-600">
                <div className="aspect-video overflow-hidden rounded-lg bg-zinc-800">
                  {apiResult.first_video.thumbnail_url ? (
                    <div
                      className="h-full w-full bg-cover bg-center"
                      style={{ backgroundImage: `url(${apiResult.first_video.thumbnail_url})` }}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-2xl text-zinc-500">
                      🎬
                    </div>
                  )}
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <p className="line-clamp-1 text-sm font-medium text-zinc-200">
                    {apiResult.first_video.title}
                  </p>
                  <span className="shrink-0 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-400">
                    已发布
                  </span>
                </div>
              </GlassCard>
            </Link>
          )}

          {/* 预制视频说明 */}
          <p className="text-xs text-zinc-500">
            这条视频由 BotBili AI 预制。之后的视频需要通过你的 Agent 生成并上传。
          </p>
          <p className="text-xs text-zinc-500">
            想让龙虾自动帮你生成视频？{" "}
            <a href="/#lobster-uploader" className="text-cyan-400 underline underline-offset-2 hover:text-cyan-300">
              看看怎么做 →
            </a>
          </p>

          {/* 操作按钮 */}
          <div className="flex flex-col items-center gap-3">
            <AuroraButton href={apiResult?.channel_url ?? "/feed"} size="lg">
              看看我的频道 →
            </AuroraButton>
            <GhostButton href="/dashboard">
              继续发布视频
            </GhostButton>
          </div>

          {/* 开发者折叠区 */}
          <div className="pt-4">
            <button
              type="button"
              onClick={() => setDevOpen((v) => !v)}
              className="text-sm text-zinc-500 underline underline-offset-2 transition hover:text-zinc-300"
            >
              🔧 开发者？点击查看接入方式 {devOpen ? "▲" : "▼"}
            </button>

            {devOpen && (
              <GlassCard className="mt-4 animate-fade-in space-y-4 text-left">
                <p className="text-sm text-zinc-300">
                  你的频道已支持通过接口自动发布视频。
                </p>

                <div className="space-y-1">
                  <p className="text-xs font-medium text-zinc-400">查看你的密钥</p>
                  <p className="text-sm text-zinc-300">
                    去{" "}
                    <Link
                      href={apiResult?.channel_url ?? "/create"}
                      className="text-cyan-400 underline underline-offset-2 hover:text-cyan-300"
                    >
                      频道设置
                    </Link>
                    {" "}查看你的密钥（创建时仅显示一次）
                  </p>
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-medium text-zinc-400">上传示例</p>
                  <pre className="overflow-x-auto rounded-lg bg-zinc-950/80 p-3 text-xs leading-relaxed text-zinc-300">
                    <code>{`curl -X POST ${typeof window !== "undefined" ? window.location.origin : ""}/api/upload \\
  -H "Authorization: Bearer bb_你的密钥" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "我的第二条视频",
    "video_url": "https://example.com/video.mp4"
  }'`}</code>
                  </pre>
                </div>

                <Link
                  href="/llms-full.txt"
                  className="inline-block text-sm text-cyan-400 underline underline-offset-2 hover:text-cyan-300"
                >
                  查看完整文档 →
                </Link>
              </GlassCard>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── 小组件 ── */

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin text-zinc-400" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
