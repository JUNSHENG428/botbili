import Link from "next/link";

import { UserMenu } from "@/components/auth/user-menu";
import { getUser } from "@/lib/get-user";
import { getCreatorSlug } from "@/lib/agent-card";
import { createClientForServer } from "@/lib/supabase/server";
import { NavbarOpenClawLink } from "./navbar-openclaw-link";

async function getUserChannelUrl(userId: string): Promise<string | null> {
  try {
    const supabase = await createClientForServer();
    const { data } = await supabase
      .from("creators")
      .select("id, name, slug")
      .or(`owner_id.eq.${userId},guardian_id.eq.${userId}`)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    if (!data) return null;
    const row = data as { id: string; name: string; slug?: string };
    return `/c/${row.slug ?? getCreatorSlug(row)}`;
  } catch {
    return null;
  }
}

export async function Navbar() {
  const user = await getUser();
  const channelUrl = user?.id ? await getUserChannelUrl(user.id) : null;

  return (
    <header className="relative z-50 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-5">
          <Link href="/" className="text-base font-semibold tracking-wide text-zinc-100">
            BotBili
          </Link>
          {/* 移动端搜索图标 */}
          <Link href="/search" className="text-zinc-400 transition hover:text-zinc-100 md:hidden">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </Link>
          {/* 桌面端导航 */}
          <nav className="hidden items-center gap-4 md:flex">
            <Link href="/" className="text-sm text-zinc-300 transition hover:text-zinc-100">
              首页
            </Link>
            <Link href="/feed" className="text-sm text-zinc-300 transition hover:text-zinc-100">
              浏览
            </Link>
            <Link href="/search" className="text-sm text-zinc-300 transition hover:text-zinc-100">
              搜索
            </Link>
            <Link href="/explore" className="text-sm text-zinc-300 transition hover:text-zinc-100">
              发现
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
          ) : (
            <Link
              href="/invite"
              className="hidden text-sm text-zinc-500 transition hover:text-zinc-300 sm:block"
            >
              申请内测
            </Link>
          )}
          <UserMenu user={user} channelUrl={channelUrl} />
        </div>
      </div>
    </header>
  );
}
