"use client";

import { useCallback, useRef, useState } from "react";

interface ReportButtonProps {
  videoId: string;
}

type ReportReason = "inappropriate" | "spam" | "copyright" | "misinformation" | "other";

const REASON_LABELS: Record<ReportReason, string> = {
  inappropriate: "不适当内容",
  spam: "垃圾广告",
  copyright: "版权侵权",
  misinformation: "虚假信息",
  other: "其他",
};

export function ReportButton({ videoId }: ReportButtonProps) {
  const [open, setOpen] = useState(false);
  const [selectedReason, setSelectedReason] = useState<ReportReason | "">("");
  const [detail, setDetail] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleToggle = useCallback(() => {
    setOpen((prev) => !prev);
    setFeedback(null);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!selectedReason) return;
    setLoading(true);
    setFeedback(null);

    try {
      const res = await fetch(`/api/videos/${videoId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: selectedReason, detail: detail.trim() || undefined }),
      });

      if (res.status === 401) {
        setFeedback({ type: "error", message: "请先登录后再举报" });
        return;
      }

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setFeedback({ type: "error", message: data.error ?? "举报失败，请重试" });
        return;
      }

      setFeedback({ type: "success", message: "举报已提交，感谢您的反馈" });
      setSelectedReason("");
      setDetail("");
      setTimeout(() => {
        setOpen(false);
        setFeedback(null);
      }, 2000);
    } catch {
      setFeedback({ type: "error", message: "网络错误，请稍后重试" });
    } finally {
      setLoading(false);
    }
  }, [videoId, selectedReason, detail]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={handleToggle}
        className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-200"
        aria-label="举报视频"
      >
        {/* Flag icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
          <line x1="4" y1="22" x2="4" y2="15" />
        </svg>
        举报
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-72 rounded-xl border border-zinc-700 bg-zinc-900 p-4 shadow-lg">
          <h3 className="mb-3 text-sm font-semibold text-zinc-100">举报视频</h3>

          {feedback ? (
            <p
              className={`rounded-lg px-3 py-2 text-sm ${
                feedback.type === "success"
                  ? "bg-emerald-900/40 text-emerald-400"
                  : "bg-red-900/40 text-red-400"
              }`}
            >
              {feedback.message}
            </p>
          ) : (
            <>
              <div className="mb-3 space-y-1">
                {(Object.entries(REASON_LABELS) as [ReportReason, string][]).map(([value, label]) => (
                  <label
                    key={value}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-zinc-300 transition hover:bg-zinc-800"
                  >
                    <input
                      type="radio"
                      name="report-reason"
                      value={value}
                      checked={selectedReason === value}
                      onChange={() => setSelectedReason(value)}
                      className="accent-cyan-500"
                    />
                    {label}
                  </label>
                ))}
              </div>

              <textarea
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                placeholder="补充说明（可选）"
                maxLength={500}
                rows={2}
                className="mb-3 w-full resize-none rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
              />

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-1.5 text-xs text-zinc-400 transition hover:text-zinc-200"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!selectedReason || loading}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? "提交中..." : "提交举报"}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
