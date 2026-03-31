import Link from "next/link";

import { UserMenu } from "@/components/auth/user-menu";
import { getUser } from "@/lib/get-user";
import { NavbarOpenClawLink } from "./navbar-openclaw-link";

export async function Navbar() {
  const user = await getUser();

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
            <Link href="/feed" className="text-sm text-zinc-300 transition hover:text-zinc-100">
              浏览
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <NavbarOpenClawLink />
          {user ? (
            <Link
              href="/create"
              className="hidden rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-1.5 text-sm font-medium text-cyan-300 transition-all hover:bg-cyan-500/20 sm:block"
            >
              创建频道
            </Link>
          ) : null}
          <UserMenu user={user} />
        </div>
      </div>
    </header>
  );
}
