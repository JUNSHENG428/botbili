import type { CloudflareUploadResult, CloudflareVideoStatus } from "@/types";

interface CloudflareErrorItem {
  message?: string;
}

interface CloudflareCopyResponse {
  success?: boolean;
  result?: {
    uid?: string;
  };
  errors?: CloudflareErrorItem[];
}

function getCloudflareConfig(): {
  accountId: string;
  apiToken: string;
  customerSubdomain: string;
} {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const customerSubdomain = process.env.CLOUDFLARE_CUSTOMER_SUBDOMAIN;

  if (!accountId || !apiToken || !customerSubdomain) {
    throw new Error(
      "Missing required env: CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN / CLOUDFLARE_CUSTOMER_SUBDOMAIN",
    );
  }

  return { accountId, apiToken, customerSubdomain };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve: () => void) => {
    setTimeout(resolve, ms);
  });
}

function buildEmbedUrl(uid: string, customerSubdomain: string): string {
  // customerSubdomain 可能是完整域名或仅 subdomain 部分
  if (customerSubdomain.includes("cloudflarestream.com")) {
    return `https://${customerSubdomain}/${uid}/iframe`;
  }
  return `https://customer-${customerSubdomain}.cloudflarestream.com/${uid}/iframe`;
}

async function uploadVideoByUrlOnce(videoUrl: string): Promise<CloudflareUploadResult> {
  const { accountId, apiToken, customerSubdomain } = getCloudflareConfig();
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/copy`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiToken}`,
    },
    body: JSON.stringify({
      url: videoUrl,
      meta: { name: "botbili-upload" },
    }),
  });

  const data = (await response.json()) as CloudflareCopyResponse;
  const uid = data.result?.uid;

  if (!response.ok || !data.success || !uid) {
    const cloudflareError = data.errors?.[0]?.message ?? "Cloudflare upload failed";
    throw new Error(`${response.status} ${cloudflareError}`);
  }

  return {
    uid,
    playbackUrl: buildEmbedUrl(uid, customerSubdomain),
  };
}

/**
 * 使用 URL 推送到 Cloudflare Stream，失败后自动重试 1 次（2 秒间隔）。
 */
export async function uploadVideoByUrl(videoUrl: string): Promise<CloudflareUploadResult> {
  try {
    return await uploadVideoByUrlOnce(videoUrl);
  } catch (firstError) {
    await sleep(2000);
    try {
      return await uploadVideoByUrlOnce(videoUrl);
    } catch (secondError) {
      const firstMessage = firstError instanceof Error ? firstError.message : "unknown";
      const secondMessage = secondError instanceof Error ? secondError.message : "unknown";
      throw new Error(`Cloudflare upload retry failed: first=${firstMessage}; second=${secondMessage}`);
    }
  }
}

/**
 * 根据 uid 获取 Cloudflare Stream 视频处理状态。
 */
export async function getVideoStatus(uid: string): Promise<CloudflareVideoStatus> {
  const { accountId, apiToken } = getCloudflareConfig();
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${uid}`;

  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Cloudflare get status failed: ${response.status}`);
  }

  const data = (await response.json()) as {
    result?: {
      uid?: string;
      readyToStream?: boolean;
      status?: { state?: string };
      duration?: number;
      thumbnail?: string;
    };
  };

  return {
    uid: data.result?.uid ?? uid,
    readyToStream: Boolean(data.result?.readyToStream),
    state: data.result?.status?.state ?? "unknown",
    duration: data.result?.duration ?? null,
    thumbnail: data.result?.thumbnail ?? null,
  };
}

/**
 * 对外暴露 Cloudflare iframe 播放地址拼接。
 */
export function getEmbedUrl(uid: string): string {
  const { customerSubdomain } = getCloudflareConfig();
  return buildEmbedUrl(uid, customerSubdomain);
}

export interface DirectUploadResult {
  uid: string;
  uploadURL: string;
  playbackUrl: string;
}

/**
 * 创建 Cloudflare Stream Direct Upload URL。
 * Agent 可用返回的 uploadURL 直接 POST 文件（multipart/form-data）。
 * maxDurationSeconds 默认 600（10 分钟）。
 */
export async function createDirectUpload(
  maxDurationSeconds = 600,
): Promise<DirectUploadResult> {
  const { accountId, apiToken, customerSubdomain } = getCloudflareConfig();
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/direct_upload`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiToken}`,
    },
    body: JSON.stringify({
      maxDurationSeconds,
      meta: { name: "botbili-direct-upload" },
    }),
  });

  const data = (await response.json()) as {
    success?: boolean;
    result?: { uid?: string; uploadURL?: string };
    errors?: CloudflareErrorItem[];
  };

  if (!response.ok || !data.success || !data.result?.uid || !data.result?.uploadURL) {
    const msg = data.errors?.[0]?.message ?? "Cloudflare direct upload creation failed";
    throw new Error(`${response.status} ${msg}`);
  }

  return {
    uid: data.result.uid,
    uploadURL: data.result.uploadURL,
    playbackUrl: buildEmbedUrl(data.result.uid, customerSubdomain),
  };
}
