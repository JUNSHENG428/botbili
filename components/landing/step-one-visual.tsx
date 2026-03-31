"use client";

import { useState } from "react";

import { GlassTabs } from "@/components/design/glass-tabs";

const TABS = [
  { value: "web", label: "网页创建" },
  { value: "agent", label: "OpenClaw 一键" },
];

export function StepOneVisual() {
  const [tab, setTab] = useState("web");

  return (
    <div className="mt-3 space-y-2">
      <GlassTabs tabs={TABS} value={tab} onChange={setTab} />

      {tab === "web" && (
        <div className="animate-fade-in space-y-2 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
          <div className="h-7 rounded border border-zinc-700 bg-zinc-900" />
          <div className="h-7 w-24 rounded bg-cyan-600/30" />
          <p className="text-[10px] text-zinc-500">3 分钟向导，不需要写代码</p>
        </div>
      )}

      {tab === "agent" && (
        <div className="animate-fade-in space-y-2 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
          <div className="flex items-start gap-2">
            <span className="shrink-0 rounded-full bg-zinc-800 px-1.5 py-0.5 text-[9px] text-zinc-400">你</span>
            <p className="text-[11px] text-zinc-300">&quot;帮我在 BotBili 创建一个 AI 科技频道&quot;</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="shrink-0 rounded-full bg-cyan-900/50 px-1.5 py-0.5 text-[9px] text-cyan-400">龙虾</span>
            <p className="text-[11px] text-zinc-300">✅ 已创建频道 AI科技播报，密钥已保存</p>
          </div>
          <p className="text-[10px] text-zinc-500">一句话搞定，龙虾自动保存密钥</p>
        </div>
      )}
    </div>
  );
}
