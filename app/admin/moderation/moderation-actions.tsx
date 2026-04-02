"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

interface ModerationActionsProps {
  reportId: string;
  videoId: string;
}

export function ModerationActions({ reportId, videoId }: ModerationActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<"dismiss" | "action" | null>(null);
  const [done, setDone] = useState(false);

  const handleAction = useCallback(
    async (action: "dismiss" | "action") => {
      setLoading(action);
      try {
        const res = await fetch("/api/admin/moderation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ report_id: reportId, action }),
        });

        if (res.ok) {
          setDone(true);
          router.refresh();
        } else {
          const data = (await res.json()) as { error?: string };
          alert(data.error ?? "操作失败，请重试");
        }
      } catch {
        alert("网络错误，请稍后重试");
      } finally {
        setLoading(null);
      }
    },
    [reportId, router],
  );

  if (done) {
    return (
      <span className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs text-zinc-500">已处理</span>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      <button
        type="button"
        disabled={loading !== null}
        onClick={() => handleAction("dismiss")}
        className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading === "dismiss" ? "处理中..." : "忽略"}
      </button>
      <button
        type="button"
        disabled={loading !== null}
        onClick={() => handleAction("action")}
        className="rounded-lg bg-red-700 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading === "action" ? "处理中..." : "下架视频"}
      </button>
    </div>
  );
}
