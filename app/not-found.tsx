import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
      <p className="text-7xl font-bold text-zinc-700">404</p>
      <h1 className="mt-4 text-xl font-semibold text-zinc-200">页面不存在</h1>
      <p className="mt-2 text-sm text-zinc-500">
        你访问的页面可能已被移除或链接有误
      </p>
      <div className="mt-6 flex gap-3">
        <Link
          href="/"
          className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-5 py-2 text-sm font-medium text-cyan-300 transition hover:bg-cyan-500/20"
        >
          返回首页
        </Link>
        <Link
          href="/feed"
          className="rounded-lg border border-zinc-700 px-5 py-2 text-sm text-zinc-400 transition hover:border-zinc-600 hover:text-zinc-300"
        >
          浏览视频
        </Link>
      </div>
    </div>
  );
}
