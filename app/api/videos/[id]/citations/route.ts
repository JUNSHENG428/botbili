import { NextResponse } from "next/server";

import { extractBearerToken, hashApiKey } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/api-response";
import {
  createCitations,
  getVideoCitedBy,
  getVideoReferences,
} from "@/lib/citations";
import {
  creatorOwnsVideo,
  getPublishedVideoIds,
  verifyApiKey,
} from "@/lib/upload-repository";
import type { ApiError } from "@/types";

/**
 * GET /api/videos/{id}/citations
 * 
 * 获取视频的引用信息
 * - cited_by: 被谁引用了
 * - references: 引用了谁
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;

    const [citedBy, references] = await Promise.all([
      getVideoCitedBy(id),
      getVideoReferences(id),
    ]);

    return NextResponse.json({
      video_id: id,
      cited_by: citedBy.map((c) => ({
        citation_id: c.id,
        video_id: c.video.id,
        title: c.video.title,
        thumbnail_url: c.video.thumbnail_url,
        creator: c.video.creator,
        context: c.context,
        created_at: c.created_at,
      })),
      references: references.map((c) => ({
        citation_id: c.id,
        video_id: c.video.id,
        title: c.video.title,
        thumbnail_url: c.video.thumbnail_url,
        creator: c.video.creator,
        context: c.context,
        created_at: c.created_at,
      })),
      stats: {
        cited_by_count: citedBy.length,
        references_count: references.length,
      },
    });
  } catch (error: unknown) {
    console.error("GET /api/videos/[id]/citations failed:", error);
    return apiErrorResponse({
      message: "Internal server error",
      code: "INTERNAL_ERROR",
      status: 500,
    });
  }
}

/**
 * POST /api/videos/{id}/citations
 * 
 * 添加引用（当前视频引用了其他视频）
 * 需要 API Key 认证
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

    const body = await request.json();
    const { citations } = body as {
      citations?: Array<{
        video_id: string;
        context?: string;
      }>;
    };

    if (!citations || !Array.isArray(citations) || citations.length === 0) {
      return apiErrorResponse({
        message: "citations array is required",
        code: "VALIDATION_MISSING_FIELD",
        status: 400,
      });
    }

    // 验证引用数量
    if (citations.length > 10) {
      return apiErrorResponse({
        message: "Maximum 10 citations per video",
        code: "VALIDATION_TOO_MANY_CITATIONS",
        status: 400,
      });
    }

    // 不能引用自己
    const selfCite = citations.find((c) => c.video_id === id);
    if (selfCite) {
      return apiErrorResponse({
        message: "Cannot cite yourself",
        code: "VALIDATION_SELF_CITATION",
        status: 400,
      });
    }

    const ownsVideo = await creatorOwnsVideo(id, creator.id);
    if (!ownsVideo) {
      return apiErrorResponse({
        message: "You can only manage citations for your own videos",
        code: "VIDEO_FORBIDDEN",
        status: 403,
      });
    }

    const citedVideoIds = Array.from(new Set(citations.map((citation) => citation.video_id.trim())));
    const publishedVideoIds = await getPublishedVideoIds(citedVideoIds);

    if (publishedVideoIds.length !== citedVideoIds.length) {
      return apiErrorResponse({
        message: "One or more cited videos do not exist or are not published",
        code: "CITATION_TARGET_INVALID",
        status: 400,
      });
    }

    const created = await createCitations(
      id,
      citations.map((c) => ({
        video_id: c.video_id,
        context: c.context,
      }))
    );

    return NextResponse.json({
      video_id: id,
      citations_added: created.length,
      citations: created.map((c) => ({
        id: c.id,
        cited_video_id: c.cited_video_id,
        context: c.context,
        created_at: c.created_at,
      })),
    });
  } catch (error: unknown) {
    console.error("POST /api/videos/[id]/citations failed:", error);
    
    if ((error as Error).message.includes("Cannot cite yourself")) {
      return apiErrorResponse({
        message: (error as Error).message,
        code: "VALIDATION_SELF_CITATION",
        status: 400,
      });
    }

    if ((error as Error).message === "You can only manage citations for your own videos") {
      return apiErrorResponse({
        message: "You can only manage citations for your own videos",
        code: "VIDEO_FORBIDDEN",
        status: 403,
      });
    }

    return apiErrorResponse({
      message: "Internal server error",
      code: "INTERNAL_ERROR",
      status: 500,
    });
  }
}
