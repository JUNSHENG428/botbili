"use client";

import { useEffect, useState } from "react";

import { FeedbackPanel } from "./feedback-panel";

export function FeedbackFab() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function handler(): void {
      setOpen(true);
    }
    document.addEventListener("open-feedback", handler);
    return () => document.removeEventListener("open-feedback", handler);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800/90 backdrop-blur-sm transition-all duration-200 hover:border-cyan-500/50 hover:shadow-[0_0_12px_rgba(0,255,255,0.15)]"
        aria-label="提交反馈"
      >
        <svg
          className="h-5 w-5 text-zinc-400 transition-colors group-hover:text-cyan-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
        </svg>
      </button>

      {open && <FeedbackPanel onClose={() => setOpen(false)} />}
    </>
  );
}
