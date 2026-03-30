import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PLANS } from '@/lib/plans'
import { checkUserQuota, consumeCredit, grantCredits, revokeSubscription } from './quota'
import { getSupabaseAdminClient } from '@/lib/db/supabase-admin'

vi.mock('@/lib/db/supabase-admin', () => ({
  getSupabaseAdminClient: vi.fn(),
}))

const creditAccountUpsert = vi.fn()
const creditAccountSingle = vi.fn()
const creditAccountUpdateSelect = vi.fn()
const userQuotaUpsert = vi.fn()
const userQuotaUpdateEq = vi.fn()
const userQuotaUpdate = vi.fn()
const userQuotaSelectEq = vi.fn()
const userQuotaSelect = vi.fn()

const mockSupabase = {
  rpc: vi.fn(),
  from: vi.fn((table: string) => {
    if (table === 'credit_accounts') {
      return {
        upsert: creditAccountUpsert,
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: creditAccountSingle,
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              select: creditAccountUpdateSelect,
            })),
          })),
        })),
      }
    }

    if (table === 'user_quotas') {
      return {
        upsert: userQuotaUpsert,
        update: userQuotaUpdate,
        select: userQuotaSelect,
      }
    }

    throw new Error(`Unexpected table: ${table}`)
  }),
}

describe('quota credit source of truth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getSupabaseAdminClient).mockReturnValue(
      mockSupabase as unknown as ReturnType<typeof getSupabaseAdminClient>,
    )

    creditAccountUpsert.mockResolvedValue({ error: null })
    creditAccountSingle.mockResolvedValue({ data: { credits_remaining: 3 } })
    creditAccountUpdateSelect.mockResolvedValue({ data: [{ credits_remaining: 2 }], error: null })
    userQuotaUpsert.mockResolvedValue({ error: null })
    userQuotaUpdateEq.mockResolvedValue({ error: null })
    userQuotaUpdate.mockReturnValue({
      eq: userQuotaUpdateEq,
    })
    userQuotaSelectEq.mockReturnValue({
      returns: vi.fn().mockResolvedValue({ data: [{ user_id: 'usr_123' }], error: null }),
    })
    userQuotaSelect.mockReturnValue({
      eq: userQuotaSelectEq,
    })
    mockSupabase.rpc.mockResolvedValue({ data: true, error: null })
  })

  it('grants credits through credit_accounts and stores metadata only in user_quotas', async () => {
    await grantCredits('usr_123', 'monthly', 'sub_123')

    expect(creditAccountUpsert).toHaveBeenCalledWith(
      {
        id: 'cred_usr_123',
        user_id: 'usr_123',
        credits_remaining: PLANS.monthly.credits,
      },
      { onConflict: 'user_id' },
    )

    const [quotaPayload] = userQuotaUpsert.mock.calls[0]
    expect(quotaPayload).toMatchObject({
      user_id: 'usr_123',
      plan: 'monthly',
      asaas_subscription_id: 'sub_123',
      status: 'active',
    })
    expect(quotaPayload).not.toHaveProperty('credits_remaining')
  })

  it('checks quota from credit_accounts only', async () => {
    await expect(checkUserQuota('usr_123')).resolves.toBe(true)
    expect(mockSupabase.from).toHaveBeenCalledWith('credit_accounts')
  })

  it('marks subscriptions canceled without revoking remaining credits', async () => {
    await revokeSubscription('sub_123')

    expect(userQuotaUpdate).toHaveBeenCalledWith({
      renews_at: null,
      status: 'canceled',
    })
    expect(creditAccountUpsert).not.toHaveBeenCalled()
  })

  it('uses the atomic rpc result when available', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: true, error: null })

    await expect(consumeCredit('usr_123')).resolves.toBe(true)
    expect(mockSupabase.rpc).toHaveBeenCalledWith('consume_credit_atomic', {
      p_user_id: 'usr_123',
    })
  })

  it('handles concurrent fallback consumption requests safely', async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: null,
      error: { message: 'function consume_credit_atomic does not exist' },
    })
    creditAccountSingle.mockResolvedValue({ data: { credits_remaining: 1 } })
    creditAccountUpdateSelect
      .mockResolvedValueOnce({ data: [{ credits_remaining: 0 }], error: null })
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [], error: null })

    const results = await Promise.all(Array.from({ length: 5 }, () => consumeCredit('usr_123')))

    expect(results.filter(Boolean)).toHaveLength(1)
    expect(creditAccountUpdateSelect).toHaveBeenCalledTimes(5)
  })
})
