import { after, NextResponse } from "next/server";

import { verifyCsrfOrigin } from "@/lib/csrf";
import { awardPoints } from "@/lib/reputation";
import { recalculateRecipeStats } from "@/lib/recipe-stats";
import { createClientForServer, getSupabaseAdminClient } from "@/lib/supabase/server";
import type { Recipe } from "@/types/recipe";

interface RouteContext {
  params: Promise<{ id: string }>;
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

function slugifyTitle(title: string): string {
  const normalized = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "recipe";
}

async function buildUniqueSlug(title: string): Promise<string> {
  const admin = getSupabaseAdminClient();
  const base = slugifyTitle(title);

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const suffix = Math.random().toString(36).slice(2, 6);
    const slug = `${base}-${suffix}`;
    const { data, error } = await admin
      .from("recipes")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (error) {
      throw new Error(`检查 slug 冲突失败: ${error.message}`);
    }

    if (!data) {
      return slug;
    }
  }

  throw new Error("生成 fork slug 失败");
}

async function resolveRecipe(identifier: string): Promise<Recipe | null> {
  const admin = getSupabaseAdminClient();
  const { data: byId, error: byIdError } = await admin
    .from("recipes")
    .select("*")
    .eq("id", identifier)
    .maybeSingle();

  if (byIdError) {
    throw new Error(`按 id 查询 Recipe 失败: ${byIdError.message}`);
  }

  if (byId) {
    return byId as Recipe;
  }

  const { data: bySlug, error: bySlugError } = await admin
    .from("recipes")
    .select("*")
    .eq("slug", identifier)
    .maybeSingle();

  if (bySlugError) {
    throw new Error(`按 slug 查询 Recipe 失败: ${bySlugError.message}`);
  }

  return (bySlug as Recipe | null) ?? null;
}

/**
 * curl -X POST "http://localhost:3000/api/recipes/RECIPE_ID/fork" \
 *   -H "Origin: http://localhost:3000"
 */
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

    const sourceRecipe = await resolveRecipe(id);
    if (!sourceRecipe || sourceRecipe.status !== "published" || sourceRecipe.visibility === "private") {
      return errorResponse("Recipe 不存在", "RECIPE_NOT_FOUND", 404);
    }

    const sourceForkDepth = Math.max(0, sourceRecipe.fork_depth ?? 0);
    if (sourceForkDepth >= 10) {
      return errorResponse("Fork 深度已达上限，不能继续 Fork", "FORK_DEPTH_LIMIT", 400);
    }

    const forkTitle = `${sourceRecipe.title} (Fork)`;
    const forkSlug = await buildUniqueSlug(forkTitle);
    const admin = getSupabaseAdminClient();
    const authorType = request.headers.get("x-botbili-client") === "agent" ? "ai_agent" : "human";
    const platforms =
      Array.isArray(sourceRecipe.platforms) && sourceRecipe.platforms.length > 0
        ? sourceRecipe.platforms
        : sourceRecipe.platform;

    const { data: forkedRecipe, error: forkError } = await admin
      .from("recipes")
      .insert({
        author_id: user.id,
        author_type: authorType,
        title: forkTitle,
        slug: forkSlug,
        description: sourceRecipe.description,
        readme_md: sourceRecipe.readme_md,
        readme_json: sourceRecipe.readme_json,
        tags: sourceRecipe.tags,
        difficulty: sourceRecipe.difficulty,
        platform: platforms,
        platforms,
        language: sourceRecipe.language,
        cover_url: sourceRecipe.cover_url,
        script_template: sourceRecipe.script_template,
        storyboard: sourceRecipe.storyboard,
        matrix_config: sourceRecipe.matrix_config,
        tools_required: sourceRecipe.tools_required,
        forked_from: sourceRecipe.id,
        forked_from_id: sourceRecipe.id,
        fork_depth: sourceForkDepth + 1,
        status: "draft",
        visibility: "private",
        category: sourceRecipe.category,
      })
      .select("*")
      .single();

    if (forkError) {
      throw new Error(`创建 Fork 失败: ${forkError.message}`);
    }

    const { data: relationData, error: relationError } = await admin
      .from("recipe_forks")
      .insert({
        original_recipe_id: sourceRecipe.id,
        forked_recipe_id: forkedRecipe.id,
        user_id: user.id,
        forked_by: user.id,
      })
      .select("id")
      .single();

    if (relationError) {
      throw new Error(`写入 Fork 关系失败: ${relationError.message}`);
    }

    after(async () => {
      try {
        await recalculateRecipeStats(sourceRecipe.id);
        if (sourceRecipe.author_id !== user.id) {
          await awardPoints(sourceRecipe.author_id, 5, "recipe_got_fork", relationData.id);
        }
      } catch (postError) {
        console.error("POST /api/recipes/[id]/fork post-update failed:", postError);
      }
    });

    return successResponse({ recipe: forkedRecipe as Recipe }, 201);
  } catch (error: unknown) {
    console.error("POST /api/recipes/[id]/fork failed:", error);
    return errorResponse("Fork Recipe 失败", "INTERNAL_ERROR", 500);
  }
}
