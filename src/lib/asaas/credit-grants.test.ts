import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getSupabaseAdminClient } from '@/lib/db/supabase-admin'
import { PLANS } from '@/lib/plans'

import {
  getPersistedPlan,
  getPersistedSubscriptionMetadata,
  grantCreditsForEvent,
  updateSubscriptionMetadataForEvent,
} from './credit-grants'

vi.mock('@/lib/db/supabase-admin', () => ({
  getSupabaseAdminClient: vi.fn(),
}))

const rpc = vi.fn()
const maybeSingle = vi.fn()

const mockSupabase = {
  rpc,
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle,
      })),
    })),
  })),
}

describe('billing credit grants', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getSupabaseAdminClient).mockReturnValue(
      mockSupabase as unknown as ReturnType<typeof getSupabaseAdminClient>,
    )
    rpc.mockResolvedValue({ data: 'processed', error: null })
    maybeSingle.mockResolvedValue({ data: { plan: 'monthly' }, error: null })
  })

  it('grants credits through the billing rpc using plan definitions and checkout trust anchors', async () => {
    const event = {
      event: 'PAYMENT_RECEIVED' as const,
      amount: 1900,
      payment: {
        id: 'pay_123',
        externalReference: 'curria:v1:c:chk_123',
        subscription: null,
        amount: 1900,
      },
    }

    await grantCreditsForEvent({
      appUserId: 'usr_123',
      eventFingerprint: 'fp_123',
      eventPayload: event,
      plan: 'unit',
      amountMinor: 1900,
      checkoutReference: 'chk_123',
      reason: 'payment_received',
    })

    expect(rpc).toHaveBeenCalledWith('apply_billing_credit_grant_event', {
      p_app_user_id: 'usr_123',
      p_plan: 'unit',
      p_credits: PLANS.unit.credits,
      p_amount_minor: 1900,
      p_checkout_reference: 'chk_123',
      p_asaas_subscription_id: null,
      p_renews_at: null,
      p_status: 'active',
      p_event_fingerprint: 'fp_123',
      p_event_type: 'PAYMENT_RECEIVED',
      p_event_payload: event,
      p_is_renewal: false,
    })
  })

  it('updates subscription metadata without touching runtime credit storage directly', async () => {
    const event = {
      event: 'SUBSCRIPTION_CANCELED' as const,
      subscription: {
        id: 'sub_123',
        externalReference: 'usr_123',
      },
    }

    await updateSubscriptionMetadataForEvent({
      appUserId: 'usr_123',
      eventFingerprint: 'fp_456',
      eventPayload: event,
      plan: 'monthly',
      asaasSubscriptionId: 'sub_123',
      renewsAt: null,
      status: 'canceled',
      reason: 'subscription_canceled',
    })

    expect(rpc).toHaveBeenCalledWith('apply_billing_subscription_metadata_event', {
      p_app_user_id: 'usr_123',
      p_plan: 'monthly',
      p_checkout_reference: null,
      p_asaas_subscription_id: 'sub_123',
      p_renews_at: null,
      p_status: 'canceled',
      p_event_fingerprint: 'fp_456',
      p_event_type: 'SUBSCRIPTION_CANCELED',
      p_event_payload: event,
    })
  })

  it('reads the persisted plan slug from user_quotas metadata', async () => {
    await expect(getPersistedPlan('usr_123')).resolves.toBe('monthly')
  })

  it('reads persisted subscription metadata by subscription id', async () => {
    maybeSingle.mockResolvedValueOnce({
      data: {
        user_id: 'usr_123',
        plan: 'monthly',
        asaas_subscription_id: 'sub_123',
        renews_at: '2026-04-29T00:00:00.000Z',
        status: 'active',
      },
      error: null,
    })

    await expect(getPersistedSubscriptionMetadata('sub_123')).resolves.toEqual({
      appUserId: 'usr_123',
      plan: 'monthly',
      asaasSubscriptionId: 'sub_123',
      renewsAt: '2026-04-29T00:00:00.000Z',
      status: 'active',
    })
  })

  it('rejects unknown plans before calling the rpc', async () => {
    const event = {
      event: 'PAYMENT_RECEIVED' as const,
      amount: 1900,
      payment: {
        id: 'pay_123',
        externalReference: 'curria:v1:c:chk_123',
      },
    }

    await expect(grantCreditsForEvent({
      appUserId: 'usr_123',
      eventFingerprint: 'fp_789',
      eventPayload: event,
      plan: 'invalid' as 'unit',
      reason: 'payment_received',
    })).rejects.toThrow('Plan not found: invalid')

    expect(rpc).not.toHaveBeenCalled()
  })

  it('surfaces rpc overflow rejections for credit grants', async () => {
    const event = {
      event: 'SUBSCRIPTION_RENEWED' as const,
      amount: 3900,
      subscription: {
        id: 'sub_123',
        externalReference: 'usr_123',
        nextDueDate: '2026-05-29',
      },
    }

    rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'Credit grant would exceed max balance.' },
    })

    await expect(grantCreditsForEvent({
      appUserId: 'usr_123',
      eventFingerprint: 'fp_overflow',
      eventPayload: event,
      plan: 'monthly',
      asaasSubscriptionId: 'sub_123',
      renewsAt: '2026-05-29',
      reason: 'subscription_renewed',
    })).rejects.toThrow('Failed to grant credits: Credit grant would exceed max balance.')
  })

  it('surfaces rpc negative-balance rejections for credit grants', async () => {
    const event = {
      event: 'SUBSCRIPTION_RENEWED' as const,
      amount: 3900,
      subscription: {
        id: 'sub_123',
        externalReference: 'usr_123',
        nextDueDate: '2026-05-29',
      },
    }

    rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'Negative existing balance detected for user usr_123' },
    })

    await expect(grantCreditsForEvent({
      appUserId: 'usr_123',
      eventFingerprint: 'fp_negative',
      eventPayload: event,
      plan: 'monthly',
      asaasSubscriptionId: 'sub_123',
      renewsAt: '2026-05-29',
      reason: 'subscription_renewed',
    })).rejects.toThrow('Failed to grant credits: Negative existing balance detected for user usr_123')
  })

  it('surfaces rpc invalid checkout trust-anchor rejections for initial events', async () => {
    const event = {
      event: 'PAYMENT_RECEIVED' as const,
      amount: 1900,
      payment: {
        id: 'pay_123',
        externalReference: 'curria:v1:c:chk_missing',
        subscription: null,
        amount: 1900,
      },
    }

    rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'Checkout record not found: chk_missing' },
    })

    await expect(grantCreditsForEvent({
      appUserId: 'usr_123',
      eventFingerprint: 'fp_missing_checkout',
      eventPayload: event,
      plan: 'unit',
      amountMinor: 1900,
      checkoutReference: 'chk_missing',
      reason: 'payment_received',
    })).rejects.toThrow('Failed to grant credits: Checkout record not found: chk_missing')
  })

  it('surfaces rpc invalid subscription trust-anchor rejections for recurring events', async () => {
    const event = {
      event: 'SUBSCRIPTION_CANCELED' as const,
      subscription: {
        id: 'sub_missing',
        externalReference: 'usr_123',
      },
    }

    rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'User quota record not found for subscription sub_missing' },
    })

    await expect(updateSubscriptionMetadataForEvent({
      appUserId: 'usr_123',
      eventFingerprint: 'fp_missing_subscription',
      eventPayload: event,
      plan: 'monthly',
      asaasSubscriptionId: 'sub_missing',
      renewsAt: null,
      status: 'canceled',
      reason: 'subscription_canceled',
    })).rejects.toThrow(
      'Failed to update subscription metadata: User quota record not found for subscription sub_missing',
    )
  })

  it('carries over remaining credits when upgrading plans (plan change)', async () => {
    const event = {
      event: 'PAYMENT_RECEIVED' as const,
      amount: 3990,
      payment: {
        id: 'pay_upgrade',
        externalReference: 'curria:v1:c:chk_upgrade',
        subscription: null,
        amount: 3990,
      },
    }

    await grantCreditsForEvent({
      appUserId: 'usr_123',
      eventFingerprint: 'fp_upgrade',
      eventPayload: event,
      plan: 'monthly',
      amountMinor: 3990,
      checkoutReference: 'chk_upgrade',
      reason: 'payment_received',
    })

    // Should call RPC with p_is_renewal = false to enable carryover
    expect(rpc).toHaveBeenCalledWith('apply_billing_credit_grant_event', expect.objectContaining({
      p_is_renewal: false,
      p_plan: 'monthly',
      p_credits: PLANS.monthly.credits,
    }))
  })

  it('replaces credits on subscription renewal (no carryover)', async () => {
    const event = {
      event: 'SUBSCRIPTION_RENEWED' as const,
      amount: 3990,
      subscription: {
        id: 'sub_123',
        externalReference: 'usr_123',
        nextDueDate: '2026-05-29',
      },
    }

    await grantCreditsForEvent({
      appUserId: 'usr_123',
      eventFingerprint: 'fp_renewal',
      eventPayload: event,
      plan: 'monthly',
      asaasSubscriptionId: 'sub_123',
      renewsAt: '2026-05-29',
      reason: 'subscription_renewed',
    })

    // Should call RPC with p_is_renewal = true to replace balance
    expect(rpc).toHaveBeenCalledWith('apply_billing_credit_grant_event', expect.objectContaining({
      p_is_renewal: true,
      p_plan: 'monthly',
      p_credits: PLANS.monthly.credits,
    }))
  })
})
