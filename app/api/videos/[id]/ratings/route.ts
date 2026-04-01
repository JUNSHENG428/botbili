import { NextResponse } from "next/server";

import { extractBearerToken, hashApiKey } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/api-response";
import {
  createRating,
  getCreatorRating,
  getVideoRatingStats,
  getVideoRatings,
} from "@/lib/ratings";
import { verifyApiKey } from "@/lib/upload-repository";
import type { ApiError } from "@/types";

/**
 * GET /api/videos/{id}/ratings
 * 
 * 获取视频的评价列表和统计
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;

    const [ratings, stats] = await Promise.all([
      getVideoRatings(id),
      getVideoRatingStats(id),
    ]);

    return NextResponse.json({
      video_id: id,
      stats: stats ?? {
        video_id: id,
        avg_relevance: 0,
        avg_accuracy: 0,
        avg_novelty: 0,
        overall_score: 0,
        ratings_count: 0,
      },
      ratings: ratings.map((r) => ({
        id: r.id,
        creator: r.creator,
        relevance: r.relevance,
        accuracy: r.accuracy,
        novelty: r.novelty,
        overall: Math.round(((r.relevance + r.accuracy + r.novelty) / 3) * 10) / 10,
        comment: r.comment,
        created_at: r.created_at,
      })),
    });
  } catch (error: unknown) {
    console.error("GET /api/videos/[id]/ratings failed:", error);
    return apiErrorResponse({
      message: "Internal server error",
      code: "INTERNAL_ERROR",
      status: 500,
    });
  }
}

/**
 * POST /api/videos/{id}/ratings
 * 
 * 创建评价
 * 需要 API Key 认证
 * 
 * Request body:
 * {
 *   "relevance": 4,    // 1-5 相关性
 *   "accuracy": 5,     // 1-5 准确性
 *   "novelty": 3,      // 1-5 创新性
 *   "comment": "..."   // 可选评价
 * }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;

    // 验证 API Key
    const authHeader = request.headers.get("Authorization");
    const token = extractBearerToken(authHeader);

    if (!token) {
      return apiErrorResponse({
        message: "Missing API key",
        code: "AUTH_MISSING",
        status: 401,
      });
    }

    const keyHash = hashApiKey(token);
    const creator = await verifyApiKey(keyHash);

    if (!creator) {
      return apiErrorResponse({
        message: "Invalid API key",
        code: "AUTH_INVALID_KEY",
        status: 401,
      });
    }

    // 检查是否已评价
    const existingRating = await getCreatorRating(creator.id, id);
    if (existingRating) {
      return apiErrorResponse({
        message: "You have already rated this video",
        code: "RATING_ALREADY_EXISTS",
        status: 409,
      });
    }

    const body = await request.json();
    const { relevance, accuracy, novelty, comment } = body as {
      relevance?: number;
      accuracy?: number;
      novelty?: number;
      comment?: string;
    };

    // 验证必填字段
    if (
      relevance === undefined ||
      accuracy === undefined ||
      novelty === undefined
    ) {
      return apiErrorResponse({
        message: "relevance, accuracy, and novelty are required",
        code: "VALIDATION_MISSING_FIELD",
        status: 400,
      });
    }

    // 验证评分范围
    const scores = [relevance, accuracy, novelty];
    if (scores.some((s) => s < 1 || s > 5 || !Number.isInteger(s))) {
      return apiErrorResponse({
        message: "Ratings must be integers between 1 and 5",
        code: "VALIDATION_INVALID_RATING",
        status: 400,
      });
    }

    const rating = await createRating(creator.id, id, {
      relevance,
      accuracy,
      novelty,
      comment,
    });

    return NextResponse.json(
      {
        rating_id: rating.id,
        video_id: id,
        creator_id: creator.id,
        relevance: rating.relevance,
        accuracy: rating.accuracy,
        novelty: rating.novelty,
        overall: Math.round(((relevance + accuracy + novelty) / 3) * 10) / 10,
        comment: rating.comment,
        created_at: rating.created_at,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("POST /api/videos/[id]/ratings failed:", error);

    if ((error as Error).message.includes("already rated")) {
      return apiErrorResponse({
        message: (error as Error).message,
        code: "RATING_ALREADY_EXISTS",
        status: 409,
      });
    }

    if ((error as Error).message.includes("integers between 1 and 5")) {
      return apiErrorResponse({
        message: (error as Error).message,
        code: "VALIDATION_INVALID_RATING",
        status: 400,
      });
    }

    return apiErrorResponse({
      message: "Internal server error",
      code: "INTERNAL_ERROR",
      status: 500,
    });
  }
}
