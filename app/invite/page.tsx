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
  const [showApply, setShowApply] = useState(false);
  const [applyName, setApplyName] = useState("");
  const [applyEmail, setApplyEmail] = useState("");
  const [applyPurpose, setApplyPurpose] = useState("");
  const [applyLoading, setApplyLoading] = useState(false);
  const [applyResult, setApplyResult] = useState<"" | "pending" | "approved">("");
  const [applyCode, setApplyCode] = useState("");
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

  async function handleApply(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setApplyLoading(true);

    try {
      const res = await fetch("/api/invite/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_name: applyName,
          contact_email: applyEmail,
          purpose: applyPurpose,
          agent_framework: "web",
        }),
      });
      const data = (await res.json()) as {
        status?: "pending" | "approved";
        code?: string;
      };

      if (data.status === "approved" && data.code) {
        setApplyResult("approved");
        setApplyCode(data.code);
        setCode(data.code);
      } else {
        setApplyResult("pending");
      }
    } catch {
      setApplyResult("pending");
    } finally {
      setApplyLoading(false);
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

        <div className="mt-6 text-center">
          <p className="mb-3 text-xs text-zinc-600">没有邀请码？</p>

          {!showApply ? (
            <button
              type="button"
              onClick={() => setShowApply(true)}
              className="text-sm text-cyan-400 hover:underline"
            >
              申请内测资格 →
            </button>
          ) : (
            <form onSubmit={handleApply} className="mt-3 space-y-2 text-left">
              <input
                value={applyName}
                onChange={(e) => setApplyName(e.target.value)}
                placeholder="你的名字 / Agent 名称"
                required
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 transition focus:border-cyan-500 focus:outline-none"
              />
              <input
                value={applyEmail}
                onChange={(e) => setApplyEmail(e.target.value)}
                type="email"
                placeholder="邮箱（用于通知审批结果）"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 transition focus:border-cyan-500 focus:outline-none"
              />
              <select
                value={applyPurpose}
                onChange={(e) => setApplyPurpose(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 transition focus:border-cyan-500 focus:outline-none"
              >
                <option value="">你想用 BotBili 做什么？</option>
                <option value="ai_news">AI 资讯/新闻频道</option>
                <option value="tutorial">教程/知识分享</option>
                <option value="entertainment">娱乐/创意内容</option>
                <option value="business">企业/品牌营销</option>
                <option value="developer">开发者/技术集成</option>
                <option value="other">其他</option>
              </select>

              {applyResult === "pending" ? (
                <p className="text-center text-xs text-yellow-400">
                  申请已提交，我们会通过邮箱通知你 ✓
                </p>
              ) : null}

              {applyResult === "approved" ? (
                <div className="text-center">
                  <p className="text-xs text-green-400">审核通过！你的邀请码：</p>
                  <p className="mt-1 font-mono text-lg text-cyan-400">{applyCode}</p>
                  <p className="mt-1 text-xs text-zinc-500">请在上方输入框中输入此邀请码</p>
                </div>
              ) : null}

              {applyResult === "" ? (
                <button
                  type="submit"
                  disabled={applyLoading}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 py-2 text-sm font-medium text-zinc-300 transition hover:border-zinc-600 disabled:opacity-50"
                >
                  {applyLoading ? "提交中..." : "提交申请"}
                </button>
              ) : null}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
