"use client";

import { useState } from "react";
import type { User } from "@supabase/supabase-js";

import { GlassCard } from "@/components/design/glass-card";
import { createClient } from "@/lib/supabase/client";

interface SecuritySectionProps {
  user: User;
}

export function SecuritySection({ user }: SecuritySectionProps) {
  const provider = (user.app_metadata?.provider as string | undefined) ?? "email";
  const isEmailUser = provider === "email";

  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function handleChangePassword(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setMsg("");
    setErr("");

    if (newPw !== confirmPw) {
      setErr("两次密码不一致");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setLoading(false);

    if (error) {
      setErr(error.message);
    } else {
      setMsg("密码已更新");
      setNewPw("");
      setConfirmPw("");
    }
  }

  return (
    <GlassCard className="space-y-4">
      <h2 className="text-lg font-semibold text-zinc-100">安全设置</h2>

      {isEmailUser ? (
        /* 邮箱用户：显示修改密码表单 */
        <form onSubmit={(e) => void handleChangePassword(e)} className="space-y-3">
          <div>
            <label className="mb-1.5 block text-sm text-zinc-400">新密码</label>
            <input
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              placeholder="至少 8 位"
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-zinc-200 placeholder:text-zinc-600 outline-none transition focus:border-cyan-500/60"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-zinc-400">确认新密码</label>
            <input
              type="password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              placeholder="再次输入"
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-zinc-200 placeholder:text-zinc-600 outline-none transition focus:border-cyan-500/60"
            />
          </div>

          {err ? <p className="text-sm text-red-400">{err}</p> : null}
          {msg ? <p className="text-sm text-green-400">{msg}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:border-zinc-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "更新中..." : "修改密码"}
          </button>
        </form>
      ) : (
        /* OAuth 用户：显示绑定状态 */
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-800/50 px-4 py-3">
            <span className="text-sm text-zinc-300">
              {provider === "google" ? "Google" : "GitHub"} 账号
            </span>
            <span className="rounded-full bg-green-400/10 px-2 py-0.5 text-xs text-green-400">
              已绑定
            </span>
          </div>
          <p className="text-xs text-zinc-600">
            使用第三方登录的账号，密码由对应平台管理。
          </p>
        </div>
      )}
    </GlassCard>
  );
}
