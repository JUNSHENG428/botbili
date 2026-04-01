"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { GlassCard } from "@/components/design/glass-card";
import { createClient } from "@/lib/supabase/client";

export function DangerSection() {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const router = useRouter();

  async function handleLogout(): Promise<void> {
    setLogoutLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <GlassCard className="space-y-4 border-red-500/10">
      <h2 className="text-lg font-semibold text-zinc-100">危险操作</h2>

      <div className="space-y-3">
        {/* 退出登录 */}
        <button
          type="button"
          onClick={() => void handleLogout()}
          disabled={logoutLoading}
          className="w-full rounded-xl border border-zinc-800 bg-zinc-800/50 px-4 py-3 text-left text-sm text-zinc-400 transition hover:border-zinc-700 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {logoutLoading ? "退出中..." : "退出登录"}
        </button>

        {/* 注销账号 */}
        {!confirmDelete ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="w-full rounded-xl border border-zinc-800 bg-zinc-800/50 px-4 py-3 text-left text-sm text-red-400/60 transition hover:border-red-500/20 hover:text-red-400"
          >
            注销账号
          </button>
        ) : (
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-4 space-y-3">
            <p className="text-sm text-red-400 leading-relaxed">
              注销后你的所有频道和视频将被永久删除，此操作<strong>不可撤销</strong>。
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-400 transition hover:border-zinc-600"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  // TODO: POST /api/account/delete
                  alert("注销功能即将上线，请联系 botbili2026@outlook.com");
                  setConfirmDelete(false);
                }}
                className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs text-red-400 transition hover:bg-red-500/20"
              >
                确认注销
              </button>
            </div>
          </div>
        )}
      </div>
    </GlassCard>
  );
}
