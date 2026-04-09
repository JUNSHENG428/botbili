import { NextResponse } from "next/server";

import { verifyCsrfOrigin } from "@/lib/csrf";
import { createClientForServer, getSupabaseAdminClient } from "@/lib/supabase/server";

interface RouteContext {
  params: Promise<{ id: string; commentId: string }>;
}

function successResponse<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ success: true, data }, { status });
}

function errorResponse(message: string, code: string, status: number): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
      },
    },
    { status },
  );
}

async function resolveRecipe(identifier: string): Promise<{ id: string; author_id: string; status: string; visibility: string } | null> {
  const admin = getSupabaseAdminClient();
  const { data: byId, error: byIdError } = await admin
    .from("recipes")
    .select("id, author_id, status, visibility")
    .eq("id", identifier)
    .maybeSingle();

  if (byIdError) {
    throw new Error(`按 id 查询 Recipe 失败: ${byIdError.message}`);
  }

  if (byId) {
    return byId as { id: string; author_id: string; status: string; visibility: string };
  }

  const { data: bySlug, error: bySlugError } = await admin
    .from("recipes")
    .select("id, author_id, status, visibility")
    .eq("slug", identifier)
    .maybeSingle();

  if (bySlugError) {
    throw new Error(`按 slug 查询 Recipe 失败: ${bySlugError.message}`);
  }

  return (bySlug as { id: string; author_id: string; status: string; visibility: string } | null) ?? null;
}

function canViewRecipe(
  recipe: { author_id: string; status: string; visibility: string },
  userId?: string,
): boolean {
  if (userId && recipe.author_id === userId) {
    return true;
  }

  return recipe.status === "published" && recipe.visibility !== "private";
}

/**
 * curl -X POST "http://localhost:3000/api/recipes/RECIPE_ID/comments/COMMENT_ID/like" \
 *   -H "Origin: http://localhost:3000" \
 *   -H "Cookie: sb-xxx-auth-token=YOUR_SESSION_COOKIE"
 *
 * 说明：recipe_comment_likes 的 like_count 由数据库 trigger 自动维护。
 */
export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  if (!verifyCsrfOrigin(request)) {
    return errorResponse("请求来源校验失败", "CSRF_INVALID", 403);
  }

  try {
    const { id, commentId } = await context.params;
    if (!id || !commentId) {
      return errorResponse("评论标识不能为空", "INVALID_COMMENT_ID", 400);
    }

    const supabase = await createClientForServer();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse("请先登录", "UNAUTHORIZED", 401);
    }

    const recipe = await resolveRecipe(id);
    if (!recipe || !canViewRecipe(recipe, user.id)) {
      return errorResponse("Recipe 不存在", "RECIPE_NOT_FOUND", 404);
    }

    const admin = getSupabaseAdminClient();
    const { data: comment, error: commentError } = await admin
      .from("recipe_comments")
      .select("id, recipe_id, like_count")
      .eq("id", commentId)
      .maybeSingle();

    if (commentError) {
      throw new Error(`读取评论失败: ${commentError.message}`);
    }

    if (!comment || comment.recipe_id !== recipe.id) {
      return errorResponse("评论不存在", "COMMENT_NOT_FOUND", 404);
    }

    const { data: existingLike, error: existingError } = await admin
      .from("recipe_comment_likes")
      .select("id")
      .eq("comment_id", commentId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingError) {
      throw new Error(`读取点赞状态失败: ${existingError.message}`);
    }

    let liked = false;

    if (existingLike) {
      const { error } = await admin.from("recipe_comment_likes").delete().eq("id", existingLike.id);
      if (error) {
        throw new Error(`取消点赞失败: ${error.message}`);
      }
    } else {
      const { error } = await admin.from("recipe_comment_likes").insert({
        comment_id: commentId,
        user_id: user.id,
      });
      if (error) {
        throw new Error(`点赞失败: ${error.message}`);
      }
      liked = true;
    }

    const { data: refreshedComment, error: refreshedError } = await admin
      .from("recipe_comments")
      .select("like_count")
      .eq("id", commentId)
      .single();

    if (refreshedError) {
      throw new Error(`读取最新点赞数失败: ${refreshedError.message}`);
    }

    return successResponse({
      liked,
      like_count: refreshedComment.like_count ?? 0,
    });
  } catch (error: unknown) {
    console.error("POST /api/recipes/[id]/comments/[commentId]/like failed:", error);
    return errorResponse("评论点赞失败", "INTERNAL_ERROR", 500);
  }
}
