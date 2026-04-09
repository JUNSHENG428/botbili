"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { AuroraButton } from "@/components/design/aurora-button";
import { GlassCard } from "@/components/design/glass-card";
import { GlassTabs } from "@/components/design/glass-tabs";
import { SectionHeading } from "@/components/design/section-heading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";

type CreationMode = "template" | "scratch";
type Difficulty = "beginner" | "intermediate" | "advanced";
type Visibility = "public" | "unlisted" | "private";

interface RecipeFormState {
  title: string;
  description: string;
  difficulty: Difficulty;
  platforms: string[];
  visibility: Visibility;
}

interface RecipeTemplate {
  id: string;
  title: string;
  description: string;
  difficulty: Difficulty;
  platforms: string[];
  visibility: Visibility;
  readme_json: string;
  script_template: {
    steps: Array<{
      title: string;
      description: string;
      prompt: string;
    }>;
  };
  matrix_config: Record<string, unknown> | null;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

const DIFFICULTY_OPTIONS: Array<{ value: Difficulty; label: string }> = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

const PLATFORM_OPTIONS = [
  { value: "bilibili", label: "Bilibili" },
  { value: "douyin", label: "抖音" },
  { value: "wechat", label: "视频号" },
  { value: "youtube", label: "YouTube" },
] as const;

const VISIBILITY_OPTIONS: Array<{ value: Visibility; label: string }> = [
  { value: "public", label: "公开" },
  { value: "unlisted", label: "仅链接可见" },
  { value: "private", label: "私有草稿" },
];

const RECIPE_TEMPLATES: RecipeTemplate[] = [
  {
    id: "daily-ai-news",
    title: "科技日报",
    description: "每日 AI 新闻解说，把当天最值得关注的模型、产品和融资消息压缩成一条高密度视频。",
    difficulty: "beginner",
    platforms: ["bilibili", "wechat"],
    visibility: "public",
    readme_json: `# 科技日报

## 解决什么问题
- 每天稳定更新 AI 行业热点
- 适合做频道冷启动和持续日更

## 适合谁
- 想做 AI 资讯号的新手
- 需要稳定日更节奏的内容团队

## 输入
- 当日热点清单
- 一句主观点

## 输出
- 60-90 秒热点速读视频
- 可复用的标题、封面、摘要`,
    script_template: {
      steps: [
        {
          title: "收集热点",
          description: "挑 3-5 条最值得讲的 AI 新闻。",
          prompt: "从今天的 AI 新闻中挑出 3-5 条最值得讲的事件，并按重要性排序。",
        },
        {
          title: "压缩成脚本",
          description: "把新闻改写成 60-90 秒口播。",
          prompt: "用口语化中文写一段 60-90 秒的视频脚本，开头 3 秒必须抓人。",
        },
      ],
    },
    matrix_config: null,
  },
  {
    id: "tool-review",
    title: "产品评测",
    description: "围绕同一主题横评多款工具，把功能差异、优缺点和适用人群一次讲清楚。",
    difficulty: "intermediate",
    platforms: ["bilibili", "youtube"],
    visibility: "public",
    readme_json: `# 产品评测

## 解决什么问题
- 帮观众快速比较多款工具
- 形成可持续更新的横评栏目

## 输入
- 评测维度
- 待比较工具列表

## 输出
- 90-180 秒横评视频
- 适合转成图文/短视频多平台分发`,
    script_template: {
      steps: [
        {
          title: "建立评测维度",
          description: "先定义横评标准，避免脚本发散。",
          prompt: "给出 4 个最适合比较这类工具的维度，并解释为什么。",
        },
        {
          title: "输出结论脚本",
          description: "直接给出推荐结论和适用人群。",
          prompt: "生成一段清晰的横评解说脚本，结尾要给出谁最适合新手、谁最适合进阶用户。",
        },
      ],
    },
    matrix_config: null,
  },
  {
    id: "concept-explainer",
    title: "概念科普",
    description: "把一个复杂概念压缩成 30 秒知识卡片，适合冷启动和社交传播。",
    difficulty: "beginner",
    platforms: ["douyin", "wechat", "youtube"],
    visibility: "public",
    readme_json: `# 概念科普

## 解决什么问题
- 用最短时间解释一个复杂概念
- 提高完播率和收藏率

## 输入
- 一个概念
- 目标观众水平

## 输出
- 30-45 秒知识卡片视频`,
    script_template: {
      steps: [
        {
          title: "概念拆解",
          description: "先找一句非专业表达。",
          prompt: "用初中生也能听懂的话解释这个概念，长度不超过 60 字。",
        },
        {
          title: "生成三段式口播",
          description: "问题、解释、例子。",
          prompt: "把内容拆成问题、核心解释、生活类比三个镜头脚本。",
        },
      ],
    },
    matrix_config: null,
  },
  {
    id: "matrix-account",
    title: "矩阵账号",
    description: "同一个主题拆成多变量、多平台、多账号批量生产，适合内容矩阵和规模化测试。",
    difficulty: "advanced",
    platforms: ["bilibili", "douyin", "wechat", "youtube"],
    visibility: "unlisted",
    readme_json: `# 矩阵账号

## 解决什么问题
- 把一个主题同时发往多个平台和账号
- 统一脚本骨架，变量化标题、封面、开头和 CTA

## 输入
- 母主题
- 平台差异化策略
- 账号人设变量

## 输出
- 多平台、多版本的批量视频方案`,
    script_template: {
      steps: [
        {
          title: "定义变量",
          description: "先写清平台、人设、长度等变量。",
          prompt: "把这个视频生产流程抽象成变量：平台、时长、语气、开头钩子、CTA。",
        },
        {
          title: "批量生成脚本",
          description: "为每个平台输出一版可直接执行的脚本。",
          prompt: "基于变量，为 Bilibili、抖音、视频号分别生成一版脚本，并说明差异。",
        },
      ],
    },
    matrix_config: {
      variables: ["platform", "hook_style", "persona"],
      supports_batch: true,
    },
  },
];

const INITIAL_TEMPLATE = RECIPE_TEMPLATES[0];

function getDifficultyBadgeClassName(difficulty: Difficulty): string {
  switch (difficulty) {
    case "beginner":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
    case "intermediate":
      return "border-cyan-500/30 bg-cyan-500/10 text-cyan-300";
    case "advanced":
      return "border-violet-500/30 bg-violet-500/10 text-violet-300";
    default:
      return "border-zinc-700 bg-zinc-900 text-zinc-300";
  }
}

function createFormFromTemplate(template: RecipeTemplate): RecipeFormState {
  return {
    title: template.title,
    description: template.description,
    difficulty: template.difficulty,
    platforms: template.platforms,
    visibility: template.visibility,
  };
}

export default function NewRecipePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [mode, setMode] = useState<CreationMode>("template");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(INITIAL_TEMPLATE.id);
  const [form, setForm] = useState<RecipeFormState>(() => createFormFromTemplate(INITIAL_TEMPLATE));
  const [submitting, setSubmitting] = useState(false);

  const selectedTemplate = useMemo(
    () => RECIPE_TEMPLATES.find((template) => template.id === selectedTemplateId) ?? INITIAL_TEMPLATE,
    [selectedTemplateId],
  );

  useEffect(() => {
    const presetTitle = searchParams.get("title")?.trim();
    if (!presetTitle) {
      return;
    }

    setMode("scratch");
    setForm((current) => ({
      ...current,
      title: current.title.trim() ? current.title : presetTitle,
    }));
  }, [searchParams]);

  function applyTemplate(template: RecipeTemplate) {
    setMode("template");
    setSelectedTemplateId(template.id);
    setForm(createFormFromTemplate(template));
  }

  function togglePlatform(platform: string) {
    setForm((current) => ({
      ...current,
      platforms: current.platforms.includes(platform)
        ? current.platforms.filter((item) => item !== platform)
        : [...current.platforms, platform],
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const title = form.title.trim();
    if (!title) {
      toast("请先填写 Recipe 标题", { variant: "warning" });
      return;
    }

    setSubmitting(true);

    try {
      const createResponse = await fetch("/api/recipes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          description: form.description.trim() || undefined,
          visibility: form.visibility,
        }),
      });

      const createPayload = (await createResponse.json()) as ApiResponse<{ recipe: { id: string } }>;

      if (!createResponse.ok || !createPayload.success || !createPayload.data?.recipe?.id) {
        throw new Error(createPayload.error?.message ?? "创建 Recipe 失败");
      }

      const recipeId = createPayload.data.recipe.id;
      const patchBody: Record<string, unknown> = {
        description: form.description.trim() || null,
        difficulty: form.difficulty,
        platforms: form.platforms,
        visibility: form.visibility,
      };

      if (mode === "template" && selectedTemplate) {
        patchBody.readme_json = selectedTemplate.readme_json;
        patchBody.script_template = selectedTemplate.script_template;
        patchBody.matrix_config = selectedTemplate.matrix_config;
      }

      const patchResponse = await fetch(`/api/recipes/${recipeId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(patchBody),
      });

      const patchPayload = (await patchResponse.json()) as ApiResponse<{ recipe: { id: string } }>;

      if (!patchResponse.ok || !patchPayload.success) {
        throw new Error(patchPayload.error?.message ?? "Recipe 已创建，但补充模板信息失败");
      }

      toast("Recipe 已创建！去完善 Script Template 和 README", { variant: "success" });
      router.push(`/recipes/${recipeId}`);
    } catch (error) {
      toast(error instanceof Error ? error.message : "创建 Recipe 失败", { variant: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="space-y-8">
        <section className="space-y-5">
          <SectionHeading
            className="text-left"
            subtitle="把你的 AI 视频工作流整理成可复用的 Repo。可以从现成模板开始，也可以从零搭一个属于自己的 Recipe。"
          >
            创建 Recipe
          </SectionHeading>

          <div className="rounded-3xl border border-zinc-800/80 bg-gradient-to-br from-zinc-900 via-zinc-950 to-zinc-900 p-6">
            <div className="max-w-3xl space-y-3">
              <p className="text-sm leading-7 text-zinc-400">
                BotBili 是 GitHub for AI Video Recipes。Recipe 不是一条视频，而是一套可执行、可 Fork、可共创的视频生产方案。
              </p>
              <div className="flex flex-wrap gap-2 text-xs text-zinc-500">
                <span>没灵感：先用模板起步</span>
                <span>不会剪辑：让 OpenClaw 执行</span>
                <span>不会做矩阵：把变量先写进 Recipe</span>
              </div>
            </div>
          </div>
        </section>

        <GlassTabs
          tabs={[
            { value: "template", label: "从模板创建（推荐）" },
            { value: "scratch", label: "从头创建" },
          ]}
          value={mode}
          onChange={(value) => setMode(value as CreationMode)}
          className="max-w-md"
        />

        {mode === "template" ? (
          <section className="grid gap-4 lg:grid-cols-2">
            {RECIPE_TEMPLATES.map((template) => {
              const active = selectedTemplateId === template.id;

              return (
                <GlassCard
                  key={template.id}
                  className={`space-y-4 transition ${
                    active ? "border-cyan-500/40 bg-cyan-500/5" : "hover:border-zinc-700"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold text-zinc-100">{template.title}</h2>
                      <p className="mt-2 text-sm leading-6 text-zinc-400">{template.description}</p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full border px-2.5 py-1 text-xs ${getDifficultyBadgeClassName(
                        template.difficulty,
                      )}`}
                    >
                      {DIFFICULTY_OPTIONS.find((item) => item.value === template.difficulty)?.label}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {template.platforms.map((platform) => (
                      <span
                        key={platform}
                        className="rounded-full border border-zinc-700 bg-zinc-950/60 px-3 py-1 text-xs text-zinc-300"
                      >
                        {PLATFORM_OPTIONS.find((item) => item.value === platform)?.label ?? platform}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-2">
                    <p className="text-xs text-zinc-500">
                      {active ? "已填充到右侧创建表单" : "点击后会预填标题、描述、难度和平台"}
                    </p>
                    <Button
                      type="button"
                      variant={active ? "secondary" : "outline"}
                      className="border-zinc-700 bg-zinc-950/60"
                      onClick={() => applyTemplate(template)}
                    >
                      使用此模板
                    </Button>
                  </div>
                </GlassCard>
              );
            })}
          </section>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <GlassCard className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-zinc-100">
                {mode === "template" ? "基于模板创建 Recipe" : "从零创建 Recipe"}
              </h2>
              <p className="text-sm leading-6 text-zinc-500">
                创建完成后会先进入详情页，你可以继续补充 README、Script Template 和 Matrix 配置。
              </p>
            </div>

            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300" htmlFor="recipe-title">
                  标题
                </label>
                <Input
                  id="recipe-title"
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  placeholder="例如：每日 AI 新闻速递"
                  className="border-zinc-800 bg-zinc-950/70 text-zinc-100 placeholder:text-zinc-500"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300" htmlFor="recipe-description">
                  描述
                </label>
                <Textarea
                  id="recipe-description"
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  placeholder="用一句话说明这个 Recipe 解决什么问题，适合谁来 Fork。"
                  className="min-h-28 border-zinc-800 bg-zinc-950/70 text-zinc-100 placeholder:text-zinc-500"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm">
                  <span className="font-medium text-zinc-300">难度</span>
                  <select
                    value={form.difficulty}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        difficulty: event.target.value as Difficulty,
                      }))
                    }
                    className="h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950/80 px-3 text-zinc-100 outline-none transition focus:border-cyan-500/40"
                  >
                    {DIFFICULTY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2 text-sm">
                  <span className="font-medium text-zinc-300">可见性</span>
                  <select
                    value={form.visibility}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        visibility: event.target.value as Visibility,
                      }))
                    }
                    className="h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950/80 px-3 text-zinc-100 outline-none transition focus:border-cyan-500/40"
                  >
                    {VISIBILITY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-zinc-300">发布平台</p>
                  <p className="text-xs text-zinc-500">多选后，后续就可以按平台做变量和矩阵扩展。</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {PLATFORM_OPTIONS.map((platform) => {
                    const active = form.platforms.includes(platform.value);
                    return (
                      <button
                        key={platform.value}
                        type="button"
                        onClick={() => togglePlatform(platform.value)}
                        className={`rounded-full border px-3 py-1.5 text-sm transition ${
                          active
                            ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-200"
                            : "border-zinc-800 bg-zinc-950/70 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                        }`}
                      >
                        {platform.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <AuroraButton type="submit" size="lg" disabled={submitting}>
                  {submitting ? "创建中…" : "创建 Recipe"}
                </AuroraButton>
                <Button
                  type="button"
                  variant="outline"
                  className="border-zinc-700 bg-zinc-950/70"
                  onClick={() => router.push("/recipes")}
                >
                  先去逛广场
                </Button>
              </div>
            </form>
          </GlassCard>

          <GlassCard className="space-y-4">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.24em] text-cyan-300/80">创建提示</p>
              <h3 className="text-lg font-semibold text-zinc-100">写一个别人愿意 Fork 的 Recipe</h3>
            </div>

            <div className="space-y-3 text-sm leading-6 text-zinc-400">
              <p>标题先说结果，不要说过程。比如“30 秒讲清楚一个概念”，而不是“我的视频脚本流程”。</p>
              <p>描述尽量回答 3 个问题：解决什么问题、适合谁、执行后会产出什么。</p>
              <p>平台越清晰，后面越容易扩成矩阵版本；先把最核心的平台写进来。</p>
            </div>

            {mode === "template" ? (
              <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4 text-sm text-zinc-300">
                <p className="font-medium text-violet-300">当前模板</p>
                <p className="mt-2">{selectedTemplate.title}</p>
                <p className="mt-2 text-zinc-500">
                  创建后会自动带上一个基础 README 和 Script Template，方便你继续完善。
                </p>
              </div>
            ) : null}
          </GlassCard>
        </section>
      </div>
    </main>
  );
}
