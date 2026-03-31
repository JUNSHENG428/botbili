import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import type { ApiError } from "@/types";

/**
 * 校验是否为 http/https URL。
 */
export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * 统一 API 错误结构。
 */
export function buildApiError(error: string, code: string): ApiError {
  return {
    error,
    code,
    message: error,
  };
}

/**
 * 带上下文信息的 API 错误结构。
 */
export function buildApiErrorWithMeta(
  error: string,
  code: string,
  meta: Omit<ApiError, "error" | "code" | "message">,
): ApiError {
  return {
    error,
    code,
    message: error,
    ...meta,
  };
}

/**
 * 合并 Tailwind className。
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * 获取应用的基础 URL，优先使用 Vercel 自动注入的 VERCEL_URL。
 */
export function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
