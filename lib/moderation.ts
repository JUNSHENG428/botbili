import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { ModerationResult } from "@/types";

interface OpenAIModerationCategoryScores {
  [key: string]: number;
}

interface OpenAIModerationItem {
  flagged?: boolean;
  categories?: OpenAIModerationCategoryScores;
}

interface OpenAIModerationResponse {
  results?: OpenAIModerationItem[];
}

/**
 * 调用 OpenAI Moderation API 审核文本。
 */
export async function moderateText(text: string): Promise<ModerationResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing required env: OPENAI_API_KEY");
  }

  const response = await fetch("https://api.openai.com/v1/moderations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "omni-moderation-latest",
      input: text,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI moderation failed: ${response.status} ${errorBody}`);
  }

  const raw = (await response.json()) as OpenAIModerationResponse;
  const firstResult = raw.results?.[0];
  const categoriesObject = firstResult?.categories ?? {};
  const categories = Object.keys(categoriesObject).filter(
    (key: string) => (categoriesObject[key] as number) > 0.5,
  );

  return {
    flagged: Boolean(firstResult?.flagged),
    categories,
    raw,
  };
}

/**
 * 调用 OpenAI Moderation API 审核图像。
 */
export async function moderateImage(imageUrl: string): Promise<ModerationResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing required env: OPENAI_API_KEY");
  }

  const response = await fetch("https://api.openai.com/v1/moderations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "omni-moderation-latest",
      input: [{ type: "image_url", image_url: { url: imageUrl } }],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI image moderation failed: ${response.status} ${errorBody}`);
  }

  const raw = (await response.json()) as OpenAIModerationResponse;
  const firstResult = raw.results?.[0];
  const categoriesObject = firstResult?.categories ?? {};
  const categories = Object.keys(categoriesObject).filter(
    (key: string) => (categoriesObject[key] as number) > 0.5,
  );

  return {
    flagged: Boolean(firstResult?.flagged),
    categories,
    raw,
  };
}

/**
 * 将审核结果写入 moderation_logs 表。
 */
export async function logModerationResult(
  videoId: string,
  checkType: string,
  result: ModerationResult,
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("moderation_logs").insert({
    video_id: videoId,
    check_type: checkType,
    flagged: result.flagged,
    categories: result.categories,
    raw_result: result.raw,
  });

  if (error) {
    // 记录日志失败不应中断主流程，仅输出错误
    console.error(`logModerationResult failed for video ${videoId}:`, error.message);
  }
}
