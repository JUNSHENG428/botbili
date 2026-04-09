import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-response";
import { createComment, listComments } from "@/lib/recipes";
import { createClientForServer } from "@/lib/supabase/server";
import type { RecipeComment } from "@/types/recipe";

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface ListCommentsResponse {
  data: RecipeComment[];
  total: number;
  page: number;
}

interface CreateCommentResponse {
  data: RecipeComment;
}

/**
 * GET /api/recipes/[id]/comments
 * Public. Query params: page (default 1).
 */
export async function GET(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    if (!id) {
      return apiErrorResponse({ message: "Invalid recipe id", code: "VALIDATION_RECIPE_ID_INVALID", status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") ?? "1", 10);

    if (isNaN(page) || page < 1) {
      return apiErrorResponse({ message: "Invalid page parameter", code: "VALIDATION_INVALID_PAGE", status: 400 });
    }

    const { comments, total } = await listComments(id, page);
    const response: ListCommentsResponse = { data: comments, total, page };
    return NextResponse.json(response);
  } catch (error: unknown) {
    console.error("GET /api/recipes/[id]/comments failed:", error);
    return apiErrorResponse({ message: "Internal server error", code: "INTERNAL_ERROR", status: 500 });
  }
}

/**
 * POST /api/recipes/[id]/comments
 * Requires authentication.
 * Body: { content, parent_id?, comment_type? }
 */
export async function POST(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    if (!id) {
      return apiErrorResponse({ message: "Invalid recipe id", code: "VALIDATION_RECIPE_ID_INVALID", status: 400 });
    }

    const supabase = await createClientForServer();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return apiErrorResponse({ message: "Unauthorized", code: "AUTH_UNAUTHORIZED", status: 401 });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return apiErrorResponse({ message: "Invalid request body", code: "VALIDATION_INVALID_BODY", status: 400 });
    }

    const { content } = body;
    if (!content || typeof content !== "string" || content.trim() === "") {
      return apiErrorResponse({ message: "content is required", code: "VALIDATION_CONTENT_REQUIRED", status: 400 });
    }

    const comment = await createComment({
      recipe_id: id,
      user_id: user.id,
      content: body.content as string,
      parent_id: body.parent_id as string | undefined,
      comment_type: (body.comment_type as string | undefined) ?? "general",
    });

    const response: CreateCommentResponse = { data: comment };
    return NextResponse.json(response, { status: 201 });
  } catch (error: unknown) {
    console.error("POST /api/recipes/[id]/comments failed:", error);
    return apiErrorResponse({ message: "Internal server error", code: "INTERNAL_ERROR", status: 500 });
  }
}
