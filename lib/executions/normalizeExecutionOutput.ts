import type {
  RecipeExecutionOutput,
  RecipeExecutionOutputSource,
  VideoPlatform,
} from "@/types/recipe";

const VIDEO_PLATFORMS: VideoPlatform[] = [
  "bilibili",
  "youtube",
  "douyin",
  "kuaishou",
  "xiaohongshu",
  "other",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isVideoPlatform(value: unknown): value is VideoPlatform {
  return typeof value === "string" && VIDEO_PLATFORMS.includes(value as VideoPlatform);
}

function isValidUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeTitle(value: unknown, fallbackTitle: string): string {
  if (typeof value !== "string") {
    return fallbackTitle;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallbackTitle;
}

function normalizeOptionalUrl(value: unknown, fieldName: string): string | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value !== "string" || !isValidUrl(value)) {
    throw new Error(`${fieldName} 必须是合法 URL`);
  }

  return value;
}

function normalizeOptionalIsoTime(value: unknown, fieldName: string): string | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw new Error(`${fieldName} 必须是 ISO 时间字符串`);
  }

  return value;
}

function normalizeOptionalViewCount(value: unknown): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error("view_count 必须是非负整数");
  }

  return value;
}

function normalizeOptionalPlatformVideoId(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new Error("platform_video_id 必须是字符串");
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error("platform_video_id 必须是非空字符串");
  }

  return trimmed;
}

function hasOutputFields(body: Record<string, unknown>): boolean {
  return [
    "output",
    "platform",
    "video_url",
    "title",
    "thumbnail_url",
    "gif_url",
    "published_at",
    "view_count",
    "platform_video_id",
    "output_external_url",
    "output_thumbnail_url",
    "output_platform",
  ].some((field) => body[field] !== undefined && body[field] !== null && body[field] !== "");
}

/**
 * 把数据库里的 output 字段和冗余列统一成一个前端可消费的结构。
 */
export function normalizeExecutionOutput(
  source: RecipeExecutionOutputSource,
  fallbackTitle = "执行产出",
): RecipeExecutionOutput | null {
  const platformCandidate = source.output?.platform ?? source.output_platform;
  const videoUrlCandidate = source.output?.video_url ?? source.output_external_url;

  if (!isVideoPlatform(platformCandidate)) {
    return null;
  }

  if (typeof videoUrlCandidate !== "string" || !isValidUrl(videoUrlCandidate)) {
    return null;
  }

  const normalized: RecipeExecutionOutput = {
    platform: platformCandidate,
    video_url: videoUrlCandidate,
    title: normalizeTitle(source.output?.title ?? source.title, fallbackTitle),
  };

  const thumbnailUrl = source.output?.thumbnail_url ?? source.output_thumbnail_url;
  if (typeof thumbnailUrl === "string" && isValidUrl(thumbnailUrl)) {
    normalized.thumbnail_url = thumbnailUrl;
  }

  const gifUrl = source.output?.gif_url ?? source.gif_url;
  if (typeof gifUrl === "string" && isValidUrl(gifUrl)) {
    normalized.gif_url = gifUrl;
  }

  const publishedAtCandidate =
    source.output?.published_at ?? source.published_at ?? source.completed_at ?? source.updated_at;
  if (typeof publishedAtCandidate === "string" && !Number.isNaN(Date.parse(publishedAtCandidate))) {
    normalized.published_at = publishedAtCandidate;
  }

  const viewCountCandidate = source.output?.view_count ?? source.view_count;
  if (
    typeof viewCountCandidate === "number" &&
    Number.isInteger(viewCountCandidate) &&
    viewCountCandidate >= 0
  ) {
    normalized.view_count = viewCountCandidate;
  }

  const platformVideoIdCandidate = source.output?.platform_video_id ?? source.platform_video_id;
  if (typeof platformVideoIdCandidate === "string" && platformVideoIdCandidate.trim().length > 0) {
    normalized.platform_video_id = platformVideoIdCandidate.trim();
  }

  return normalized;
}

export function parseExecutionOutputPayload(
  payload: unknown,
  options: {
    required?: boolean;
    fallbackTitle?: string;
  } = {},
): RecipeExecutionOutput | null {
  if (!isRecord(payload)) {
    if (options.required) {
      throw new Error("请求体必须是对象");
    }
    return null;
  }

  const nestedOutput = payload.output;
  if (nestedOutput !== undefined && nestedOutput !== null && !isRecord(nestedOutput)) {
    throw new Error("output 必须是对象");
  }

  const nested = isRecord(nestedOutput) ? nestedOutput : undefined;
  if (!hasOutputFields(payload) && !nested) {
    if (options.required) {
      throw new Error("缺少执行产出字段");
    }
    return null;
  }

  const platformValue = nested?.platform ?? payload.output_platform ?? payload.platform;
  if (!isVideoPlatform(platformValue)) {
    throw new Error("platform 非法");
  }

  const videoUrlValue = nested?.video_url ?? payload.output_external_url ?? payload.video_url;
  if (typeof videoUrlValue !== "string" || !isValidUrl(videoUrlValue)) {
    throw new Error("video_url 必须是合法 URL");
  }

  const output: RecipeExecutionOutput = {
    platform: platformValue,
    video_url: videoUrlValue,
    title: normalizeTitle(nested?.title ?? payload.title, options.fallbackTitle ?? "执行产出"),
  };

  const thumbnailUrl = normalizeOptionalUrl(
    nested?.thumbnail_url ?? payload.output_thumbnail_url ?? payload.thumbnail_url,
    "thumbnail_url",
  );
  if (thumbnailUrl) {
    output.thumbnail_url = thumbnailUrl;
  }

  const gifUrl = normalizeOptionalUrl(nested?.gif_url ?? payload.gif_url, "gif_url");
  if (gifUrl) {
    output.gif_url = gifUrl;
  }

  const publishedAt = normalizeOptionalIsoTime(nested?.published_at ?? payload.published_at, "published_at");
  if (publishedAt) {
    output.published_at = publishedAt;
  }

  const viewCount = normalizeOptionalViewCount(nested?.view_count ?? payload.view_count);
  if (typeof viewCount === "number") {
    output.view_count = viewCount;
  }

  const platformVideoId = normalizeOptionalPlatformVideoId(
    nested?.platform_video_id ?? payload.platform_video_id,
  );
  if (platformVideoId) {
    output.platform_video_id = platformVideoId;
  }

  return output;
}

export function getExecutionOutputColumns(output: RecipeExecutionOutput | null): {
  output: RecipeExecutionOutput | null;
  output_external_url: string | null;
  output_thumbnail_url: string | null;
  output_platform: VideoPlatform | null;
} {
  if (!output) {
    return {
      output: null,
      output_external_url: null,
      output_thumbnail_url: null,
      output_platform: null,
    };
  }

  return {
    output,
    output_external_url: output.video_url,
    output_thumbnail_url: output.thumbnail_url ?? null,
    output_platform: output.platform,
  };
}
