import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-response";
import {
  calculateInfluenceScore,
  getCachedInfluenceScore,
  getInfluenceLevel,
} from "@/lib/influence";
import type { ApiError } from "@/types";

/**
 * GET /api/creators/{id}/influence
 * 
 * 获取创作者的影响力指数
 * 包含：综合分数、各维度分数、原始指标、等级
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;

    // 先尝试获取缓存的分数
    let score = await getCachedInfluenceScore(id);

    // 如果没有缓存或缓存过期，重新计算
    if (!score) {
      score = await calculateInfluenceScore(id);
    }

    const level = getInfluenceLevel(score.overall_score);

    return NextResponse.json({
      creator_id: id,
      score: {
        overall: score.overall_score,
        citation: score.citation_score,
        follower: score.follower_score,
        rating: score.rating_score,
        stability: score.stability_score,
      },
      level: {
        name: level.level,
        emoji: level.emoji,
        description: level.description,
      },
      metrics: score.raw_metrics,
      updated_at: score.updated_at,
    });
  } catch (error: unknown) {
    console.error("GET /api/creators/[id]/influence failed:", error);

    if ((error as Error).message === "Creator not found") {
      return apiErrorResponse({
        message: "Creator not found",
        code: "CREATOR_NOT_FOUND",
        status: 404,
      });
    }

    return apiErrorResponse({
      message: "Internal server error",
      code: "INTERNAL_ERROR",
      status: 500,
    });
  }
}
