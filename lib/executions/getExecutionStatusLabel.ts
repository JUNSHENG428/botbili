import type { RecipeExecutionStatus } from "@/types/recipe";

export type ExecutionOutputDisplayStatus = "pending" | "running" | "completed" | "failed";

const STATUS_LABELS: Record<RecipeExecutionStatus, string> = {
  pending: "等待 Agent 领取",
  running: "执行中",
  script_done: "脚本完成",
  edit_done: "剪辑完成",
  publishing: "发布中",
  success: "已完成",
  completed: "已完成",
  failed: "失败",
  cancelled: "已取消",
};

/**
 * 统一 execution 状态文案，兼容历史 success。
 */
export function getExecutionStatusLabel(status: RecipeExecutionStatus): string {
  return STATUS_LABELS[status];
}

export function isExecutionCompletedStatus(status: RecipeExecutionStatus): boolean {
  return status === "success" || status === "completed";
}

export function isExecutionFailedStatus(status: RecipeExecutionStatus): boolean {
  return status === "failed" || status === "cancelled";
}

export function isExecutionTerminalStatus(status: RecipeExecutionStatus): boolean {
  return isExecutionCompletedStatus(status) || isExecutionFailedStatus(status);
}

export function getExecutionStatusClassName(status: RecipeExecutionStatus): string {
  if (isExecutionCompletedStatus(status)) {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  }

  if (status === "failed") {
    return "border-red-500/30 bg-red-500/10 text-red-300";
  }

  if (status === "cancelled" || status === "pending") {
    return "border-zinc-700 bg-zinc-800/80 text-zinc-300";
  }

  return "border-cyan-500/30 bg-cyan-500/10 text-cyan-300";
}

export function getExecutionStatusDotClassName(status: RecipeExecutionStatus): string {
  switch (status) {
    case "success":
    case "completed":
      return "bg-emerald-400";
    case "failed":
      return "bg-red-400";
    case "cancelled":
    case "pending":
      return "bg-zinc-500";
    case "running":
      return "bg-yellow-400 animate-pulse";
    default:
      return "bg-cyan-400";
  }
}

export function getExecutionOutputDisplayStatus(status: RecipeExecutionStatus): ExecutionOutputDisplayStatus {
  if (isExecutionCompletedStatus(status)) {
    return "completed";
  }

  if (isExecutionFailedStatus(status)) {
    return "failed";
  }

  if (status === "pending") {
    return "pending";
  }

  return "running";
}

/**
 * 给失败 execution 提供可执行的下一步建议，避免用户只看到原始错误文案。
 */
export function getExecutionFailureSuggestions(errorMessage?: string | null): string[] {
  const normalized = (errorMessage ?? "").toLowerCase();

  if (
    normalized.includes("auth") ||
    normalized.includes("401") ||
    normalized.includes("403") ||
    normalized.includes("token") ||
    normalized.includes("api key") ||
    normalized.includes("secret") ||
    normalized.includes("权限")
  ) {
    return [
      "检查 creator API Key、回调密钥和 BotBili 登录态是否仍然有效。",
      "确认本地 Agent 使用的是当前环境变量，没有混用旧项目配置。",
      "修正认证配置后重新执行这条 Recipe。",
    ];
  }

  if (
    normalized.includes("timeout") ||
    normalized.includes("network") ||
    normalized.includes("fetch") ||
    normalized.includes("callback") ||
    normalized.includes("连接") ||
    normalized.includes("超时")
  ) {
    return [
      "检查本地 Agent 是否在线，并且能访问 BotBili 的 execution 接口。",
      "确认 OpenClaw 回调地址和网络代理配置正确，没有被本地防火墙拦截。",
      "网络恢复后重新执行，观察状态是否从“等待 Agent 领取”切换到“执行中”。",
    ];
  }

  if (
    normalized.includes("publish") ||
    normalized.includes("bilibili") ||
    normalized.includes("youtube") ||
    normalized.includes("douyin") ||
    normalized.includes("平台")
  ) {
    return [
      "检查目标平台授权、Cookie 或发布权限是否已过期。",
      "先在本地 Agent 里确认发布步骤能独立跑通，再重新回写结果。",
      "必要时先用 completed 回写基础结果，再补充外部平台链接和封面。",
    ];
  }

  return [
    "检查本地 Agent 是否已启动，并且正在主动轮询这个 execution。",
    "确认脚本依赖、素材权限和回调配置正常，再重新执行一次。",
    "如果问题持续出现，先在 Dashboard 查看最近失败记录，再定位具体步骤。",
  ];
}
