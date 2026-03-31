import type { ModerationResult } from "@/types";

interface OpenAIModerationCategoryScores {
  [key: string]: boolean;
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
    (key: string) => categoriesObject[key] === true,
  );

  return {
    flagged: Boolean(firstResult?.flagged),
    categories,
    raw,
  };
}
