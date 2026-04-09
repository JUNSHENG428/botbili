import Link from "next/link";

import { GlassCard } from "@/components/design/glass-card";

interface StoryStep {
  title: string;
  description: string;
  prompt?: string;
}

interface RecipeStoryboardProps {
  scriptTemplate: Record<string, unknown> | null;
  isAuthor?: boolean;
}

function toStepTitle(step: Record<string, unknown>, index: number): string {
  const candidates = [step.title, step.name, step.label, step.step];
  const found = candidates.find((candidate) => typeof candidate === "string" && candidate.trim());
  return found ? String(found) : `Step ${index + 1}`;
}

function toStepDescription(step: Record<string, unknown>): string {
  const candidates = [step.description, step.summary, step.notes, step.goal];
  const found = candidates.find((candidate) => typeof candidate === "string" && candidate.trim());
  return found ? String(found) : "把这一段的目标、镜头和输出要求整理成可以交给 Agent 执行的步骤。";
}

function toStepPrompt(step: Record<string, unknown>): string | undefined {
  const candidates = [step.prompt, step.script, step.template, step.command];
  const found = candidates.find((candidate) => typeof candidate === "string" && candidate.trim());
  return found ? String(found) : undefined;
}

function normalizeSteps(scriptTemplate: Record<string, unknown> | null): StoryStep[] {
  if (!scriptTemplate || typeof scriptTemplate !== "object") {
    return [];
  }

  const stepsCandidate =
    (Array.isArray(scriptTemplate.sections) ? scriptTemplate.sections : null) ??
    (Array.isArray(scriptTemplate.steps) ? scriptTemplate.steps : null) ??
    (Array.isArray(scriptTemplate.scenes) ? scriptTemplate.scenes : null);

  if (stepsCandidate) {
    return stepsCandidate
      .filter((step): step is Record<string, unknown> => Boolean(step) && typeof step === "object" && !Array.isArray(step))
      .map((step, index) => ({
        title: toStepTitle(step, index),
        description: toStepDescription(step),
        prompt: toStepPrompt(step),
      }));
  }

  return Object.entries(scriptTemplate).map(([key, value], index) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const step = value as Record<string, unknown>;
      return {
        title: typeof step.title === "string" ? step.title : key,
        description: toStepDescription(step),
        prompt: toStepPrompt(step),
      };
    }

    return {
      title: key || `Step ${index + 1}`,
      description: typeof value === "string" ? value : "这一段的配置暂时还是结构化字段。",
    };
  });
}

export function RecipeStoryboard({ scriptTemplate, isAuthor = false }: RecipeStoryboardProps) {
  const steps = normalizeSteps(scriptTemplate);

  if (steps.length === 0) {
    return (
      <GlassCard className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-zinc-100">Storyboard</h2>
          <p className="text-sm text-zinc-500">这份 Recipe 还没有拆出可视化步骤卡片。</p>
        </div>
        {isAuthor ? (
          <div className="space-y-3">
            <p className="text-sm leading-7 text-zinc-400">
              下一步可以把脚本模板整理成镜头顺序、素材来源、字幕节奏和矩阵变量，让 Fork 的人一眼看懂怎么跑。
            </p>
            <Link href="/recipes/new?edit=true" className="text-sm text-cyan-300 transition hover:text-cyan-200">
              去完善 Storyboard
            </Link>
          </div>
        ) : (
          <p className="text-sm leading-7 text-zinc-400">
            作者还没有整理分镜步骤，执行后可以在执行历史里看到实际输出。
          </p>
        )}
      </GlassCard>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-zinc-100">Storyboard</h2>
        <p className="text-sm text-zinc-500">把 JSON 方案翻译成分镜步骤，而不是直接把字段甩给新手。</p>
      </div>

      <div className="space-y-4">
        {steps.map((step, index) => (
          <GlassCard key={`${step.title}-${index}`} className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-cyan-200">
                Step {index + 1}
              </span>
              <h3 className="text-lg font-medium text-zinc-100">{step.title}</h3>
            </div>

            <p className="text-sm leading-7 text-zinc-400">{step.description}</p>

            {step.prompt ? (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">Prompt 预览</p>
                <pre className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950/80 p-4 text-xs leading-6 text-zinc-300">
                  <code>{step.prompt}</code>
                </pre>
              </div>
            ) : null}
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
