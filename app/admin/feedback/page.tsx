"use client";

import { useCallback, useEffect, useState } from "react";

import { GlassCard } from "@/components/design/glass-card";

interface FeedbackItem {
  id: string;
  type: string;
  source: string;
  name: string | null;
  email: string | null;
  subject: string;
  body: string;
  page_url: string | null;
  status: string;
  created_at: string;
}

const TYPE_LABEL: Record<string, string> = {
  bug: "🐛 Bug",
  feature: "💡 功能建议",
  partnership: "🤝 合作",
  general: "📝 一般",
};

const STATUS_COLORS: Record<string, string> = {
  new: "bg-cyan-500/20 text-cyan-300",
  read: "bg-yellow-500/20 text-yellow-300",
  replied: "bg-green-500/20 text-green-300",
  closed: "bg-zinc-700 text-zinc-400",
};

export default function AdminFeedbackPage() {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFeedback = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/feedback");
      if (res.ok) {
        const data = await res.json();
        setItems(data.items ?? []);
      }
    } catch {
      // 静默
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchFeedback();
  }, [fetchFeedback]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-cyan-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold text-zinc-100">用户反馈</h1>
      <p className="mt-1 text-sm text-zinc-500">{items.length} 条反馈</p>

      <div className="mt-6 space-y-3">
        {items.length === 0 ? (
          <p className="py-10 text-center text-zinc-500">暂无反馈</p>
        ) : (
          items.map((item) => (
            <GlassCard key={item.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">
                      {TYPE_LABEL[item.type] ?? item.type}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs ${
                        STATUS_COLORS[item.status] ?? ""
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>
                  <p className="mt-1 font-medium text-zinc-100">
                    {item.subject}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-400">
                    {item.body}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-zinc-600">
                    {item.name && <span>来自：{item.name}</span>}
                    {item.email && <span>{item.email}</span>}
                    {item.page_url && <span>页面：{item.page_url}</span>}
                    <span>
                      {new Date(item.created_at).toLocaleString("zh-CN")}
                    </span>
                  </div>
                </div>
              </div>
            </GlassCard>
          ))
        )}
      </div>
    </div>
  );
}
