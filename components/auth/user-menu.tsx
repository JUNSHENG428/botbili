"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/client";

interface UserMenuProps {
  user: User | null;
}

export function UserMenu({ user }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut(): Promise<void> {
    await supabase.auth.signOut();
    setOpen(false);
    router.refresh();
    router.push("/");
  }

  if (!user) {
    return (
      <Link
        href="/login"
        className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-1.5 text-sm font-medium text-cyan-300 transition-all hover:bg-cyan-500/20"
      >
        登录
      </Link>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="h-8 w-8 overflow-hidden rounded-full border border-zinc-700 transition hover:border-zinc-500"
      >
        {typeof user.user_metadata?.avatar_url === "string" ? (
          <span
            className="block h-full w-full bg-cover bg-center"
            style={{ backgroundImage: `url(${user.user_metadata.avatar_url})` }}
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center bg-zinc-800 text-xs text-zinc-400">
            {user.email?.[0]?.toUpperCase() || "U"}
          </span>
        )}
      </button>

      {open ? (
        <>
          <button type="button" className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-label="关闭菜单" />
          <div className="absolute right-0 top-10 z-50 w-48 rounded-xl border border-zinc-700 bg-zinc-900 py-1 shadow-xl">
            <div className="border-b border-zinc-800 px-3 py-2">
              <p className="truncate text-sm text-zinc-300">{user.email}</p>
            </div>
            <Link
              href="/dashboard"
              className="block px-3 py-2 text-sm text-zinc-400 transition hover:bg-zinc-800/50 hover:text-zinc-200"
            >
              控制台
            </Link>
            <Link
              href="/settings"
              className="block px-3 py-2 text-sm text-zinc-400 transition hover:bg-zinc-800/50 hover:text-zinc-200"
            >
              设置
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              className="w-full px-3 py-2 text-left text-sm text-red-400 transition hover:bg-zinc-800/50 hover:text-red-300"
            >
              退出登录
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
