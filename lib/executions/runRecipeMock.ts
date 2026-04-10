import { updateExecutionById } from "@/lib/executions/updateExecution";
import type { RecipeExecutionOutput } from "@/types/recipe";

type ExecutionStatus =
  | "running"
  | "script_done"
  | "edit_done"
  | "publishing"
  | "success"
  | "failed";

interface ExecutionStep {
  delayMs: number;
  status: Exclude<ExecutionStatus, "failed">;
  progressPct: number;
}

const EXECUTION_STEPS: ExecutionStep[] = [
  { delayMs: 500, status: "running", progressPct: 10 },
  { delayMs: 1500, status: "script_done", progressPct: 35 },
  { delayMs: 3000, status: "edit_done", progressPct: 65 },
  { delayMs: 4500, status: "publishing", progressPct: 85 },
  { delayMs: 6000, status: "success", progressPct: 100 },
];

function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

/**
 * 在同一个 Node.js 进程内模拟 Recipe 执行过程。
 * 说明：这是第一期闭环验证用 mock，不依赖队列。
 */
export async function runRecipeMock(executionId: string): Promise<void> {
  const seed = executionId.slice(0, 8);

  try {
    let previousDelay = 0;

    for (const step of EXECUTION_STEPS) {
      await sleep(step.delayMs - previousDelay);
      previousDelay = step.delayMs;

      if (step.status === "success") {
        const now = new Date().toISOString();
        const mockOutput: RecipeExecutionOutput = {
          platform: "bilibili",
          video_url: "https://www.bilibili.com/video/BV1xx411c7mD",
          title: `Mock 执行结果 - ${now}`,
          thumbnail_url: "https://picsum.photos/seed/botbili/1280/720",
          published_at: now,
        };

        await updateExecutionById(executionId, {
          status: "success",
          progress_pct: 100,
          output: mockOutput,
          output_external_url: mockOutput.video_url,
          output_thumbnail_url: mockOutput.thumbnail_url ?? `https://picsum.photos/seed/${seed}/320/180`,
          output_platform: mockOutput.platform,
          completed_at: now,
          error_message: null,
        });
        console.info(`[runRecipeMock] execution ${executionId} -> success`);
        return;
      }

      await updateExecutionById(executionId, {
        status: step.status,
        progress_pct: step.progressPct,
        error_message: null,
      });
      console.info(`[runRecipeMock] execution ${executionId} -> ${step.status} (${step.progressPct}%)`);
    }
  } catch (error) {
    console.error(`[runRecipeMock] execution ${executionId} failed:`, error);
    try {
      await updateExecutionById(executionId, {
        status: "failed",
        progress_pct: 100,
        error_message: error instanceof Error ? error.message : "执行流程异常终止",
        output_external_url: null,
        output_thumbnail_url: null,
        output_platform: null,
        output: null,
      });
    } catch (updateError) {
      console.error(`[runRecipeMock] failed to mark execution ${executionId} as failed:`, updateError);
    }
  }
}
