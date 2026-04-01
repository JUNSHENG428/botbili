"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="zh-CN" className="dark">
      <body className="bg-zinc-950 text-zinc-50">
        <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
          <p className="text-6xl font-bold text-zinc-700">⚠️</p>
          <h1 className="mt-4 text-xl font-semibold text-zinc-200">
            系统异常
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            应用遇到了严重错误，请刷新页面重试。
          </p>
          <button
            onClick={reset}
            className="mt-6 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-6 py-2.5 text-sm font-medium text-cyan-300 transition hover:bg-cyan-500/20"
          >
            刷新页面
          </button>
        </div>
      </body>
    </html>
  );
}
