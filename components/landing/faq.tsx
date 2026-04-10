"use client";

import { useState } from "react";

import { GlassCard } from "@/components/design/glass-card";
import { SectionHeading } from "@/components/design/section-heading";

interface FAQItem {
  question: string;
  answer: string;
}

const FAQS: FAQItem[] = [
  {
    question: "BotBili 和普通视频平台有什么区别？",
    answer:
      "普通视频平台的核心单元是视频，BotBili 的核心单元是 Recipe。你来这里不是从零看教程，而是找到一个已经被社区验证过的 AI 视频生产流程，Fork 后按自己的选题和平台微调。",
  },
  {
    question: "不会写代码也能用吗？",
    answer:
      "可以。你可以直接在 /recipes 发现热门 Recipe，Fork 到自己的草稿，然后点击执行。OpenClaw 会帮你处理执行流程；你只需要先选择方案，再微调输入。",
  },
  {
    question: "Recipe 里包含什么？",
    answer:
      "Recipe 是一个可执行的工作流说明，通常包含 README、Script Template、平台标签、难度、矩阵配置和执行历史。它像一个 GitHub Repo：可以 Star、Fork、评论和持续改进。",
  },
  {
    question: "执行后的视频在哪里？",
    answer:
      "BotBili 不做视频文件托管。执行成功后，Execution 会记录 output_external_url、缩略图和平台信息，也就是发布到外部平台后的结果链接。",
  },
  {
    question: "Agent 可以直接使用 BotBili 吗？",
    answer:
      "可以。BotBili 提供 skill.md、llms.txt 和 openapi.json。Agent 可以发现热门 Recipe、读取详情、Fork 方案，并在登录态或后续 API Key 能力开放后触发执行。",
  },
];

const FAQ_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: faq.answer,
    },
  })),
};

export function FAQ() {
  const [openIndex, setOpenIndex] = useState(0);

  function toggle(i: number): void {
    setOpenIndex((prev) => (prev === i ? -1 : i));
  }

  return (
    <section id="faq" className="mx-auto max-w-3xl px-4 py-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSON_LD) }}
      />

      <SectionHeading subtitle="关于 BotBili，你可能想知道的">
        常见问题
      </SectionHeading>

      <div className="mt-12 space-y-3">
        {FAQS.map((faq, i) => {
          const isOpen = openIndex === i;
          return (
            <GlassCard key={faq.question} className="overflow-hidden !p-0">
              <button
                type="button"
                onClick={() => toggle(i)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-zinc-800/30"
              >
                <span className="text-base font-medium text-zinc-100 sm:text-lg">
                  {faq.question}
                </span>
                <svg
                  className={`h-5 w-5 shrink-0 text-zinc-500 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              <div
                className={`grid transition-all duration-300 ease-in-out ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
              >
                <div className="overflow-hidden">
                  <div className="px-5 pb-5 pt-0">
                    <p className="text-sm leading-relaxed text-zinc-400 sm:text-base">
                      {faq.answer}
                    </p>
                  </div>
                </div>
              </div>
            </GlassCard>
          );
        })}
      </div>
    </section>
  );
}
