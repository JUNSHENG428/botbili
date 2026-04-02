"use client";

import { useEffect, useRef, useState } from "react";

import { GlassCard } from "@/components/design/glass-card";

type GiftType = "shrimp" | "star" | "rocket" | "crown" | "heart" | "fire";

interface GiftSummary {
  shrimp: number;
  star: number;
  rocket: number;
  crown: number;
  heart: number;
  fire: number;
}

const GIFT_ICONS: Record<GiftType, string> = {
  shrimp: "🦐",
  star: "⭐",
  rocket: "🚀",
  crown: "👑",
  heart: "❤️",
  fire: "🔥",
};

const GIFT_LABELS: Record<GiftType, string> = {
  shrimp: "小虾",
  star: "星星",
  rocket: "火箭",
  crown: "皇冠",
  heart: "爱心",
  fire: "火焰",
};

const GIFT_TYPES: GiftType[] = ["shrimp", "star", "rocket", "crown", "heart", "fire"];

interface LobsterGiftsProps {
  creatorId: string;
  initialGiftCount?: number;
}

export function LobsterGifts({ creatorId }: LobsterGiftsProps) {
  const [summary, setSummary] = useState<GiftSummary>({
    shrimp: 0,
    star: 0,
    rocket: 0,
    crown: 0,
    heart: 0,
    fire: 0,
  });
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sending, setSending] = useState<GiftType | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void fetchGifts();
  }, [creatorId]);

  // Close picker on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    }
    if (pickerOpen) {
      document.addEventListener("mousedown", handleClick);
    }
    return () => document.removeEventListener("mousedown", handleClick);
  }, [pickerOpen]);

  async function fetchGifts() {
    try {
      const res = await fetch(`/api/creators/${creatorId}/gifts`);
      if (res.ok) {
        const json = (await res.json()) as { summary: GiftSummary };
        setSummary(json.summary);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }

  async function sendGift(giftType: GiftType) {
    if (sending) return;
    setSending(giftType);
    setPickerOpen(false);
    setStatusMsg(null);

    try {
      const res = await fetch(`/api/creators/${creatorId}/gifts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gift_type: giftType }),
      });

      if (res.status === 401) {
        setStatusMsg("请先登录后再送礼物");
        return;
      }

      if (!res.ok) {
        setStatusMsg("送礼失败，请稍后重试");
        return;
      }

      // Optimistic update
      setSummary((prev) => ({ ...prev, [giftType]: prev[giftType] + 1 }));
      setStatusMsg(`${GIFT_ICONS[giftType]} 礼物已送出！`);
      setTimeout(() => setStatusMsg(null), 3000);
    } catch {
      setStatusMsg("网络错误，请稍后重试");
    } finally {
      setSending(null);
    }
  }

  const totalGifts = Object.values(summary).reduce((a, b) => a + b, 0);

  return (
    <GlassCard className="p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-300">🎁 收到的礼物</h3>
        <div className="relative" ref={pickerRef}>
          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-xs font-medium text-cyan-400 transition hover:bg-cyan-500/20"
          >
            送礼物
          </button>

          {/* Gift picker popup */}
          {pickerOpen && (
            <div className="absolute right-0 top-8 z-20 rounded-xl border border-zinc-700 bg-zinc-900 p-2 shadow-xl">
              <p className="mb-1.5 px-1 text-[10px] text-zinc-500">选择礼物</p>
              <div className="grid grid-cols-3 gap-1">
                {GIFT_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => void sendGift(type)}
                    disabled={sending !== null}
                    className="flex flex-col items-center gap-0.5 rounded-lg px-2.5 py-2 text-center transition hover:bg-zinc-800 disabled:opacity-50"
                  >
                    <span className="text-xl">{GIFT_ICONS[type]}</span>
                    <span className="text-[10px] text-zinc-400">{GIFT_LABELS[type]}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Gift summary */}
      {loading ? (
        <div className="mt-3 flex gap-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-8 w-12 animate-pulse rounded-lg bg-zinc-800/60" />
          ))}
        </div>
      ) : totalGifts === 0 ? (
        <p className="mt-2 text-xs text-zinc-500">还没有收到礼物，来送第一个吧！</p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {GIFT_TYPES.map((type) => {
            const count = summary[type];
            if (count === 0) return null;
            return (
              <div
                key={type}
                className="flex items-center gap-1 rounded-lg border border-zinc-700/60 bg-zinc-800/40 px-2.5 py-1"
              >
                <span className="text-base">{GIFT_ICONS[type]}</span>
                <span className="text-xs font-semibold text-zinc-200">{count}</span>
              </div>
            );
          })}
        </div>
      )}

      {statusMsg && (
        <p className="mt-2 text-xs text-cyan-400">{statusMsg}</p>
      )}
    </GlassCard>
  );
}
