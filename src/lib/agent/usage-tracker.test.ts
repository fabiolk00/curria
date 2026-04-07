import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DEFAULT_OPENAI_MODEL } from '@/lib/agent/config'
import { getSupabaseAdminClient } from '@/lib/db/supabase-admin'

import {
  MODEL_PRICING_CENTS_PER_MILLION,
  getModelPricing,
  trackApiUsage,
} from './usage-tracker'

vi.mock('@/lib/db/supabase-admin', () => ({
  getSupabaseAdminClient: vi.fn(),
}))

const insert = vi.fn()

describe('usage tracker pricing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn(() => ({
        insert,
      })),
    } as unknown as ReturnType<typeof getSupabaseAdminClient>)
    insert.mockResolvedValue(null)
  })

  it('tracks the default standardized model using the pricing table', async () => {
    await trackApiUsage({
      userId: 'usr_123',
      model: DEFAULT_OPENAI_MODEL,
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
      endpoint: 'agent',
    })

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: expect.any(String),
        created_at: expect.any(String),
        model: DEFAULT_OPENAI_MODEL,
        cost_cents:
          MODEL_PRICING_CENTS_PER_MILLION[DEFAULT_OPENAI_MODEL].input
          + MODEL_PRICING_CENTS_PER_MILLION[DEFAULT_OPENAI_MODEL].output,
      }),
    )
  })

  it('falls back unknown models to the standardized default pricing', () => {
    expect(getModelPricing('unknown-model')).toEqual(
      MODEL_PRICING_CENTS_PER_MILLION[DEFAULT_OPENAI_MODEL],
    )
  })
})
