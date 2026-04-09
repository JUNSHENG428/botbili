import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-response";
import { createRecipe, listRecipes } from "@/lib/recipes";
import { createClientForServer } from "@/lib/supabase/server";
import type { Recipe } from "@/types/recipe";

interface ListRecipesResponse {
  data: Recipe[];
  total: number;
  page: number;
  page_size: number;
}

interface CreateRecipeResponse {
  data: Recipe;
}

/**
 * GET /api/recipes
 * Query params: sort, page, page_size, tag, difficulty, platform
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);

    const sort = searchParams.get("sort") ?? "trending";
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const pageSize = parseInt(searchParams.get("page_size") ?? "20", 10);
    const tag = searchParams.get("tag") ?? undefined;
    const difficulty = searchParams.get("difficulty") ?? undefined;
    const platform = searchParams.get("platform") ?? undefined;

    if (isNaN(page) || page < 1) {
      return apiErrorResponse({ message: "Invalid page parameter", code: "VALIDATION_INVALID_PAGE", status: 400 });
    }
    if (isNaN(pageSize) || pageSize < 1 || pageSize > 100) {
      return apiErrorResponse({ message: "Invalid page_size parameter", code: "VALIDATION_INVALID_PAGE_SIZE", status: 400 });
    }

    const { recipes, total } = await listRecipes({
      sort,
      page,
      pageSize,
      tag,
      difficulty,
      platform,
    });

    const response: ListRecipesResponse = {
      data: recipes,
      total,
      page,
      page_size: pageSize,
    };

    return NextResponse.json(response);
  } catch (error: unknown) {
    console.error("GET /api/recipes failed:", error);
    return apiErrorResponse({ message: "Internal server error", code: "INTERNAL_ERROR", status: 500 });
  }
}

/**
 * POST /api/recipes
 * Requires authentication.
 * author_type is determined from X-BotBili-Client header.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
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

    const { title } = body;
    if (!title || typeof title !== "string" || title.trim() === "") {
      return apiErrorResponse({ message: "title is required", code: "VALIDATION_TITLE_REQUIRED", status: 400 });
    }

    const clientHeader = request.headers.get("X-BotBili-Client");
    const authorType: "human" | "ai_agent" = clientHeader === "ai_agent" ? "ai_agent" : "human";

    const recipe = await createRecipe({
      author_id: user.id,
      author_type: authorType,
      title: body.title as string,
      description: body.description as string | undefined,
      readme_md: body.readme_md as string | undefined,
      tags: (body.tags as string[] | undefined) ?? [],
      difficulty: body.difficulty as "beginner" | "intermediate" | "advanced" | undefined,
      platform: (body.platform as string[] | undefined) ?? [],
      cover_url: body.cover_url as string | undefined,
      script_template: body.script_template as Record<string, unknown> | undefined,
      storyboard: body.storyboard as Recipe["storyboard"] | undefined,
      matrix_config: body.matrix_config as Record<string, unknown> | undefined,
      tools_required: (body.tools_required as string[] | undefined) ?? [],
      status: body.status as Recipe["status"] | undefined,
    });

    const response: CreateRecipeResponse = { data: recipe };
    return NextResponse.json(response, { status: 201 });
  } catch (error: unknown) {
    console.error("POST /api/recipes failed:", error);
    return apiErrorResponse({ message: "Internal server error", code: "INTERNAL_ERROR", status: 500 });
  }
}
