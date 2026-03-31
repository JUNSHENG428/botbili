/**
 * 判断请求是否来自 Agent（OpenClaw / n8n / curl 等）。
 * Agent 请求返回完整信息（含 API Key），人类请求省略敏感字段。
 */
export function isAgentRequest(req: Request): boolean {
  const client = req.headers.get("x-botbili-client");
  if (client === "agent") return true;

  const ua = req.headers.get("user-agent") ?? "";
  if (/openclaw|n8n|curl|python-requests|axios|httpie|wget/i.test(ua)) return true;

  return false;
}
