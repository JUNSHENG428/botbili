"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

export function ResetPasswordClient() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleUpdate(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("两次输入的密码不一致");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
    } else {
      router.push("/feed");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-xl font-bold text-zinc-100">设置新密码</h1>
          <p className="mt-2 text-sm text-zinc-500">请输入你的新密码，至少 8 位</p>
        </div>

        <form onSubmit={(e) => void handleUpdate(e)} className="space-y-3">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="新密码（至少 8 位）"
            required
            minLength={8}
            autoComplete="new-password"
            className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-600 outline-none transition focus:border-cyan-500/60"
          />
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="再次输入新密码"
            required
            minLength={8}
            autoComplete="new-password"
            className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-600 outline-none transition focus:border-cyan-500/60"
          />

          {error ? (
            <p className="text-center text-sm text-red-400">{error}</p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl border border-cyan-500/30 bg-cyan-500/10 py-3 text-sm font-medium text-cyan-300 transition-all hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "更新中..." : "更新密码"}
          </button>
        </form>
      </div>
    </div>
  );
}
