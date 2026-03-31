import Link from "next/link";

export function Navbar() {
  return (
    <header className="border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-5">
          <Link href="/" className="text-base font-semibold tracking-wide text-zinc-100">
            BotBili
          </Link>
          <nav className="hidden items-center gap-4 md:flex">
            <Link href="/" className="text-sm text-zinc-300 transition hover:text-zinc-100">
              首页
            </Link>
            <Link href="/create" className="text-sm text-zinc-300 transition hover:text-zinc-100">
              创建
            </Link>
          </nav>
        </div>
        <Link
          href="/create"
          className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 transition hover:border-zinc-500 hover:text-white"
        >
          成为 UP 主
        </Link>
      </div>
    </header>
  );
}
