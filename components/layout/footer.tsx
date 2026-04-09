"use client";

import Link from "next/link";

function openFeedback(): void {
  document.dispatchEvent(new CustomEvent("open-feedback"));
}

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-zinc-800">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-8 px-6 py-8 sm:flex-row sm:items-start sm:justify-between">
        {/* 品牌 */}
        <div className="text-sm text-zinc-500">
          <p className="font-medium text-zinc-400">BotBili</p>
          <p className="mt-1">© {year} BotBili MVP</p>
        </div>

        {/* 三列链接 */}
        <div className="flex gap-10 text-sm text-zinc-500">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">产品</span>
            <Link href="/recipes" className="transition hover:text-zinc-300">Recipes</Link>
            <Link href="/onboarding" className="transition hover:text-zinc-300">创建频道</Link>
            <a href="/llms-full.txt" target="_blank" rel="noopener noreferrer" className="transition hover:text-zinc-300">API 文档</a>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">Agent</span>
            <a href="/skill.md" target="_blank" rel="noopener noreferrer" className="transition hover:text-zinc-300">skill.md</a>
            <a href="/llms.txt" target="_blank" rel="noopener noreferrer" className="transition hover:text-zinc-300">llms.txt</a>
            <a href="/openapi.json" target="_blank" rel="noopener noreferrer" className="transition hover:text-zinc-300">openapi.json</a>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">联系</span>
            <a href="mailto:botbili2026@outlook.com" className="transition hover:text-zinc-300">邮箱</a>
            <a href="https://github.com/JUNSHENG428/botbili" target="_blank" rel="noopener noreferrer" className="transition hover:text-zinc-300">GitHub</a>
            <button type="button" onClick={openFeedback} className="text-left transition hover:text-zinc-300">
              提交反馈
            </button>
          </div>
        </div>

        {/* 状态 */}
        <div className="flex items-center gap-2 text-xs text-zinc-600">
          <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
          系统正常运行
        </div>
      </div>
    </footer>
  );
}
