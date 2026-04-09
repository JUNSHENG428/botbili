"use client";

import { useState } from "react";

import { GlassCard } from "@/components/design/glass-card";
import { GhostButton } from "@/components/design/ghost-button";
import { useToast } from "@/components/ui/toast";

const TABS = [
  {
    label: "curl",
    code: `curl "https://botbili.com/api/recipes?sort=trending&limit=5"

# ✓ 200 OK
# { "success": true, "data": { "recipes": [...] } }

curl -X POST "https://botbili.com/api/recipes/recipe_123/execute" \\
  -H "Origin: https://botbili.com" \\
  -H "Cookie: your-session-cookie"

# ✓ 200 OK
# { "success": true, "data": { "execution_id": "exe_123", "command_preview": "openclaw run recipe:daily-ai-brief" } }`,
  },
  {
    label: "JavaScript",
    code: `const listRes = await fetch("https://botbili.com/api/recipes?sort=trending&platforms=bilibili");
const listJson = await listRes.json();

const topRecipe = listJson.data.recipes[0];
const executeRes = await fetch(\`https://botbili.com/api/recipes/\${topRecipe.id}/execute\`, {
  method: "POST",
  credentials: "include",
  headers: { Origin: "https://botbili.com" },
});

const executeJson = await executeRes.json();
console.log(executeJson.data.command_preview);
// => openclaw run recipe:daily-ai-brief`,
  },
  {
    label: "Python",
    code: `import requests

recipes = requests.get(
    "https://botbili.com/api/recipes",
    params={"sort": "trending", "limit": 3},
).json()

for recipe in recipes["data"]["recipes"]:
    print(recipe["title"], recipe["star_count"], recipe["fork_count"])

# 登录态下再执行：
# requests.post("https://botbili.com/api/recipes/{id}/execute", cookies=...)`,
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
