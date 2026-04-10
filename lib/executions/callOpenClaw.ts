/**
 * callOpenClaw.ts
 *
 * 架构说明：
 * OpenClaw 是用户本地 Agent，botbili 服务器无法主动连接用户设备。
 * 正确模型：
 *   1. botbili 把 execution 置为 pending，返回 execution_id
 *   2. 用户本地的 openclaw CLI 主动 GET /api/executions/{id} 拿到任务
 *   3. openclaw 在本地执行，完成后 POST /api/executions/{id}/callback 回写结果
 *
 * 本函数只做：记录日志 + 确认执行记录已置为 pending（幂等检查）
 */

import { updateExecutionById } from '@/lib/executions/updateExecution'

export interface OpenClawPayload {
  recipe_id: string
  execution_id: string
  inputs: Record<string, unknown>
  callback_url: string
}

export async function callOpenClaw(payload: OpenClawPayload): Promise<void> {
  // botbili 无法主动调用用户本地的 OpenClaw Gateway
  // execution 已在 POST /api/recipes/[id]/execute 里创建为 pending 状态
  // 此处只做状态确认，等待 openclaw CLI 主动来领任务
  console.info(
    `[callOpenClaw] execution ${payload.execution_id} is pending. ` +
    `Waiting for openclaw CLI to pick up recipe ${payload.recipe_id}. ` +
    `Callback URL: ${payload.callback_url}`
  )

  // 确保状态是 pending（防止调用方已经改成 running 导致不一致）
  await updateExecutionById(payload.execution_id, {
    status: 'pending',
    progress_pct: 0,
    error_message: null,
  })
}
