import { NextResponse } from "next/server";

import { verifyCsrfOrigin } from "@/lib/csrf";
import { createClientForServer, getSupabaseAdminClient } from "@/lib/supabase/server";
import type { RecipeComment } from "@/types/recipe";

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface ProfileRow {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

interface CreatorRow {
  owner_id: string;
  slug: string | null;
  name: string;
  avatar_url: string | null;
}

interface RecipeCommentRow extends RecipeComment {
  author: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    author_type: "human" | "ai_agent";
  };
  viewer_liked?: boolean;
  replies: RecipeCommentRow[];
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const VALID_COMMENT_TYPES = ["question", "feedback", "optimization", "matrix", "bug"] as const;

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

function parsePositiveInteger(rawValue: string | null, fallback: number, max?: number): number | null {
  if (rawValue === null || rawValue === "") {
    return fallback;
  }

  const value = Number.parseInt(rawValue, 10);
  if (Number.isNaN(value) || value < 1) {
    return null;
  }

  if (typeof max === "number") {
    return Math.min(value, max);
  }

  return value;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolveRecipe(identifier: string): Promise<{ id: string; author_id: string; status: string; visibility: string } | null> {
  const admin = getSupabaseAdminClient();
  // 非 UUID 则跳过 id 查询
  let byId: Record<string, unknown> | null = null;
  if (UUID_RE.test(identifier)) {
    const { data, error: byIdError } = await admin
      .from("recipes")
      .select("id, author_id, status, visibility")
      .eq("id", identifier)
      .maybeSingle();

    if (byIdError) {
      throw new Error(`按 id 查询 Recipe 失败: ${byIdError.message}`);
    }
    byId = data as typeof byId;
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

async function buildAuthorMap(
  comments: Array<{ user_id: string }>,
): Promise<Map<string, RecipeCommentRow["author"]>> {
  const userIds = [...new Set(comments.map((comment) => comment.user_id))];
  const authorMap = new Map<string, RecipeCommentRow["author"]>();

  if (userIds.length === 0) {
    return authorMap;
  }

  const admin = getSupabaseAdminClient();
  const [{ data: profiles, error: profileError }, { data: creators, error: creatorError }] = await Promise.all([
    admin.from("profiles").select("id, username, display_name, avatar_url").in("id", userIds),
    admin.from("creators").select("owner_id, slug, name, avatar_url").in("owner_id", userIds),
  ]);

  if (profileError) {
    throw new Error(`加载评论作者 profile 失败: ${profileError.message}`);
  }

  if (creatorError) {
    throw new Error(`加载评论作者 creator 失败: ${creatorError.message}`);
  }

  const profileMap = new Map<string, ProfileRow>();
  for (const row of (profiles ?? []) as ProfileRow[]) {
    profileMap.set(row.id, row);
  }

  const creatorMap = new Map<string, CreatorRow>();
  for (const row of (creators ?? []) as CreatorRow[]) {
    if (!creatorMap.has(row.owner_id)) {
      creatorMap.set(row.owner_id, row);
    }
  }

  for (const userId of userIds) {
    const profile = profileMap.get(userId);
    const creator = creatorMap.get(userId);
    authorMap.set(userId, {
      username:
        profile?.username?.trim() ||
        creator?.slug?.trim() ||
        profile?.display_name?.trim()?.toLowerCase().replace(/\s+/g, "-") ||
        `user-${userId.slice(0, 8)}`,
      display_name: profile?.display_name ?? creator?.name ?? null,
      avatar_url: profile?.avatar_url ?? creator?.avatar_url ?? null,
      author_type: creator ? "ai_agent" : "human",
    });
  }

  return authorMap;
}

/**
 * curl "http://localhost:3000/api/recipes/RECIPE_ID/comments?page=1&limit=20"
 * curl -X POST "http://localhost:3000/api/recipes/RECIPE_ID/comments" \
 *   -H "Content-Type: application/json" \
 *   -H "Origin: http://localhost:3000" \
 *   -d '{"content":"这个 Recipe 很适合视频号矩阵，想问下封面变量如何配置？","comment_type":"question"}'
 */
export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    if (!id) {
      return errorResponse("Recipe 标识不能为空", "INVALID_RECIPE_ID", 400);
    }

    const supabase = await createClientForServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const recipe = await resolveRecipe(id);
    if (!recipe || !canViewRecipe(recipe, user?.id)) {
      return errorResponse("Recipe 不存在", "RECIPE_NOT_FOUND", 404);
    }

    const { searchParams } = new URL(request.url);
    const page = parsePositiveInteger(searchParams.get("page"), 1);
    const limit = parsePositiveInteger(searchParams.get("limit"), DEFAULT_LIMIT, MAX_LIMIT);

    if (page === null) {
      return errorResponse("page 必须是大于 0 的整数", "INVALID_PAGE", 400);
    }

    if (limit === null) {
      return errorResponse("limit 必须是大于 0 的整数", "INVALID_LIMIT", 400);
    }

    const admin = getSupabaseAdminClient();
    const offset = (page - 1) * limit;
    const { data: topLevelComments, error: topLevelError, count } = await admin
      .from("recipe_comments")
      .select("*", { count: "exact" })
      .eq("recipe_id", recipe.id)
      .is("parent_id", null)
      .order("is_pinned", { ascending: false })
      .order("like_count", { ascending: false })
      .order("created_at", { ascending: true })
      .range(offset, offset + limit - 1);

    if (topLevelError) {
      throw new Error(`读取顶层评论失败: ${topLevelError.message}`);
    }

    const topLevelRows = (topLevelComments ?? []) as RecipeComment[];
    const topLevelIds = topLevelRows.map((comment) => comment.id);

    const { data: replyRows, error: replyError } = topLevelIds.length
      ? await admin
          .from("recipe_comments")
          .select("*")
          .in("parent_id", topLevelIds)
          .order("created_at", { ascending: true })
      : { data: [], error: null };

    if (replyError) {
      throw new Error(`读取评论回复失败: ${replyError.message}`);
    }

    const replies = (replyRows ?? []) as RecipeComment[];
    const authorMap = await buildAuthorMap([...topLevelRows, ...replies]);
    const allCommentIds = [...topLevelRows, ...replies].map((comment) => comment.id);
    const likedIdSet = new Set<string>();

    if (user?.id && allCommentIds.length > 0) {
      const { data: likedRows, error: likedError } = await admin
        .from("recipe_comment_likes")
        .select("comment_id")
        .eq("user_id", user.id)
        .in("comment_id", allCommentIds);

      if (likedError) {
        throw new Error(`读取评论点赞状态失败: ${likedError.message}`);
      }

      for (const row of likedRows ?? []) {
        likedIdSet.add(row.comment_id as string);
      }
    }

    const replyMap = new Map<string, RecipeCommentRow[]>();
    for (const reply of replies) {
      const parentId = reply.parent_id;
      if (!parentId) {
        continue;
      }

      const existingReplies = replyMap.get(parentId) ?? [];
      existingReplies.push({
        ...reply,
        author: authorMap.get(reply.user_id) ?? {
          username: `user-${reply.user_id.slice(0, 8)}`,
          display_name: null,
          avatar_url: null,
          author_type: "human",
        },
        viewer_liked: likedIdSet.has(reply.id),
        replies: [],
      });
      replyMap.set(parentId, existingReplies);
    }

    const comments: RecipeCommentRow[] = topLevelRows.map((comment) => ({
      ...comment,
      author: authorMap.get(comment.user_id) ?? {
        username: `user-${comment.user_id.slice(0, 8)}`,
        display_name: null,
        avatar_url: null,
        author_type: "human",
      },
      viewer_liked: likedIdSet.has(comment.id),
      replies: replyMap.get(comment.id) ?? [],
    }));

    return successResponse({
      comments,
      total: count ?? 0,
    });
  } catch (error: unknown) {
    console.error("GET /api/recipes/[id]/comments failed:", error);
    return errorResponse("获取评论列表失败", "INTERNAL_ERROR", 500);
  }
}

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  if (!verifyCsrfOrigin(request)) {
    return errorResponse("请求来源校验失败", "CSRF_INVALID", 403);
  }

  try {
    const { id } = await context.params;
    if (!id) {
      return errorResponse("Recipe 标识不能为空", "INVALID_RECIPE_ID", 400);
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
    if (!recipe || (recipe.status !== "published" && recipe.author_id !== user.id)) {
      return errorResponse("Recipe 不存在", "RECIPE_NOT_FOUND", 404);
    }

    let body: {
      content?: string;
      parent_id?: string;
      comment_type?: string;
    };

    try {
      body = (await request.json()) as {
        content?: string;
        parent_id?: string;
        comment_type?: string;
      };
    } catch {
      return errorResponse("请求体不是合法 JSON", "INVALID_JSON", 400);
    }

    const content = body.content?.trim() ?? "";
    if (content.length < 10) {
      return errorResponse("评论内容至少需要 10 个字", "CONTENT_TOO_SHORT", 400);
    }

    if (content.length > 2000) {
      return errorResponse("评论内容不能超过 2000 个字", "CONTENT_TOO_LONG", 400);
    }

    const admin = getSupabaseAdminClient();
    let commentType = body.comment_type ?? "question";
    let parentId: string | null = null;

    if (body.parent_id) {
      const { data: parentComment, error: parentError } = await admin
        .from("recipe_comments")
        .select("id, recipe_id, parent_id, comment_type")
        .eq("id", body.parent_id)
        .maybeSingle();

      if (parentError) {
        throw new Error(`读取父评论失败: ${parentError.message}`);
      }

      if (!parentComment || parentComment.recipe_id !== recipe.id) {
        return errorResponse("父评论不存在", "PARENT_COMMENT_NOT_FOUND", 404);
      }

      if (parentComment.parent_id) {
        return errorResponse("当前仅支持两级评论", "COMMENT_DEPTH_EXCEEDED", 400);
      }

      parentId = parentComment.id as string;
      commentType = body.comment_type ?? (parentComment.comment_type as string);
    }

    if (!VALID_COMMENT_TYPES.includes(commentType as (typeof VALID_COMMENT_TYPES)[number])) {
      return errorResponse("comment_type 不合法", "INVALID_COMMENT_TYPE", 400);
    }

    const { data: insertedComment, error: insertError } = await admin
      .from("recipe_comments")
      .insert({
        recipe_id: recipe.id,
        user_id: user.id,
        parent_id: parentId,
        content,
        comment_type: commentType,
      })
      .select("*")
      .single();

    if (insertError) {
      throw new Error(`创建评论失败: ${insertError.message}`);
    }

    const authorMap = await buildAuthorMap([{ user_id: user.id }]);

    return successResponse(
      {
        comment: {
          ...(insertedComment as RecipeComment),
          author: authorMap.get(user.id) ?? {
            username: `user-${user.id.slice(0, 8)}`,
            display_name: null,
            avatar_url: null,
            author_type: "human",
          },
          viewer_liked: false,
          replies: [],
        },
      },
      201,
    );
  } catch (error: unknown) {
    console.error("POST /api/recipes/[id]/comments failed:", error);
    return errorResponse("创建评论失败", "INTERNAL_ERROR", 500);
  }
}
