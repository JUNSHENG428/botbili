import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-response";
import { toggleStar } from "@/lib/recipes";
import { createClientForServer } from "@/lib/supabase/server";

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface ToggleStarResponse {
  starred: boolean;
  star_count: number;
}

/**
 * POST /api/recipes/[id]/star
 * Requires authentication. Toggles star on the recipe.
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

    const result = await toggleStar(id, user.id);
    const response: ToggleStarResponse = result;
    return NextResponse.json(response);
  } catch (error: unknown) {
    console.error("POST /api/recipes/[id]/star failed:", error);
    return apiErrorResponse({ message: "Internal server error", code: "INTERNAL_ERROR", status: 500 });
  }
}
