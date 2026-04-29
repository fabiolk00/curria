import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getSupabaseAdminClient } from '@/lib/db/supabase-admin'

import {
  createCheckoutRecordPending,
  getCheckoutByAsaasSessionId,
  getCheckoutBySubscriptionId,
  getCheckoutRecord,
  markCheckoutCreated,
  markCheckoutFailed,
  markCheckoutPaid,
  markCheckoutSubscriptionActive,
} from './billing-checkouts'

vi.mock('@/lib/db/supabase-admin', () => ({
  getSupabaseAdminClient: vi.fn(),
}))

const insertSingle = vi.fn()
const insertSelect = vi.fn(() => ({ single: insertSingle }))
const insert = vi.fn(() => ({ select: insertSelect }))
const updateEq = vi.fn()
const update = vi.fn(() => ({ eq: updateEq }))
const maybeSingle = vi.fn()
const selectEq = vi.fn(() => ({ maybeSingle }))
const selectIlike = vi.fn(() => ({ maybeSingle }))

const mockSupabase = {
  from: vi.fn(() => ({
    insert,
    update,
    select: vi.fn(() => ({
      eq: selectEq,
      ilike: selectIlike,
    })),
  })),
}

describe('billing checkout lifecycle helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getSupabaseAdminClient).mockReturnValue(
      mockSupabase as unknown as ReturnType<typeof getSupabaseAdminClient>,
    )
    insertSingle.mockResolvedValue({
      data: {
        id: 'bc_123',
        user_id: 'usr_123',
        checkout_reference: 'chk_123',
        plan: 'monthly',
        amount_minor: 3900,
        currency: 'BRL',
        status: 'pending',
        asaas_link: null,
        asaas_payment_id: null,
        asaas_subscription_id: null,
        created_at: '2026-03-29T00:00:00.000Z',
        updated_at: '2026-03-29T00:00:00.000Z',
      },
      error: null,
    })
    updateEq.mockResolvedValue({ error: null })
    maybeSingle.mockResolvedValue({
      data: {
        id: 'bc_123',
        user_id: 'usr_123',
        checkout_reference: 'chk_123',
        plan: 'monthly',
        amount_minor: 3900,
        currency: 'BRL',
        status: 'created',
        asaas_link: 'https://asaas.test/pay',
        asaas_payment_id: null,
        asaas_subscription_id: null,
        created_at: '2026-03-29T00:00:00.000Z',
        updated_at: '2026-03-29T00:00:00.000Z',
      },
      error: null,
    })
  })

  it('creates a pending checkout record for a paid plan', async () => {
    const result = await createCheckoutRecordPending('usr_123', 'monthly', 3900)

    expect(result.userId).toBe('usr_123')
    expect(result.plan).toBe('monthly')
    expect(result.status).toBe('pending')
    expect(insert).toHaveBeenCalled()
  })

  it('rejects free or non-positive checkout bootstrap attempts', async () => {
    await expect(createCheckoutRecordPending('usr_123', 'free', 0)).rejects.toThrowError(
      'billing_checkouts only supports paid Asaas plans: free',
    )

    expect(insert).not.toHaveBeenCalled()
  })

  it('updates checkout lifecycle states', async () => {
    await markCheckoutCreated('chk_123', 'https://asaas.test/pay')
    await markCheckoutFailed('chk_123', 'provider failed')
    await markCheckoutPaid('chk_123', 'pay_123')
    await markCheckoutSubscriptionActive('chk_123', 'sub_123')

    expect(update).toHaveBeenCalledTimes(4)
  })

  it('loads a checkout record by checkout reference', async () => {
    const result = await getCheckoutRecord('chk_123')

    expect(result?.checkoutReference).toBe('chk_123')
    expect(selectEq).toHaveBeenCalledWith('checkout_reference', 'chk_123')
  })

  it('loads a checkout record by subscription id', async () => {
    const result = await getCheckoutBySubscriptionId('sub_123')

    expect(result?.checkoutReference).toBe('chk_123')
    expect(selectEq).toHaveBeenCalledWith('asaas_subscription_id', 'sub_123')
  })

  it('loads a checkout record by Asaas hosted session id', async () => {
    const result = await getCheckoutByAsaasSessionId('session_123')

    expect(result?.checkoutReference).toBe('chk_123')
    expect(selectIlike).toHaveBeenCalledWith('asaas_link', '%session_123%')
  })
})
