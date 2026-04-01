"use client";

import { useCallback, useEffect, useState } from "react";

import { GlassCard } from "@/components/design/glass-card";

interface InviteCode {
  id: string;
  code: string;
  source: string;
  max_uses: number;
  used_count: number;
  is_active: boolean;
  created_at: string;
  expires_at: string | null;
}

interface Usage {
  code_id: string;
  user_id: string;
  used_at: string;
  email: string;
}

interface GenerateResult {
  code: string;
  max_uses: number;
}

export default function AdminInvitePage() {
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [usages, setUsages] = useState<Usage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [prefix, setPrefix] = useState("VIP");
  const [count, setCount] = useState(5);
  const [maxUses, setMaxUses] = useState(1);
  const [source, setSource] = useState("manual");
  const [generating, setGenerating] = useState(false);
  const [newCodes, setNewCodes] = useState<string[]>([]);
  const [copied, setCopied] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/invite");
      if (res.status === 403) {
        setError("无权限，仅管理员可访问");
        return;
      }
      const data = (await res.json()) as { codes: InviteCode[]; usages: Usage[] };
      setCodes(data.codes);
      setUsages(data.usages);
    } catch {
      setError("加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  async function handleGenerate(): Promise<void> {
    setGenerating(true);
    setNewCodes([]);
    try {
      const res = await fetch("/api/admin/invite/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefix, count, max_uses: maxUses, source }),
      });
      if (!res.ok) {
        setError("生成失败");
        return;
      }
      const data = (await res.json()) as { codes: GenerateResult[] };
      setNewCodes(data.codes.map((c) => c.code));
      void fetchData();
    } catch {
      setError("生成失败");
    } finally {
      setGenerating(false);
    }
  }

  function copyToClipboard(text: string): void {
    void navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(""), 2000);
  }

  function copyAllNewCodes(): void {
    const text = newCodes.join("\n");
    void navigator.clipboard.writeText(text);
    setCopied("all");
    setTimeout(() => setCopied(""), 2000);
  }

  function getUsageForCode(codeId: string): Usage[] {
    return usages.filter((u) => u.code_id === codeId);
  }

  if (error === "无权限，仅管理员可访问") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-zinc-500">无权限，仅管理员可访问</p>
      </div>
    );
  }

  const totalCodes = codes.length;
  const totalUsed = codes.reduce((sum, c) => sum + c.used_count, 0);
  const activeCodes = codes.filter((c) => c.is_active && c.used_count < c.max_uses).length;

  return (
    <div className="mx-auto max-w-4xl space-y-8 py-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">邀请码管理</h1>
        <p className="mt-1 text-sm text-zinc-500">生成、查看和追踪邀请码使用情况</p>
      </div>

      {/* 统计概览 */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "总邀请码", value: totalCodes },
          { label: "已使用次数", value: totalUsed },
          { label: "可用码数", value: activeCodes },
        ].map((stat) => (
          <GlassCard key={stat.label}>
            <p className="text-2xl font-bold text-zinc-50">{stat.value}</p>
            <p className="mt-1 text-xs text-zinc-500">{stat.label}</p>
          </GlassCard>
        ))}
      </div>

      {/* 生成新码 */}
      <GlassCard>
        <h2 className="mb-4 text-lg font-semibold text-zinc-100">生成邀请码</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs text-zinc-500">前缀</label>
            <input
              value={prefix}
              onChange={(e) => setPrefix(e.target.value.toUpperCase())}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-cyan-500/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-500">数量</label>
            <input
              type="number"
              min={1}
              max={50}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-cyan-500/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-500">每码可用次数</label>
            <input
              type="number"
              min={1}
              max={999}
              value={maxUses}
              onChange={(e) => setMaxUses(Number(e.target.value))}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-cyan-500/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-500">来源渠道</label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-cyan-500/50 focus:outline-none"
            >
              <option value="manual">手动发放</option>
              <option value="openclaw">OpenClaw</option>
              <option value="wechat">微信</option>
              <option value="producthunt">Product Hunt</option>
            </select>
          </div>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating || !prefix.trim()}
          className="mt-4 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-6 py-2 text-sm font-medium text-cyan-400 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {generating ? "生成中..." : `生成 ${count} 个邀请码`}
        </button>

        {/* 新生成的码 */}
        {newCodes.length > 0 && (
          <div className="mt-4 rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium text-cyan-400">
                已生成 {newCodes.length} 个邀请码
              </p>
              <button
                onClick={copyAllNewCodes}
                className="text-xs text-zinc-400 transition hover:text-zinc-200"
              >
                {copied === "all" ? "已复制 ✓" : "复制全部"}
              </button>
            </div>
            <div className="space-y-1">
              {newCodes.map((c) => (
                <div key={c} className="flex items-center justify-between rounded bg-zinc-900/50 px-3 py-1.5">
                  <code className="font-mono text-sm text-zinc-200">{c}</code>
                  <button
                    onClick={() => copyToClipboard(c)}
                    className="text-xs text-zinc-500 transition hover:text-zinc-300"
                  >
                    {copied === c ? "✓" : "复制"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </GlassCard>

      {/* 邀请码列表 */}
      <GlassCard>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-100">所有邀请码</h2>
          <button
            onClick={() => void fetchData()}
            className="text-xs text-zinc-500 transition hover:text-zinc-300"
          >
            刷新
          </button>
        </div>

        {loading ? (
          <p className="py-8 text-center text-sm text-zinc-500">加载中...</p>
        ) : codes.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-500">暂无邀请码</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-xs text-zinc-500">
                  <th className="px-3 py-2">邀请码</th>
                  <th className="px-3 py-2">来源</th>
                  <th className="px-3 py-2">使用</th>
                  <th className="px-3 py-2">状态</th>
                  <th className="px-3 py-2">创建时间</th>
                  <th className="px-3 py-2">使用者</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {codes.map((code) => {
                  const codeUsages = getUsageForCode(code.id);
                  const isFull = code.used_count >= code.max_uses;
                  const isActive = code.is_active && !isFull;

                  return (
                    <tr key={code.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/20">
                      <td className="px-3 py-3">
                        <code className="font-mono text-zinc-200">{code.code}</code>
                      </td>
                      <td className="px-3 py-3">
                        <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
                          {code.source}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-zinc-400">
                        {code.used_count}/{code.max_uses}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`text-xs ${
                            isActive ? "text-green-400" : "text-zinc-600"
                          }`}
                        >
                          {isActive ? "可用" : isFull ? "已用完" : "停用"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-xs text-zinc-500">
                        {new Date(code.created_at).toLocaleDateString("zh-CN")}
                      </td>
                      <td className="px-3 py-3">
                        {codeUsages.length > 0 ? (
                          <div className="space-y-0.5">
                            {codeUsages.slice(0, 3).map((u, i) => (
                              <p key={i} className="text-xs text-zinc-500">
                                {u.email}
                                <span className="ml-1 text-zinc-600">
                                  {new Date(u.used_at).toLocaleDateString("zh-CN")}
                                </span>
                              </p>
                            ))}
                            {codeUsages.length > 3 && (
                              <p className="text-xs text-zinc-600">
                                +{codeUsages.length - 3} 更多
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-zinc-700">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <button
                          onClick={() => copyToClipboard(code.code)}
                          className="text-xs text-zinc-500 transition hover:text-zinc-300"
                        >
                          {copied === code.code ? "✓" : "复制"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {error && error !== "无权限，仅管理员可访问" && (
        <p className="text-center text-sm text-red-400">{error}</p>
      )}
    </div>
  );
}
