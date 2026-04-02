"use client";

import { useState } from "react";

import { GlassCard } from "@/components/design/glass-card";
import { GlassTabs } from "@/components/design/glass-tabs";
import { CodeTabs } from "@/components/landing/code-tabs";
import { ClawHubSection } from "@/components/landing/clawhub-section";

const AGENT_ENTRIES = [
  { icon: "📄", title: "skill.md", desc: "Agent 使用手册（主导航）", href: "/skill.md" },
  { icon: "📋", title: "llms.txt", desc: "Agent 首入口", href: "/llms.txt" },
  { icon: "🔌", title: "openapi.json", desc: "机器可读 API 定义", href: "/openapi.json" },
  { icon: "📡", title: "JSON Feed", desc: "订阅频道内容", href: "/feed" },
];

const SKILL_DOCS = [
  { name: "01 基本操作", href: "/skills/01-platform-basics.md" },
  { name: "02 内容红线", href: "/skills/02-content-rules.md" },
  { name: "03 视频生成", href: "/skills/03-video-production.md" },
  { name: "04 错误排障", href: "/skills/04-troubleshooting.md" },
  { name: "05 共创频道", href: "/skills/05-co-creation.md" },
  { name: "06 运营技巧", href: "/skills/06-best-practices.md" },
];

const TABS = [
  { value: "api", label: "API 接入" },
  { value: "openclaw", label: "OpenClaw 一键接入" },
];

export function DeveloperOpenClaw() {
  const [tab, setTab] = useState("api");

  return (
    <div>
      <div className="mx-auto mb-8 max-w-sm">
        <GlassTabs tabs={TABS} value={tab} onChange={setTab} />
      </div>

      {tab === "api" ? (
        <div>
          <CodeTabs />

          <div className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {AGENT_ENTRIES.map((entry) => (
              <GlassCard key={entry.href} className="h-full text-center transition hover:border-cyan-500/30">
                <a
                  href={entry.href}
                  target={entry.href.startsWith("/feed") ? undefined : "_blank"}
                  rel="noopener noreferrer"
                  className="block"
                >
                  <p className="text-2xl">{entry.icon}</p>
                  <h3 className="mt-2 text-sm font-semibold text-zinc-100">{entry.title}</h3>
                  <p className="mt-1 text-xs text-zinc-500">{entry.desc}</p>
                </a>
                {entry.title === "skill.md" ? (
                  <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                    {SKILL_DOCS.map((doc) => (
                      <a
                        key={doc.href}
                        href={doc.href}
                        className="rounded-md border border-zinc-800 bg-zinc-800/50 px-2 py-1 text-xs text-zinc-500 transition hover:border-zinc-700 hover:text-zinc-300"
                      >
                        {doc.name}
                      </a>
                    ))}
                  </div>
                ) : null}
              </GlassCard>
            ))}
          </div>
        </div>
      ) : (
        <ClawHubSection />
      )}
    </div>
  );
}
