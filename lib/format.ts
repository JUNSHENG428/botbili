/**
 * 数字转人类展示播放量。
 */
export function formatViewCount(n: number): string {
  if (n >= 10000) {
    return `${(n / 10000).toFixed(1).replace(".0", "")}万`;
  }
  if (n >= 1000) {
    return `${(n / 1000).toFixed(1).replace(".0", "")}K`;
  }
  return `${n}`;
}

/**
 * 秒转 m:ss。
 */
export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) {
    return "0:00";
  }
  const total = Math.floor(seconds);
  const minute = Math.floor(total / 60);
  const second = total % 60;
  return `${minute}:${second.toString().padStart(2, "0")}`;
}

/**
 * ISO 时间转相对时间。
 */
export function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "刚刚";
  }

  const diff = Date.now() - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < hour) {
    return `${Math.max(1, Math.floor(diff / minute))} 分钟前`;
  }
  if (diff < day) {
    return `${Math.floor(diff / hour)} 小时前`;
  }
  if (diff < day * 2) {
    return "昨天";
  }
  if (diff < day * 30) {
    return `${Math.floor(diff / day)} 天前`;
  }
  return date.toLocaleDateString("zh-CN");
}

/**
 * 状态码转人类文案。
 */
export function statusToLabel(status: string): string {
  const map: Record<string, string> = {
    processing: "处理中",
    ready: "可发布",
    published: "已发布",
    rejected: "审核未通过",
    failed: "处理失败",
  };
  return map[status] ?? "未知状态";
}

/**
 * API 错误码转人类提示文案。
 */
export function errorCodeToMessage(code: string): string {
  const map: Record<string, string> = {
    QUOTA_EXCEEDED: "本月上传额度已用完，下月自动恢复",
    RATE_LIMITED: "操作太频繁，请稍后重试",
    AUTH_INVALID_KEY: "API Key 无效，请检查后重试",
    AUTH_ACCOUNT_DISABLED: "账号已被禁用，请联系支持",
    MODERATION_REJECTED: "内容审核未通过，请调整后再试",
  };
  return map[code] ?? "操作失败，请稍后重试";
}

/**
 * 增量数值文案与颜色建议。
 */
export function formatDelta(value: number): { text: string; color: "green" | "red" | "gray" } {
  if (value > 0) {
    return { text: `+${value.toFixed(1)}%`, color: "green" };
  }
  if (value < 0) {
    return { text: `${value.toFixed(1)}%`, color: "red" };
  }
  return { text: "0.0%", color: "gray" };
}
