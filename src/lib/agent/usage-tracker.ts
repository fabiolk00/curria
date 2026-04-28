import { AsyncLocalStorage } from 'node:async_hooks'

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

type ApiUsageInput = {
  userId: string
  sessionId?: string
  model: string
  inputTokens: number
  outputTokens: number
  endpoint: 'agent' | 'rewriter' | 'ocr' | 'gap_analysis' | 'target_resume'
}

type BufferedApiUsage = ApiUsageInput & {
  callCount: number
}

const apiUsageBufferStorage = new AsyncLocalStorage<Map<string, BufferedApiUsage>>()

function buildUsageBufferKey(params: ApiUsageInput): string {
  return [
    params.userId,
    params.sessionId ?? '',
    params.model,
  ].join(':')
}

async function persistApiUsageEntries(entries: ApiUsageInput[]): Promise<void> {
  if (entries.length === 0) {
    return
  }

  const supabase = getSupabaseAdminClient()
  const now = createCreatedAtTimestamp()

  try {
    await supabase.from('api_usage').insert(entries.map((params) => {
      const totalTokens = params.inputTokens + params.outputTokens
      const costCents = calculateUsageCostCents(params.model, params.inputTokens, params.outputTokens)

      return {
        id: createDatabaseId(),
        ...now,
        user_id: params.userId,
        session_id: params.sessionId ?? null,
        model: params.model,
        input_tokens: params.inputTokens,
        output_tokens: params.outputTokens,
        total_tokens: totalTokens,
        cost_cents: costCents,
        endpoint: params.endpoint,
      }
    }))
  } catch (error) {
    console.error('[usage-tracker] Failed to track usage:', error)
  }
}

export async function flushBufferedApiUsage(): Promise<void> {
  const buffer = apiUsageBufferStorage.getStore()
  if (!buffer || buffer.size === 0) {
    return
  }

  const entries = Array.from(buffer.values()).map(({ callCount: _callCount, ...entry }) => entry)
  buffer.clear()
  await persistApiUsageEntries(entries)
}

export async function runWithApiUsageBuffer<T>(run: () => Promise<T>): Promise<T> {
  return apiUsageBufferStorage.run(new Map(), async () => {
    try {
      return await run()
    } finally {
      await flushBufferedApiUsage()
    }
  })
}

export async function trackApiUsage(params: ApiUsageInput): Promise<void> {
  const buffer = apiUsageBufferStorage.getStore()
  if (buffer) {
    const key = buildUsageBufferKey(params)
    const existing = buffer.get(key)
    buffer.set(key, existing
      ? {
          ...existing,
          inputTokens: existing.inputTokens + params.inputTokens,
          outputTokens: existing.outputTokens + params.outputTokens,
          endpoint: existing.endpoint === params.endpoint ? existing.endpoint : 'agent',
          callCount: existing.callCount + 1,
        }
      : {
          ...params,
          callCount: 1,
        })
    return
  }

  await persistApiUsageEntries([params])
}
