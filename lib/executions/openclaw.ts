import type { Recipe } from "@/types/recipe";

import { runRecipeMock } from "@/lib/executions/runRecipeMock";

type ExecutionDriver = "mock" | "openclaw";

interface StartExecutionInput {
  executionId: string;
  recipe: Recipe;
  commandPreview: string;
  inputOverrides?: Record<string, unknown> | null;
}

function getExecutionDriver(): ExecutionDriver {
  return process.env.BOTBILI_EXECUTION_DRIVER === "openclaw" ? "openclaw" : "mock";
}

/**
 * 根据环境变量选择执行后端：
 * - mock（默认）：调用 runRecipeMock，由 USE_MOCK_EXECUTION 决定是本地模拟还是挂起等待
 * - openclaw：已废弃，与 mock 行为一致（保留此选项仅向后兼容）
 *
 * 架构说明：
 * OpenClaw 是用户本地 Agent，botbili 服务器无法主动连接。
 * 正确流程：
 *   1. botbili 创建 execution 为 pending 状态
 *   2. 用户本地 openclaw CLI 主动 GET /api/executions/{id} 领取任务
 *   3. openclaw 本地执行完成后 POST callback 回写结果
 */
export async function startRecipeExecution(input: StartExecutionInput): Promise<ExecutionDriver> {
  const driver = getExecutionDriver();

  // 无论 driver 是什么，都走 runRecipeMock
  // runRecipeMock 内部根据 USE_MOCK_EXECUTION 决定是模拟还是挂起等待
  void runRecipeMock(
    input.executionId,
    input.recipe.id,
    input.inputOverrides ?? {}
  ).catch((error) => {
    console.error("runRecipeMock failed:", error);
  });

  return driver;
}
