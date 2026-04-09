import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-response";
import { getExecution } from "@/lib/recipes";
import { createClientForServer } from "@/lib/supabase/server";
import type { RecipeExecution } from "@/types/recipe";

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface GetExecutionResponse {
  data: RecipeExecution;
}

/**
 * GET /api/executions/[id]
 * Requires authentication. Only the execution owner can view it.
 */
export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    if (!id) {
      return apiErrorResponse({ message: "Invalid execution id", code: "VALIDATION_EXECUTION_ID_INVALID", status: 400 });
    }

    const supabase = await createClientForServer();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return apiErrorResponse({ message: "Unauthorized", code: "AUTH_UNAUTHORIZED", status: 401 });
    }

    const execution = await getExecution(id);
    if (!execution) {
      return apiErrorResponse({ message: "Execution not found", code: "RESOURCE_NOT_FOUND", status: 404 });
    }

    // Only the owner can view their execution
    if (execution.user_id !== user.id) {
      return apiErrorResponse({ message: "Forbidden: you do not own this execution", code: "AUTH_FORBIDDEN", status: 403 });
    }

    const response: GetExecutionResponse = { data: execution };
    return NextResponse.json(response);
  } catch (error: unknown) {
    console.error("GET /api/executions/[id] failed:", error);
    return apiErrorResponse({ message: "Internal server error", code: "INTERNAL_ERROR", status: 500 });
  }
}
