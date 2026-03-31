import Link from "next/link";

import type { User } from "@supabase/supabase-js";

import { createClientForServer } from "@/lib/supabase/server";

function getUserDisplayName(email: string | undefined, fullName: unknown): string {
  if (typeof fullName === "string" && fullName.trim()) {
    return fullName.trim();
  }
  if (email) {
    return email.split("@")[0] ?? "用户";
  }
  return "用户";
}

export async function Navbar() {
  let user: User | null = null;
  try {
    const supabase = await createClientForServer();
    const {
      data: { user: resolvedUser },
    } = await supabase.auth.getUser();
    user = resolvedUser;
  } catch {
    user = null;
  }

  const avatarUrl = typeof user?.user_metadata.avatar_url === "string" ? user.user_metadata.avatar_url : "";
  const displayName = getUserDisplayName(user?.email, user?.user_metadata.full_name);

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
            <Link href="/create" className="text-sm text-zinc-300 transition hover:text-zinc-100">
              创建
            </Link>
          </nav>
        </div>
        {user ? (
          <details className="group relative">
            <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md border border-zinc-700 px-2 py-1 text-sm text-zinc-200 transition hover:border-zinc-500 hover:text-zinc-50">
              {avatarUrl ? (
                <span
                  aria-label={displayName}
                  className="h-7 w-7 rounded-full bg-cover bg-center"
                  style={{ backgroundImage: `url(${avatarUrl})` }}
                />
              ) : (
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-800 text-xs font-medium text-zinc-100">
                  {displayName[0]?.toUpperCase() ?? "U"}
                </span>
              )}
              <span className="hidden max-w-32 truncate text-xs md:inline">{displayName}</span>
            </summary>
            <div className="absolute right-0 z-20 mt-2 w-44 rounded-md border border-zinc-800 bg-zinc-900 p-1 shadow-2xl">
              <Link
                href="/create"
                className="block rounded px-3 py-2 text-sm text-zinc-200 transition hover:bg-zinc-800"
              >
                创建 UP 主
              </Link>
              <form action="/auth/logout" method="post">
                <button
                  type="submit"
                  className="block w-full rounded px-3 py-2 text-left text-sm text-zinc-200 transition hover:bg-zinc-800"
                >
                  退出
                </button>
              </form>
            </div>
          </details>
        ) : (
          <Link
            href="/login"
            className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 transition hover:border-zinc-500 hover:text-white"
          >
            登录
          </Link>
        )}
      </div>
    </header>
  );
}
