"use client";

import { useState } from "react";

interface FeedbackPanelProps {
  onClose: () => void;
}

const TYPE_OPTIONS = [
  { value: "bug", label: "Bug 报告", icon: "🐛", color: "text-red-400" },
  { value: "feature", label: "功能建议", icon: "💡", color: "text-yellow-400" },
  { value: "partnership", label: "商务合作", icon: "🤝", color: "text-cyan-400" },
  { value: "general", label: "其他反馈", icon: "💬", color: "text-zinc-400" },
] as const;

const PLACEHOLDER_SUBJECT: Record<string, string> = {
  bug: "问题概述，如「上传 API 返回 500」",
  feature: "你希望看到什么功能？",
  partnership: "合作方向，如「品牌赞助」",
  general: "简要说明",
};

const PLACEHOLDER_BODY: Record<string, string> = {
  bug: "重现步骤：1. 调用 ... 2. 期望 ... 3. 实际 ...",
  feature: "描述你的使用场景和期望效果",
  partnership: "你的公司/项目、合作想法",
  general: "详细描述...",
};

export function FeedbackPanel({ onClose }: FeedbackPanelProps) {
  const [type, setType] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setSubmitting(true);

    const form = new FormData(e.currentTarget);

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          name: form.get("name"),
          email: form.get("email"),
          subject: form.get("subject"),
          body: form.get("body"),
          page_url: window.location.href,
        }),
      });

      if (res.ok) {
        setSubmitted(true);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      {/* 遮罩 */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden />

      {/* 面板 */}
      <div className="relative z-10 max-h-[85vh] w-full overflow-y-auto rounded-t-2xl border border-zinc-700 bg-zinc-900/95 p-6 backdrop-blur-xl animate-slide-up sm:max-w-md sm:rounded-2xl">
        {/* 头部 */}
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-zinc-100">联系我们</h3>
          <button type="button" onClick={onClose} className="text-zinc-500 hover:text-zinc-300" aria-label="关闭">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {submitted ? (
          <div className="py-8 text-center">
            <div className="mb-3 text-4xl">✓</div>
            <p className="font-medium text-zinc-100">已收到，感谢反馈</p>
            <p className="mt-1 text-sm text-zinc-500">我们会尽快处理</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-5 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-600"
            >
              关闭
            </button>
          </div>
        ) : !type ? (
          <div className="space-y-2">
            <p className="mb-3 text-sm text-zinc-500">请选择反馈类型</p>
            {TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setType(opt.value)}
                className="flex w-full items-center gap-3 rounded-xl border border-zinc-700/50 bg-zinc-800/50 px-4 py-3 text-left transition-all hover:border-zinc-600 hover:bg-zinc-800"
              >
                <span className="text-xl">{opt.icon}</span>
                <span className="text-zinc-200">{opt.label}</span>
              </button>
            ))}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <button
              type="button"
              onClick={() => setType(null)}
              className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300"
            >
              ← 返回选择类型
            </button>

            {type === "partnership" && (
              <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3 text-sm text-zinc-300">
                商务合作也可直接发邮件至{" "}
                <a href="mailto:botbili2026@outlook.com" className="text-cyan-400 underline">
                  botbili2026@outlook.com
                </a>
              </div>
            )}

            <input
              name="name"
              placeholder="你的名字（选填）"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-zinc-200 placeholder:text-zinc-600 transition focus:border-cyan-500/50 focus:outline-none"
            />
            <input
              name="email"
              type="email"
              placeholder="邮箱（选填，方便我们回复你）"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-zinc-200 placeholder:text-zinc-600 transition focus:border-cyan-500/50 focus:outline-none"
            />
            <input
              name="subject"
              required
              placeholder={PLACEHOLDER_SUBJECT[type] ?? "简要说明"}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-zinc-200 placeholder:text-zinc-600 transition focus:border-cyan-500/50 focus:outline-none"
            />
            <textarea
              name="body"
              required
              rows={4}
              placeholder={PLACEHOLDER_BODY[type] ?? "详细描述..."}
              className="w-full resize-none rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-zinc-200 placeholder:text-zinc-600 transition focus:border-cyan-500/50 focus:outline-none"
            />

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg border border-cyan-500/30 bg-cyan-500/10 py-2.5 text-sm font-medium text-cyan-400 transition-all hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "提交中..." : "提交反馈"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
