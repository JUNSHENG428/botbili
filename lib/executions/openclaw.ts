import type { Recipe } from "@/types/recipe";

import { runRecipeMock } from "@/lib/executions/runRecipeMock";

type ExecutionDriver = "mock" | "openclaw";

interface StartExecutionInput {
  executionId: string;
  recipe: Recipe;
  commandPreview: string;
  inputOverrides?: Record<string, unknown> | null;
}

interface OpenClawDispatchBody {
  execution_id: string;
  recipe_id: string;
  recipe_slug: string;
  recipe_title: string;
  recipe_description: string | null;
  command_preview: string;
  input_overrides: Record<string, unknown> | null;
  callback: {
    url: string;
    secret: string;
    method: "POST";
  };
  recipe: {
    readme_json: Recipe["readme_json"];
    script_template: Recipe["script_template"];
    matrix_config: Recipe["matrix_config"];
    platforms: string[];
    difficulty: Recipe["difficulty"];
    author_type: Recipe["author_type"];
  };
}

function getExecutionDriver(): ExecutionDriver {
  return process.env.BOTBILI_EXECUTION_DRIVER === "openclaw" ? "openclaw" : "mock";
}

function getAppBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

function getRequiredOpenClawConfig(): {
  executeUrl: string;
  callbackSecret: string;
  apiKey: string | null;
} {
  const executeUrl = process.env.OPENCLAW_EXECUTE_URL?.trim();
  const callbackSecret = process.env.OPENCLAW_CALLBACK_SECRET?.trim();

  if (!executeUrl) {
    throw new Error("缺少 OPENCLAW_EXECUTE_URL");
  }
  if (!callbackSecret) {
    throw new Error("缺少 OPENCLAW_CALLBACK_SECRET");
  }

  return {
    executeUrl,
    callbackSecret,
    apiKey: process.env.OPENCLAW_API_KEY?.trim() || null,
  };
}

function buildDispatchBody(input: StartExecutionInput, callbackSecret: string): OpenClawDispatchBody {
  return {
    execution_id: input.executionId,
    recipe_id: input.recipe.id,
    recipe_slug: input.recipe.slug,
    recipe_title: input.recipe.title,
    recipe_description: input.recipe.description,
    command_preview: input.commandPreview,
    input_overrides: input.inputOverrides ?? null,
    callback: {
      url: `${getAppBaseUrl()}/api/executions/${input.executionId}/callback`,
      secret: callbackSecret,
      method: "POST",
    },
    recipe: {
      readme_json: input.recipe.readme_json,
      script_template: input.recipe.script_template,
      matrix_config: input.recipe.matrix_config,
      platforms: input.recipe.platforms?.length ? input.recipe.platforms : input.recipe.platform,
      difficulty: input.recipe.difficulty,
      author_type: input.recipe.author_type,
    },
  };
}

async function dispatchToOpenClaw(input: StartExecutionInput): Promise<void> {
  const { executeUrl, callbackSecret, apiKey } = getRequiredOpenClawConfig();
  const body = buildDispatchBody(input, callbackSecret);

  const response = await fetch(executeUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`OpenClaw dispatch failed: ${response.status} ${errorText}`.trim());
  }
}

/**
 * 根据环境变量选择执行后端：
 * - mock（默认）：本进程内推进 execution 状态
 * - openclaw：提交到外部执行器，由 callback 回写状态
 */
export async function startRecipeExecution(input: StartExecutionInput): Promise<ExecutionDriver> {
  const driver = getExecutionDriver();

  if (driver === "mock") {
    void runRecipeMock(
      input.executionId,
      input.recipe.id,
      input.inputOverrides ?? {}
    ).catch((error) => {
      console.error("runRecipeMock failed:", error);
    });
    return "mock";
  }

  await dispatchToOpenClaw(input);
  return "openclaw";
}
