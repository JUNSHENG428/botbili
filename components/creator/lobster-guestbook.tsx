"use client";

import { useEffect, useRef, useState } from "react";

import { GlassCard } from "@/components/design/glass-card";

interface GuestbookEntry {
  id: string;
  author_name: string;
  content: string;
  created_at: string;
}

interface LobsterGuestbookProps {
  creatorId: string;
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "刚刚";
  if (mins < 60) return `${mins} 分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} 个月前`;
  return `${Math.floor(months / 12)} 年前`;
}

export function LobsterGuestbook({ creatorId }: LobsterGuestbookProps) {
  const [messages, setMessages] = useState<GuestbookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    void fetchMessages();
  }, [creatorId]);

  async function fetchMessages() {
    try {
      const res = await fetch(`/api/creators/${creatorId}/guestbook`);
      if (res.ok) {
        const json = (await res.json()) as { data: GuestbookEntry[] };
        setMessages(json.data);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/creators/${creatorId}/guestbook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed }),
      });

      if (res.status === 401) {
        setError("请先登录后再留言");
        return;
      }

      if (!res.ok) {
        const json = (await res.json()) as { message?: string };
        setError(json.message ?? "发送失败，请稍后重试");
        return;
      }

      // Prepend new message optimistically
      const newEntry: GuestbookEntry = {
        id: crypto.randomUUID(),
        author_name: "你",
        content: trimmed,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [newEntry, ...prev]);
      setContent("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }

  function handleTextareaInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setContent(e.target.value);
    // Auto-resize
    e.target.style.height = "auto";
    e.target.style.height = `${e.target.scrollHeight}px`;
  }

  const displayed = messages.slice(0, 10);

  return (
    <GlassCard className="p-4">
      <h3 className="mb-3 text-sm font-semibold text-zinc-300">📝 留言板</h3>

      {/* Message list */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-zinc-800/60" />
          ))}
        </div>
      ) : displayed.length === 0 ? (
        <p className="py-4 text-center text-xs text-zinc-500">还没有留言，来第一个留言吧 🦞</p>
      ) : (
        <ul className="space-y-2.5">
          {displayed.map((msg) => (
            <li key={msg.id} className="rounded-lg bg-zinc-800/50 px-3 py-2.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-medium text-cyan-400">{msg.author_name}</span>
                <span className="shrink-0 text-[10px] text-zinc-600">{relativeTime(msg.created_at)}</span>
              </div>
              <p className="mt-0.5 text-xs leading-relaxed text-zinc-300">{msg.content}</p>
            </li>
          ))}
        </ul>
      )}

      {messages.length > 10 && (
        <p className="mt-2 text-center text-xs text-zinc-500">共 {messages.length} 条留言</p>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="mt-3 space-y-2">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleTextareaInput}
          placeholder="写下你的留言…（最多 300 字）"
          maxLength={300}
          rows={2}
          className="w-full resize-none rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 outline-none transition focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30"
          style={{ overflow: "hidden" }}
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-zinc-600">{content.length}/300</span>
          <button
            type="submit"
            disabled={!content.trim() || submitting}
            className="rounded-lg bg-cyan-500/20 px-3 py-1.5 text-xs font-medium text-cyan-400 transition hover:bg-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? "发送中…" : "发送留言"}
          </button>
        </div>
      </form>
    </GlassCard>
  );
}
