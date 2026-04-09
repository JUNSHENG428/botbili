import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-response";
import { forkRecipe } from "@/lib/recipes";
import { createClientForServer } from "@/lib/supabase/server";
import type { Recipe } from "@/types/recipe";

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface ForkRecipeResponse {
  data: Recipe;
}

/**
 * POST /api/recipes/[id]/fork
 * Requires authentication. Creates a fork of the recipe.
 */
export async function POST(
  _request: Request,
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

    const forked = await forkRecipe(id, user.id);
    const response: ForkRecipeResponse = { data: forked };
    return NextResponse.json(response, { status: 201 });
  } catch (error: unknown) {
    console.error("POST /api/recipes/[id]/fork failed:", error);
    return apiErrorResponse({ message: "Internal server error", code: "INTERNAL_ERROR", status: 500 });
  }
}
