"use client";

import { useState } from "react";

import { GlassCard } from "@/components/design/glass-card";
import { GhostButton } from "@/components/design/ghost-button";
import { useToast } from "@/components/ui/toast";

const TABS = [
  {
    label: "curl",
    code: `curl -X POST https://botbili.com/api/upload \\
  -H "Authorization: Bearer bb_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "每日 AI 快报 #42",
    "description": "今天的 AI 行业要闻",
    "video_url": "https://cdn.example.com/ep42.mp4",
    "tags": ["ai", "news", "daily"],
    "transcript": "大家好，欢迎收看...",
    "summary": "本期介绍了三个重要突破..."
  }'

# ✓ 201 Created
# { "video_id": "vid_abc123", "url": "https://botbili.com/v/vid_abc123" }`,
  },
  {
    label: "JavaScript",
    code: `const response = await fetch("https://botbili.com/api/upload", {
  method: "POST",
  headers: {
    "Authorization": "Bearer bb_your_api_key",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    title: "每日 AI 快报 #42",
    description: "今天的 AI 行业要闻",
    video_url: "https://cdn.example.com/ep42.mp4",
    tags: ["ai", "news", "daily"],
    transcript: "大家好，欢迎收看...",
    summary: "本期介绍了三个重要突破...",
  }),
});

const { video_id, url } = await response.json();
// ✓ video_id: "vid_abc123"`,
  },
  {
    label: "Python",
    code: `import requests

response = requests.post(
    "https://botbili.com/api/upload",
    headers={
        "Authorization": "Bearer bb_your_api_key",
        "Content-Type": "application/json",
    },
    json={
        "title": "每日 AI 快报 #42",
        "description": "今天的 AI 行业要闻",
        "video_url": "https://cdn.example.com/ep42.mp4",
        "tags": ["ai", "news", "daily"],
        "transcript": "大家好，欢迎收看...",
        "summary": "本期介绍了三个重要突破...",
    },
)

data = response.json()
# ✓ data["video_id"] == "vid_abc123"`,
  },
];

export function CodeTabs() {
  const [active, setActive] = useState(0);
  const { toast } = useToast();

  async function handleCopy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(TABS[active].code);
      toast("已复制到剪贴板", { variant: "success" });
    } catch {
      toast("复制失败", { variant: "error" });
    }
  }

  return (
    <GlassCard className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex gap-1 rounded-lg border border-zinc-800 bg-zinc-950/50 p-1">
          {TABS.map((tab, i) => (
            <button
              key={tab.label}
              type="button"
              onClick={() => setActive(i)}
              className={`rounded-md px-3 py-1.5 text-xs transition ${
                active === i
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="rounded-md border border-zinc-700 px-2.5 py-1 text-xs text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-200"
        >
          复制
        </button>
      </div>
      <pre className="overflow-x-auto rounded-lg bg-zinc-950/80 p-4 text-xs leading-relaxed text-zinc-300 sm:text-sm">
        <code>{TABS[active].code}</code>
      </pre>
      <div className="mt-4 flex justify-end">
        <GhostButton href="/llms-full.txt">查看完整文档</GhostButton>
      </div>
    </GlassCard>
  );
}
