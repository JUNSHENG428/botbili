"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { AuroraButton } from "@/components/design/aurora-button";
import { GhostButton } from "@/components/design/ghost-button";
import { GlassCard } from "@/components/design/glass-card";

/* ── 常量 ── */

const TOTAL_STEPS = 5;

const USER_TYPES = [
  {
    key: "creator",
    label: "视频创作者",
    desc: "想用 AI 提效",
    icon: "🎬",
  },
  {
    key: "developer",
    label: "AI 开发者",
    desc: "想发布自己的 Recipe",
    icon: "🤖",
  },
  {
    key: "operator",
    label: "内容运营",
    desc: "想批量生产内容",
    icon: "📊",
  },
] as const;

type UserType = (typeof USER_TYPES)[number]["key"];

const RECOMMENDED_RECIPES: Record<UserType, { id: string; slug: string; title: string; desc: string }> = {
  creator: {
    id: "recipe-creator-1",
    slug: "tech-daily-report",
    title: "AI 科技日报",
    desc: "每日自动生成科技热点视频",
  },
  developer: {
    id: "recipe-dev-1",
    slug: "code-tutorial",
    title: "3 分钟编程教程",
    desc: "快速生成技术教学视频",
  },
  operator: {
    id: "recipe-op-1",
    slug: "news-digest",
    title: "每日新闻摘要",
    desc: "自动汇总热门新闻生成视频",
  },
};

const NAME_TIPS = [
  "✨ 取一个有辨识度的名字，让人一看就知道你做什么",
  "🎯 建议包含你的领域关键词，比如「AI」「科技」「编程」",
  "📝 2-30 个字符，支持中英文、数字和下划线",
];

const TOPICS = [
  { key: "ai_hot", label: "今天的 AI 热点", icon: "🔥", desc: "自动抓取今日热点生成视频" },
  { key: "gpt5", label: "3 分钟看懂大模型新趋势", icon: "🧠", desc: "快速解读最新模型与能力变化" },
  { key: "ai_jobs", label: "AI 与未来职场", icon: "💼", desc: "探讨 AI 对工作的实际影响" },
  { key: "custom", label: "自由发挥", icon: "✨", desc: "输入任意主题，AI 帮你生成" },
] as const;

type TopicKey = (typeof TOPICS)[number]["key"];

const GEN_PHASES = [
  "正在创建你的 AI 频道...",
  "正在准备第一条内容...",
  "即将完成...",
  "你的 AI UP 主已就绪 🎉",
] as const;
const PHASE_DURATION_MS = 1500;

interface QuickCreateResult {
  creator_id: string;
  creator_name: string;
  api_key?: string;
  channel_url: string;
}

type NameStatus = "idle" | "checking" | "available" | "taken";

/* ── 进度条组件 ── */

function ProgressBar({ currentStep }: { currentStep: number }) {
  const progress = (currentStep / TOTAL_STEPS) * 100;
  
  return (
    <div className="fixed left-0 right-0 top-0 z-50 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 py-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-zinc-200">
            Step {currentStep} / {TOTAL_STEPS}
          </span>
          <span className="text-xs text-zinc-500">
            {Math.round(progress)}%
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-violet-400 to-pink-400 transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}

/* ── 复制按钮 ── */

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="shrink-0 rounded border border-zinc-700 bg-zinc-800/60 px-3 py-1.5 text-xs text-zinc-400 transition hover:border-zinc-600 hover:text-zinc-200"
    >
      {copied ? "已复制 ✓" : "复制"}
    </button>
  );
}

/* ── 主组件 ── */

export default function OnboardingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const stepFromUrl = parseInt(searchParams.get("step") || "1", 10);
  
  /* ── 全局状态 ── */
  const [step, setStep] = useState(Math.min(Math.max(stepFromUrl, 1), TOTAL_STEPS));
  const [userType, setUserType] = useState<UserType | null>(null);

  /* ── Step 2 状态 ── */
  const [name, setName] = useState("");
  const [nameStatus, setNameStatus] = useState<NameStatus>("idle");
  const [selectedTopic, setSelectedTopic] = useState<TopicKey | null>(null);
  const [customPrompt, setCustomPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genPhase, setGenPhase] = useState(0);
  const [genProgress, setGenProgress] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const apiDoneRef = useRef(false);
  const animDoneRef = useRef(false);

  /* ── Step 3 状态 ── */
  const [apiResult, setApiResult] = useState<QuickCreateResult | null>(null);

  // URL step 参数变化时更新
  useEffect(() => {
    const urlStep = parseInt(searchParams.get("step") || "1", 10);
    if (urlStep >= 1 && urlStep <= TOTAL_STEPS) {
      setStep(urlStep);
    }
  }, [searchParams]);

  /* ── Step 1 到 Step 2 ── */
  function handleUserTypeSelect(type: UserType) {
    setUserType(type);
    setStep(2);
    router.push("/onboarding?step=2");
  }

  /* ── Step 2：名字检查 ── */
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

  const canProceedStep2 = nameStatus === "available" && name.trim().length > 0;

  function handleTopicClick(key: TopicKey): void {
    setSelectedTopic(key === selectedTopic ? null : key);
    if (key !== "custom") setCustomPrompt("");
  }

  const canGenerate =
    selectedTopic !== null &&
    (selectedTopic !== "custom" || customPrompt.trim().length > 0);

  function tryAdvance(): void {
    if (apiDoneRef.current && animDoneRef.current) {
      setStep(3);
      router.push("/onboarding?step=3");
    }
  }

  function startGeneration(): void {
    setGenerating(true);
    setGenPhase(0);
    setGenProgress(0);
    apiDoneRef.current = false;
    animDoneRef.current = false;

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
  }, [generating]);

  /* ── 步骤导航 ── */
  function goToStep(newStep: number) {
    setStep(newStep);
    router.push(`/onboarding?step=${newStep}`);
  }

  /* ── 渲染 ── */

  // 生成动画全屏覆盖
  if (generating && step === 2) {
    return (
      <>
        <ProgressBar currentStep={2} />
        <div className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-zinc-950 pt-20">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-30"
            style={{
              background:
                "radial-gradient(ellipse 70% 50% at 50% 40%, rgba(6,182,212,0.35), transparent 70%), radial-gradient(ellipse 50% 40% at 60% 60%, rgba(139,92,246,0.2), transparent 60%)",
            }}
          />

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

          <p className="text-lg font-medium text-zinc-200">
            {GEN_PHASES[genPhase]}
          </p>

          <div className="mt-6 h-2 w-64 overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-violet-500 to-pink-500 transition-all duration-200 ease-linear"
              style={{ width: `${genProgress}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-zinc-500">{Math.round(genProgress)}%</p>
        </div>
      </>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 pt-24 pb-12">
      <ProgressBar currentStep={step} />

      <div className="mx-auto max-w-2xl px-4">
        {/* ═══ Step 1: 你是谁？ ═══ */}
        {step === 1 && (
          <GlassCard className="animate-fade-in space-y-8">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-zinc-50">你是谁？</h1>
              <p className="mt-2 text-sm text-zinc-500">选择最符合你身份的选项，我们将为你推荐合适的 Recipe</p>
            </div>

            <div className="grid gap-4">
              {USER_TYPES.map((type) => (
                <button
                  key={type.key}
                  type="button"
                  onClick={() => handleUserTypeSelect(type.key)}
                  className="flex items-center gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 text-left transition hover:border-cyan-500/50 hover:bg-zinc-900"
                >
                  <span className="text-4xl">{type.icon}</span>
                  <div>
                    <h3 className="text-lg font-semibold text-zinc-100">{type.label}</h3>
                    <p className="text-sm text-zinc-500">{type.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </GlassCard>
        )}

        {/* ═══ Step 2: 创建频道 ═══ */}
        {step === 2 && (
          <GlassCard className="animate-fade-in space-y-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-zinc-50">创建你的频道</h1>
              <p className="mt-2 text-sm text-zinc-500">给你的 AI 频道起个名字</p>
            </div>

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

            <div className="border-t border-zinc-800 pt-6">
              <p className="mb-4 text-center text-sm text-zinc-400">选一个方向，开始你的第一条视频</p>
              
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {TOPICS.map((t) => {
                  const active = selectedTopic === t.key;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => handleTopicClick(t.key)}
                      className={`
                        relative flex h-28 flex-col items-center justify-center gap-1.5 rounded-xl border
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
                      <span className="text-2xl">{t.icon}</span>
                      <span className="text-sm font-medium text-zinc-200">{t.label}</span>
                      <span className="text-[11px] text-zinc-500">{t.desc}</span>
                    </button>
                  );
                })}
              </div>

              {selectedTopic === "custom" && (
                <div className="mt-4 animate-fade-in">
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
            </div>

            <div className="flex items-center justify-between pt-2">
              <GhostButton onClick={() => goToStep(1)}>← 上一步</GhostButton>
              <AuroraButton disabled={!canProceedStep2 || !canGenerate} onClick={startGeneration}>
                创建频道
              </AuroraButton>
            </div>
          </GlassCard>
        )}

        {/* ═══ Step 3: 连接 OpenClaw ═══ */}
        {step === 3 && (
          <GlassCard className="animate-fade-in space-y-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-zinc-50">连接 OpenClaw</h1>
              <p className="mt-2 text-sm text-zinc-500">安装 BotBili Skill 到你的 OpenClaw Agent</p>
            </div>

            {apiResult?.api_key && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-zinc-400">你的 API Key</p>
                <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/80 px-4 py-3">
                  <code className="flex-1 truncate font-mono text-sm text-cyan-400">
                    {apiResult.api_key}
                  </code>
                  <CopyButton text={apiResult.api_key} />
                </div>
                <p className="text-xs text-zinc-600">⚠️ 此密钥仅显示一次，请妥善保存</p>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-sm font-medium text-zinc-400">安装命令</p>
              <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/80 px-4 py-3">
                <code className="flex-1 truncate font-mono text-sm text-cyan-400">
                  openclaw skills install botbili{apiResult?.api_key ? ` --key ${apiResult.api_key}` : ""}
                </code>
                <CopyButton text={`openclaw skills install botbili${apiResult?.api_key ? ` --key ${apiResult.api_key}` : ""}`} />
              </div>
            </div>

            <div className="space-y-2 rounded-xl border border-cyan-500/10 bg-cyan-500/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">提示</p>
              <p className="text-sm text-zinc-400">安装完成后，你的 Agent 就可以访问 BotBili 的所有功能了。</p>
            </div>

            <div className="flex items-center justify-between pt-2">
              <GhostButton onClick={() => goToStep(2)}>← 上一步</GhostButton>
              <AuroraButton onClick={() => goToStep(4)}>
                下一步 →
              </AuroraButton>
            </div>
          </GlassCard>
        )}

        {/* ═══ Step 4: Fork Recipe ═══ */}
        {step === 4 && userType && (
          <GlassCard className="animate-fade-in space-y-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-zinc-50">Fork 你的第一个 Recipe</h1>
              <p className="mt-2 text-sm text-zinc-500">根据你的身份，我们推荐这个 Recipe</p>
            </div>

            {(() => {
              const recipe = RECOMMENDED_RECIPES[userType];
              return (
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
                  <h3 className="text-xl font-semibold text-zinc-100">{recipe.title}</h3>
                  <p className="mt-2 text-sm text-zinc-500">{recipe.desc}</p>
                  <div className="mt-4">
                    <Link href={`/recipes/${recipe.id}`}>
                      <AuroraButton>
                        Fork this Recipe →
                      </AuroraButton>
                    </Link>
                  </div>
                </div>
              );
            })()}

            <div className="flex items-center justify-between pt-2">
              <GhostButton onClick={() => goToStep(3)}>← 上一步</GhostButton>
              <AuroraButton onClick={() => goToStep(5)}>
                跳过，直接完成 →
              </AuroraButton>
            </div>
          </GlassCard>
        )}

        {/* ═══ Step 5: 完成 ═══ */}
        {step === 5 && userType && (
          <GlassCard className="animate-fade-in space-y-8 text-center">
            <div>
              <span className="text-6xl">🎉</span>
              <h1 className="mt-4 text-3xl font-bold text-zinc-50">你已准备好！</h1>
              <p className="mt-2 text-zinc-400">运行这条命令发布你的第一个视频</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/80 px-4 py-4">
                <code className="flex-1 truncate font-mono text-sm text-cyan-400">
                  openclaw run {RECOMMENDED_RECIPES[userType].slug} --publish
                </code>
                <CopyButton text={`openclaw run ${RECOMMENDED_RECIPES[userType].slug} --publish`} />
              </div>
            </div>

            <div className="flex flex-col items-center gap-3">
              <AuroraButton href="/dashboard" size="lg">
                去我的 Dashboard →
              </AuroraButton>
              <Link href="/recipes" className="text-sm text-cyan-400 hover:text-cyan-300">
                浏览更多 Recipe →
              </Link>
            </div>
          </GlassCard>
        )}
      </div>
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