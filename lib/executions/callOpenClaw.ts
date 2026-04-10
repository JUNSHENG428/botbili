import { createAdminClient } from '@/lib/supabase/server'

interface OpenClawPayload {
  recipe_id: string
  execution_id: string
  inputs: Record<string, unknown>
  callback_url: string
}

export async function callOpenClaw(payload: OpenClawPayload): Promise<void> {
  const apiKey = process.env.OPENCLAW_API_KEY
  const baseUrl = process.env.OPENCLAW_EXECUTE_URL ?? 'https://api.openclaw.ai'

  if (!apiKey) throw new Error('OPENCLAW_API_KEY is not set')

  const res = await fetch(`${baseUrl}/v1/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10_000),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`OpenClaw API error ${res.status}: ${text}`)
  }
}
