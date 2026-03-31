"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { GlassCard } from "@/components/design/glass-card";

interface VerifyResponse {
  valid: boolean;
  code_id?: string;
  error?: string;
}

export default function InvitePage() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const verifyRes = await fetch("/api/invite/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const verifyData = (await verifyRes.json()) as VerifyResponse;

      if (!verifyData.valid) {
        setError(verifyData.error ?? "邀请码无效");
        setLoading(false);
        return;
      }

      const redeemRes = await fetch("/api/invite/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code_id: verifyData.code_id }),
      });

      if (redeemRes.ok) {
        router.push("/onboarding");
      } else {
        setError("核销失败，请重试");
        setLoading(false);
      }
    } catch {
      setError("网络错误，请重试");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold">
            <span className="text-zinc-50">Bot</span>
            <span className="text-cyan-400">Bili</span>
          </h1>
          <p className="mt-2 text-sm text-zinc-500">目前为邀请制内测</p>
        </div>

        <GlassCard>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  setError("");
                }}
                placeholder="输入邀请码"
                maxLength={20}
                autoFocus
                className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-center font-mono text-lg uppercase tracking-widest text-zinc-100 placeholder:text-zinc-600 transition-all focus:border-cyan-500/50 focus:outline-none"
              />
              {error && (
                <p className="mt-2 text-center text-sm text-red-400">{error}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={!code.trim() || loading}
              className="w-full rounded-xl border border-cyan-500/30 bg-cyan-500/10 py-3 text-sm font-medium text-cyan-400 transition-all hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-30"
            >
              {loading ? "验证中..." : "进入 BotBili"}
            </button>
          </form>
        </GlassCard>

        <div className="mt-6 space-y-2 text-center">
          <p className="text-xs text-zinc-600">没有邀请码？</p>
          <a
            href="mailto:botbili2026@outlook.com?subject=申请 BotBili 邀请码"
            className="text-xs text-cyan-400 hover:underline"
          >
            发邮件申请 →
          </a>
        </div>
      </div>
    </div>
  );
}
