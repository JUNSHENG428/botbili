import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-response";
import { getRecipeById, updateRecipe } from "@/lib/recipes";
import { createClientForServer } from "@/lib/supabase/server";
import type { Recipe, RecipeDetail } from "@/types/recipe";

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface GetRecipeResponse {
  data: RecipeDetail;
}

interface UpdateRecipeResponse {
  data: Recipe;
}

/**
 * GET /api/recipes/[id]
 * Public. Passes viewerUserId if authenticated to get starred/saved status.
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

    // Attempt to get session for viewer status — optional, not required
    let viewerUserId: string | undefined;
    try {
      const supabase = await createClientForServer();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      viewerUserId = user?.id;
    } catch {
      // No session — proceed as anonymous
    }

    const recipe = await getRecipeById(id, viewerUserId);
    if (!recipe) {
      return apiErrorResponse({ message: "Recipe not found", code: "RESOURCE_NOT_FOUND", status: 404 });
    }

    const response: GetRecipeResponse = { data: recipe };
    return NextResponse.json(response);
  } catch (error: unknown) {
    console.error("GET /api/recipes/[id] failed:", error);
    return apiErrorResponse({ message: "Internal server error", code: "INTERNAL_ERROR", status: 500 });
  }
}

/**
 * PATCH /api/recipes/[id]
 * Requires authentication. Only the recipe author can update.
 */
export async function PATCH(
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

    // updateRecipe verifies author identity and returns null if unauthorized or not found
    const updated = await updateRecipe(id, user.id, body);
    if (updated === null) {
      // Could be not found or not the author — check if it exists first
      const existing = await getRecipeById(id);
      if (!existing) {
        return apiErrorResponse({ message: "Recipe not found", code: "RESOURCE_NOT_FOUND", status: 404 });
      }
      return apiErrorResponse({ message: "Forbidden: you are not the author", code: "AUTH_FORBIDDEN", status: 403 });
    }

    const response: UpdateRecipeResponse = { data: updated };
    return NextResponse.json(response);
  } catch (error: unknown) {
    console.error("PATCH /api/recipes/[id] failed:", error);
    return apiErrorResponse({ message: "Internal server error", code: "INTERNAL_ERROR", status: 500 });
  }
}
