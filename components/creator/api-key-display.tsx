"use client";

import { useState } from "react";

export interface ApiKeyDisplayProps {
  apiKey: string;
  channelName?: string;
}

export function ApiKeyDisplay({ apiKey, channelName }: ApiKeyDisplayProps) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");

  async function handleCopy(): Promise<void> {
    setCopyError("");
    try {
      await navigator.clipboard.writeText(apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopyError("复制失败，请手动复制");
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-zinc-700 bg-zinc-900 p-4">
      <p className="text-sm font-medium text-zinc-100">
        你的 API Key
        {channelName && (
          <span className="ml-2 rounded bg-cyan-500/15 px-1.5 py-0.5 text-xs font-normal text-cyan-400">
            频道：{channelName}
          </span>
        )}
      </p>
      <div className="flex items-center gap-2">
        <code className="flex-1 overflow-auto rounded bg-zinc-950 px-3 py-2 text-xs text-zinc-100">
          {apiKey}
        </code>
        <button
          type="button"
          onClick={handleCopy}
          className="rounded border border-zinc-600 px-3 py-2 text-xs text-zinc-100 transition hover:border-zinc-400"
        >
          {copied ? "已复制" : "复制"}
        </button>
      </div>
      {copyError ? <p className="text-xs text-amber-300">{copyError}</p> : null}
      <p className="text-xs text-red-400">请立即保存此 API Key，关闭后无法再次查看！</p>
    </div>
  );
}
