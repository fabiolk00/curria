import { beforeEach, describe, expect, it, vi } from 'vitest'

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

  it('tracks gpt-5-nano usage using the cheapest configured pricing table', async () => {
    await trackApiUsage({
      userId: 'usr_123',
      model: 'gpt-5-nano',
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
      endpoint: 'agent',
    })

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-5-nano',
        cost_cents:
          MODEL_PRICING_CENTS_PER_MILLION['gpt-5-nano'].input
          + MODEL_PRICING_CENTS_PER_MILLION['gpt-5-nano'].output,
      }),
    )
  })

  it('falls back unknown models to gpt-5-nano pricing', () => {
    expect(getModelPricing('unknown-model')).toEqual(
      MODEL_PRICING_CENTS_PER_MILLION['gpt-5-nano'],
    )
  })
})
