import { DEFAULT_OPENAI_MODEL } from '@/lib/agent/config'
import { createDatabaseId } from '@/lib/db/ids'
import { getSupabaseAdminClient } from '@/lib/db/supabase-admin'
import { createCreatedAtTimestamp } from '@/lib/db/timestamps'

export const MODEL_PRICING_CENTS_PER_MILLION = {
  [DEFAULT_OPENAI_MODEL]: { input: 5, output: 40 },
  'gpt-5.4-nano': { input: 20, output: 125 },
  'gpt-5-mini': { input: 25, output: 200 },
  'gpt-5': { input: 125, output: 1000 },
  'gpt-5.4': { input: 250, output: 1500 },
  'gpt-5.4-mini': { input: 75, output: 450 },
} as const

export function getModelPricing(model: string): { input: number; output: number } {
  return MODEL_PRICING_CENTS_PER_MILLION[model as keyof typeof MODEL_PRICING_CENTS_PER_MILLION]
    ?? MODEL_PRICING_CENTS_PER_MILLION[DEFAULT_OPENAI_MODEL]
}

export function calculateUsageCostCents(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = getModelPricing(model)

  return Math.ceil(
    (inputTokens / 1_000_000) * pricing.input
    + (outputTokens / 1_000_000) * pricing.output,
  )
}

export async function trackApiUsage(params: {
  userId: string
  sessionId?: string
  model: string
  inputTokens: number
  outputTokens: number
  endpoint: 'agent' | 'rewriter' | 'ocr' | 'gap_analysis' | 'target_resume'
}): Promise<void> {
  const supabase = getSupabaseAdminClient()
  const totalTokens = params.inputTokens + params.outputTokens
  const costCents = calculateUsageCostCents(params.model, params.inputTokens, params.outputTokens)

  try {
    await supabase.from('api_usage').insert({
      id: createDatabaseId(),
      ...createCreatedAtTimestamp(),
      user_id: params.userId,
      session_id: params.sessionId ?? null,
      model: params.model,
      input_tokens: params.inputTokens,
      output_tokens: params.outputTokens,
      total_tokens: totalTokens,
      cost_cents: costCents,
      endpoint: params.endpoint,
    })
  } catch (error) {
    console.error('[usage-tracker] Failed to track usage:', error)
  }
}
