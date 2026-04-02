/**
 * 判断请求是否来自 Agent（OpenClaw / n8n / curl 等）。
 *
 * 注意：此函数仅用于区分响应格式（Agent 看到 API Key，人类不看到）。
 * 不应作为权限判断依据——Agent 和人类走不同的认证路径，但权限不因此不同。
 */
export function isAgentRequest(req: Request): boolean {
  // 只信任显式声明的 header，不再基于 User-Agent 猜测
  const client = req.headers.get("x-botbili-client");
  return client === "agent";
}
