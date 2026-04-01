"use client";

import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

export function ForgotPasswordClient() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleReset(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (resetError) {
      setError(resetError.message);
    } else {
      setSent(true);
    }
    setLoading(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-xl font-bold text-zinc-100">重置密码</h1>
          <p className="mt-2 text-sm text-zinc-500">
            输入你的注册邮箱，我们将发送重置链接
          </p>
        </div>

        {sent ? (
          <div className="space-y-4 text-center">
            <div className="rounded-xl border border-green-500/20 bg-green-500/10 p-4">
              <p className="text-sm text-green-400">
                重置邮件已发送到
                <br />
                <span className="font-medium text-green-300">{email}</span>
              </p>
            </div>
            <p className="text-xs text-zinc-500">请检查收件箱（含垃圾邮件）并点击链接重置密码</p>
            <a
              href="/login"
              className="block text-sm text-cyan-400 transition hover:underline"
            >
              返回登录
            </a>
          </div>
        ) : (
          <form onSubmit={(e) => void handleReset(e)} className="space-y-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="输入你的注册邮箱"
              required
              autoComplete="email"
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
              {loading ? "发送中..." : "发送重置邮件"}
            </button>

            <a
              href="/login"
              className="block text-center text-sm text-zinc-500 transition hover:text-zinc-400"
            >
              返回登录
            </a>
          </form>
        )}
      </div>
    </div>
  );
}
