import { NextResponse } from "next/server";

import { extractBearerToken, hashApiKey } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/api-response";
import { getSuggestions } from "@/lib/suggestions";
import { verifyApiKey } from "@/lib/upload-repository";
import type { ApiError } from "@/types";

/**
 * GET /api/suggest
 * 
 * 获取选题建议
 * 
 * Query 参数:
 * - niche: 领域（如"科技"、"娱乐"等），可选
 * - count: 建议数量（默认 5，最大 10）
 * 
 * Headers:
 * - Authorization: Bearer bb_xxx（可选，带了会结合频道历史数据）
 * 
 * 返回示例:
 * {
 *   "niche": "科技",
 *   "suggestions": [
 *     {
 *       "topic": "GPT-5 发布后一周：开发者真实体验",
 *       "reason": "GPT-5 是本周上升最快的话题，已有 5 个视频覆盖但仍供不应求",
 *       "related_tags": ["GPT-5", "开发者", "体验"],
 *       "competition": "medium",
 *       "estimated_views": "300-800",
 *       "reference_videos": [...]
 *     }
 *   ],
 *   "generated_at": "2026-04-01T12:00:00Z"
 * }
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const niche = searchParams.get("niche") ?? undefined;
    const count = Math.min(10, Math.max(1, parseInt(searchParams.get("count") ?? "5", 10)));

    // 可选：获取 API Key 用于个性化推荐
    const authHeader = request.headers.get("Authorization");
    const token = extractBearerToken(authHeader);
    
    let creatorId: string | undefined;
    if (token) {
      const keyHash = hashApiKey(token);
      const creator = await verifyApiKey(keyHash);
      if (creator) {
        creatorId = creator.id;
      }
    }

    const suggestions = await getSuggestions(niche, count, creatorId);

    return NextResponse.json(suggestions);
  } catch (error: unknown) {
    console.error("GET /api/suggest failed:", error);
    return apiErrorResponse({
      message: "Internal server error",
      code: "INTERNAL_ERROR",
      status: 500,
    });
  }
}
