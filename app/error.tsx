"use client";

import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
      <p className="text-5xl font-bold text-zinc-700">出错了</p>
      <h1 className="mt-4 text-lg font-semibold text-zinc-200">
        页面加载失败
      </h1>
      <p className="mt-2 max-w-md text-sm text-zinc-500">
        发生了意外错误。你可以尝试刷新页面，或返回首页。
      </p>
      <div className="mt-6 flex gap-3">
        <button
          onClick={reset}
          className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-5 py-2 text-sm font-medium text-cyan-300 transition hover:bg-cyan-500/20"
        >
          重试
        </button>
        <a
          href="/"
          className="rounded-lg border border-zinc-700 px-5 py-2 text-sm text-zinc-400 transition hover:border-zinc-600 hover:text-zinc-300"
        >
          返回首页
        </a>
      </div>
    </div>
  );
}
