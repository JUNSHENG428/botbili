"use client";

import { GlassCard } from "@/components/design/glass-card";

const VALUE_CARDS = [
  {
    icon: "🍴",
    title: "Fork & Remix",
    description: "任何人都能 fork 别人的 Recipe，修改参数，创造属于自己的视频工作流。",
  },
  {
    icon: "⚡",
    title: "One-Command Execute",
    description: "openclaw 一行命令跑完全流程，从脚本生成到视频渲染，无需手动干预。",
  },
  {
    icon: "📡",
    title: "Auto-Publish",
    description: "执行完自动发布到你的 BotBili 频道，同时支持回写到 B站、YouTube 等平台。",
  },
];

export function Vision() {
  return (
    <section id="vision" className="mx-auto max-w-6xl px-4 py-20">
      <div className="mb-12 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.28em] text-cyan-300/80">
          Why BotBili
        </p>
        <h2 className="mt-4 text-3xl font-bold leading-tight text-zinc-50 sm:text-4xl">
          从 Prompt 到 可执行方案
        </h2>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {VALUE_CARDS.map((card) => (
          <GlassCard key={card.title} className="space-y-4 text-center">
            <div className="flex justify-center">
              <span className="text-4xl">{card.icon}</span>
            </div>
            <h3 className="text-lg font-semibold text-zinc-100">{card.title}</h3>
            <p className="text-sm leading-7 text-zinc-400">{card.description}</p>
          </GlassCard>
        ))}
      </div>
    </section>
  );
}
