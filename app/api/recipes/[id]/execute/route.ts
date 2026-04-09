import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-response";
import { createExecution } from "@/lib/recipes";
import { createClientForServer } from "@/lib/supabase/server";
import type { RecipeExecution } from "@/types/recipe";

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface CreateExecutionResponse {
  data: RecipeExecution;
}

/**
 * POST /api/recipes/[id]/execute
 * Requires authentication.
 * Body: { input_overrides? }
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

    let body: Record<string, unknown> = {};
    try {
      const text = await request.text();
      if (text.trim()) {
        body = JSON.parse(text);
      }
    } catch {
      return apiErrorResponse({ message: "Invalid request body", code: "VALIDATION_INVALID_BODY", status: 400 });
    }

    const inputOverrides = body.input_overrides as Record<string, unknown> | undefined;

    const execution = await createExecution(id, user.id, inputOverrides);
    const response: CreateExecutionResponse = { data: execution };
    return NextResponse.json(response, { status: 201 });
  } catch (error: unknown) {
    console.error("POST /api/recipes/[id]/execute failed:", error);
    return apiErrorResponse({ message: "Internal server error", code: "INTERNAL_ERROR", status: 500 });
  }
}
