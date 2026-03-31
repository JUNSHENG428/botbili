"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";

/* ---------- types ---------- */

type ToastVariant = "info" | "success" | "error" | "warning";

interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
  duration: number;
}

interface ToastOptions {
  variant?: ToastVariant;
  /** 自动消失毫秒，默认 3000 */
  duration?: number;
}

interface ToastContextValue {
  toast: (message: string, options?: ToastOptions) => void;
}

/* ---------- context ---------- */

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within <ToastProvider>");
  }
  return ctx;
}

/* ---------- provider ---------- */

let counter = 0;

export function ToastProvider({ children }: { children: ReactNode }): ReactNode {
  const [items, setItems] = useState<ToastItem[]>([]);

  const toast = useCallback((message: string, options?: ToastOptions) => {
    const id = `toast_${++counter}`;
    const item: ToastItem = {
      id,
      message,
      variant: options?.variant ?? "info",
      duration: options?.duration ?? 3000,
    };
    setItems((prev) => [...prev, item]);
  }, []);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer items={items} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

/* ---------- container ---------- */

function ToastContainer({
  items,
  onDismiss,
}: {
  items: ToastItem[];
  onDismiss: (id: string) => void;
}): ReactNode {
  if (items.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[9999] flex flex-col gap-2">
      {items.map((item) => (
        <ToastCard key={item.id} item={item} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

/* ---------- single toast ---------- */

const VARIANT_STYLES: Record<ToastVariant, string> = {
  info: "border-cyan-500/40 bg-cyan-950/80 text-cyan-100",
  success: "border-emerald-500/40 bg-emerald-950/80 text-emerald-100",
  error: "border-red-500/40 bg-red-950/80 text-red-100",
  warning: "border-amber-500/40 bg-amber-950/80 text-amber-100",
};

const VARIANT_ICONS: Record<ToastVariant, string> = {
  info: "ℹ",
  success: "✓",
  error: "✕",
  warning: "⚠",
};

function ToastCard({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: string) => void;
}): ReactNode {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));

    timerRef.current = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onDismiss(item.id), 200);
    }, item.duration);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [item.id, item.duration, onDismiss]);

  return (
    <div
      role="status"
      className={`pointer-events-auto flex min-w-[260px] max-w-sm items-center gap-2 rounded-lg border px-4 py-3 text-sm shadow-lg backdrop-blur-md transition-all duration-200 ${
        visible ? "translate-x-0 opacity-100" : "translate-x-4 opacity-0"
      } ${VARIANT_STYLES[item.variant]}`}
    >
      <span className="shrink-0 text-base">{VARIANT_ICONS[item.variant]}</span>
      <span className="flex-1">{item.message}</span>
      <button
        type="button"
        onClick={() => {
          setVisible(false);
          setTimeout(() => onDismiss(item.id), 200);
        }}
        className="shrink-0 opacity-60 hover:opacity-100"
      >
        ✕
      </button>
    </div>
  );
}
