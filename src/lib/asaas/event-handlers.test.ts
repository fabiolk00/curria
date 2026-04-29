import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getPersistedSubscriptionMetadata,
  grantCreditsForEvent,
  updateSubscriptionMetadataForEvent,
} from './credit-grants'
import {
  handlePaymentSettlement,
  handleSubscriptionCanceled,
  handleSubscriptionCreated,
  handleSubscriptionRenewed,
  handleSubscriptionUpdated,
} from './event-handlers'
import {
  getCheckoutByAsaasSessionId,
  getCheckoutBySubscriptionId,
  getCheckoutRecord,
  markCheckoutCanceled,
  markCheckoutCanceledBySubscriptionId,
  markCheckoutPaid,
  markCheckoutSubscriptionActive,
} from './billing-checkouts'

vi.mock('./credit-grants', () => ({
  getPersistedSubscriptionMetadata: vi.fn(),
  grantCreditsForEvent: vi.fn(),
  updateSubscriptionMetadataForEvent: vi.fn(),
}))

vi.mock('./billing-checkouts', () => ({
  getCheckoutByAsaasSessionId: vi.fn(),
  getCheckoutRecord: vi.fn(),
  getCheckoutBySubscriptionId: vi.fn(),
  markCheckoutCanceled: vi.fn(),
  markCheckoutPaid: vi.fn(),
  markCheckoutSubscriptionActive: vi.fn(),
  markCheckoutCanceledBySubscriptionId: vi.fn(),
}))

describe('Asaas billing event handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(grantCreditsForEvent).mockResolvedValue('processed')
    vi.mocked(updateSubscriptionMetadataForEvent).mockResolvedValue('processed')
    vi.mocked(getPersistedSubscriptionMetadata).mockResolvedValue({
      appUserId: 'usr_123',
      plan: 'monthly',
      asaasSubscriptionId: 'sub_123',
      renewsAt: '2099-04-29T00:00:00.000Z',
      status: 'active',
    })
    vi.mocked(getCheckoutRecord).mockResolvedValue({
      id: 'bc_123',
      userId: 'usr_123',
      checkoutReference: 'chk_123',
      plan: 'unit',
      amountMinor: 1990,
      currency: 'BRL',
      status: 'created',
      asaasLink: 'https://asaas.test/pay',
      asaasPaymentId: null,
      asaasSubscriptionId: null,
      createdAt: '2026-03-29T00:00:00.000Z',
      updatedAt: '2026-03-29T00:00:00.000Z',
    })
    vi.mocked(getCheckoutByAsaasSessionId).mockResolvedValue({
      id: 'bc_123',
      userId: 'usr_123',
      checkoutReference: 'chk_123',
      plan: 'unit',
      amountMinor: 1990,
      currency: 'BRL',
      status: 'created',
      asaasLink: 'https://www.asaas.com/checkoutSession/show/d7b9e334-9351-4fe1-83d1-852dc23b2e89',
      asaasPaymentId: null,
      asaasSubscriptionId: null,
      createdAt: '2026-03-29T00:00:00.000Z',
      updatedAt: '2026-03-29T00:00:00.000Z',
    })
    vi.mocked(getCheckoutBySubscriptionId).mockResolvedValue({
      id: 'bc_renewal',
      userId: 'usr_123',
      checkoutReference: 'chk_monthly',
      plan: 'monthly',
      amountMinor: 3990,
      currency: 'BRL',
      status: 'subscription_active',
      asaasLink: 'https://asaas.test/subscription',
      asaasPaymentId: null,
      asaasSubscriptionId: 'sub_123',
      createdAt: '2026-03-29T00:00:00.000Z',
      updatedAt: '2026-03-29T00:00:00.000Z',
    })
  })

  it('resolves one-time payments from a v1 checkout reference', async () => {
    await handlePaymentSettlement({
      event: 'PAYMENT_RECEIVED',
      payment: {
        id: 'pay_123',
        externalReference: 'curria:v1:c:chk_123',
        subscription: null,
        value: 19.9,
      },
    }, 'fp_123')

    expect(grantCreditsForEvent).toHaveBeenCalledWith({
      appUserId: 'usr_123',
      eventFingerprint: 'fp_123',
      eventPayload: {
        event: 'PAYMENT_RECEIVED',
        payment: {
          id: 'pay_123',
          externalReference: 'curria:v1:c:chk_123',
          subscription: null,
          value: 19.9,
        },
      },
      billingEventType: 'PAYMENT_SETTLED',
      plan: 'unit',
      amountMinor: 1990,
      checkoutReference: 'chk_123',
      isRenewal: false,
      reason: 'payment_received',
    })
    expect(markCheckoutPaid).toHaveBeenCalledWith('chk_123', 'pay_123')
  })

  it('resolves one-time payments from checkoutSession when externalReference is missing', async () => {
    await handlePaymentSettlement({
      event: 'PAYMENT_RECEIVED',
      payment: {
        id: 'pay_asaas_session',
        externalReference: null,
        checkoutSession: 'd7b9e334-9351-4fe1-83d1-852dc23b2e89',
        subscription: null,
        value: 19.9,
      },
    }, 'fp_checkout_session')

    expect(getCheckoutByAsaasSessionId).toHaveBeenCalledWith('d7b9e334-9351-4fe1-83d1-852dc23b2e89')
    expect(grantCreditsForEvent).toHaveBeenCalledWith(expect.objectContaining({
      appUserId: 'usr_123',
      checkoutReference: 'chk_123',
      billingEventType: 'PAYMENT_SETTLED',
      reason: 'payment_received',
    }))
    expect(markCheckoutPaid).toHaveBeenCalledWith('chk_123', 'pay_asaas_session')
  })

  it('surfaces partial-success failures when payment credits were granted but checkout marking fails', async () => {
    vi.mocked(markCheckoutPaid).mockRejectedValueOnce(new Error('failed to mark paid'))

    await expect(handlePaymentSettlement({
      event: 'PAYMENT_RECEIVED',
      payment: {
        id: 'pay_123',
        externalReference: 'curria:v1:c:chk_123',
        subscription: null,
        value: 19.9,
      },
    }, 'fp_mark_paid_failure')).rejects.toThrow('failed to mark paid')

    expect(grantCreditsForEvent).toHaveBeenCalledWith(expect.objectContaining({
      appUserId: 'usr_123',
      checkoutReference: 'chk_123',
      reason: 'payment_received',
    }))
  })

  it('rejects legacy external references for one-time payments', async () => {
    await expect(handlePaymentSettlement({
      event: 'PAYMENT_RECEIVED',
      payment: {
        id: 'pay_123',
        externalReference: 'usr_123',
        subscription: null,
        value: 19.9,
      },
    }, 'fp_legacy')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      status: 400,
    })
  })

  it('activates recurring subscriptions from settled payment events instead of SUBSCRIPTION_CREATED', async () => {
    vi.mocked(getCheckoutRecord).mockResolvedValueOnce({
      id: 'bc_234',
      userId: 'usr_123',
      checkoutReference: 'chk_234',
      plan: 'pro',
      amountMinor: 5990,
      currency: 'BRL',
      status: 'created',
      asaasLink: 'https://asaas.test/subscription',
      asaasPaymentId: null,
      asaasSubscriptionId: null,
      createdAt: '2026-03-29T00:00:00.000Z',
      updatedAt: '2026-03-29T00:00:00.000Z',
    })

    await handlePaymentSettlement({
      event: 'PAYMENT_CONFIRMED',
      payment: {
        id: 'pay_sub_initial',
        externalReference: 'curria:v1:c:chk_234',
        subscription: 'sub_123',
        value: 59.9,
        dueDate: '2026-04-29',
      },
    }, 'fp_sub_initial')

    expect(grantCreditsForEvent).toHaveBeenCalledWith({
      appUserId: 'usr_123',
      eventFingerprint: 'fp_sub_initial',
      eventPayload: {
        event: 'PAYMENT_CONFIRMED',
        payment: {
          id: 'pay_sub_initial',
          externalReference: 'curria:v1:c:chk_234',
          subscription: 'sub_123',
          value: 59.9,
          dueDate: '2026-04-29',
        },
      },
      billingEventType: 'SUBSCRIPTION_STARTED',
      plan: 'pro',
      amountMinor: 5990,
      checkoutReference: 'chk_234',
      asaasSubscriptionId: 'sub_123',
      renewsAt: '2026-05-29T00:00:00.000Z',
      isRenewal: false,
      reason: 'subscription_started',
    })
    expect(markCheckoutSubscriptionActive).toHaveBeenCalledWith('chk_234', 'sub_123')
  })

  it('uses persisted subscription metadata for recurring renewal payments', async () => {
    vi.mocked(getCheckoutRecord).mockResolvedValueOnce({
      id: 'bc_renewal',
      userId: 'usr_123',
      checkoutReference: 'chk_monthly',
      plan: 'monthly',
      amountMinor: 3990,
      currency: 'BRL',
      status: 'subscription_active',
      asaasLink: 'https://asaas.test/subscription',
      asaasPaymentId: null,
      asaasSubscriptionId: 'sub_123',
      createdAt: '2026-03-29T00:00:00.000Z',
      updatedAt: '2026-03-29T00:00:00.000Z',
    })

    await handlePaymentSettlement({
      event: 'PAYMENT_RECEIVED',
      payment: {
        id: 'pay_renewal',
        externalReference: 'curria:v1:c:chk_monthly',
        subscription: 'sub_123',
        value: 39.9,
        dueDate: '2026-05-29',
      },
    }, 'fp_renewal_payment')

    expect(getPersistedSubscriptionMetadata).toHaveBeenCalledWith('sub_123')
    expect(getCheckoutBySubscriptionId).toHaveBeenCalledWith('sub_123')
    expect(grantCreditsForEvent).toHaveBeenCalledWith(expect.objectContaining({
      appUserId: 'usr_123',
      billingEventType: 'SUBSCRIPTION_RENEWED',
      plan: 'monthly',
      checkoutReference: 'chk_monthly',
      asaasSubscriptionId: 'sub_123',
      renewsAt: '2026-06-29T00:00:00.000Z',
      isRenewal: true,
      reason: 'subscription_renewed',
    }))
  })

  it('ignores subscription creation snapshots that are inactive or deleted and cancels the pending checkout', async () => {
    vi.mocked(getCheckoutRecord).mockResolvedValueOnce({
      id: 'bc_234',
      userId: 'usr_123',
      checkoutReference: 'chk_234',
      plan: 'monthly',
      amountMinor: 3990,
      currency: 'BRL',
      status: 'created',
      asaasLink: 'https://asaas.test/subscription',
      asaasPaymentId: null,
      asaasSubscriptionId: null,
      createdAt: '2026-03-29T00:00:00.000Z',
      updatedAt: '2026-03-29T00:00:00.000Z',
    })

    await expect(handleSubscriptionCreated({
      event: 'SUBSCRIPTION_CREATED',
      subscription: {
        id: 'sub_bad',
        externalReference: 'curria:v1:c:chk_234',
        nextDueDate: '2099-04-29',
        status: 'INACTIVE',
        deleted: true,
        value: 39,
      },
    }, 'fp_inactive_deleted')).resolves.toBe('ignored')

    expect(markCheckoutCanceled).toHaveBeenCalledWith('chk_234')
    expect(grantCreditsForEvent).not.toHaveBeenCalled()
    expect(markCheckoutSubscriptionActive).not.toHaveBeenCalled()
  })

  it('updates persisted metadata from official subscription update events', async () => {
    await handleSubscriptionUpdated({
      event: 'SUBSCRIPTION_UPDATED',
      subscription: {
        id: 'sub_123',
        status: 'ACTIVE',
        nextDueDate: '22/11/2099',
      },
    }, 'fp_updated')

    expect(updateSubscriptionMetadataForEvent).toHaveBeenCalledWith({
      appUserId: 'usr_123',
      eventFingerprint: 'fp_updated',
      eventPayload: {
        event: 'SUBSCRIPTION_UPDATED',
        subscription: {
          id: 'sub_123',
          status: 'ACTIVE',
          nextDueDate: '22/11/2099',
        },
      },
      billingEventType: 'SUBSCRIPTION_UPDATED',
      plan: 'monthly',
      asaasSubscriptionId: 'sub_123',
      renewsAt: '2099-11-22T00:00:00.000Z',
      status: 'active',
      reason: 'subscription_updated',
    })
  })

  it('uses persisted subscription metadata on legacy subscription renewal events', async () => {
    await handleSubscriptionRenewed({
      event: 'SUBSCRIPTION_RENEWED',
      subscription: {
        id: 'sub_123',
        externalReference: 'usr_123',
        nextDueDate: '2099-05-29',
      },
    }, 'fp_345')

    expect(getPersistedSubscriptionMetadata).toHaveBeenCalledWith('sub_123')
    expect(getCheckoutBySubscriptionId).toHaveBeenCalledWith('sub_123')
    expect(grantCreditsForEvent).toHaveBeenCalledWith(expect.objectContaining({
      appUserId: 'usr_123',
      billingEventType: 'SUBSCRIPTION_RENEWED',
      plan: 'monthly',
      asaasSubscriptionId: 'sub_123',
      renewsAt: '2099-05-29T00:00:00.000Z',
      isRenewal: true,
      reason: 'subscription_renewed',
    }))
  })

  it('updates metadata only on subscription cancellation resolved by subscription id', async () => {
    vi.mocked(getPersistedSubscriptionMetadata).mockResolvedValueOnce({
      appUserId: 'usr_123',
      plan: 'monthly',
      asaasSubscriptionId: 'sub_999',
      renewsAt: '2099-04-29T00:00:00.000Z',
      status: 'active',
    })

    await handleSubscriptionCanceled({
      event: 'SUBSCRIPTION_INACTIVATED',
      subscription: {
        id: 'sub_999',
        externalReference: 'usr_123',
      },
    }, 'fp_456')

    expect(updateSubscriptionMetadataForEvent).toHaveBeenCalledWith({
      appUserId: 'usr_123',
      eventFingerprint: 'fp_456',
      eventPayload: {
        event: 'SUBSCRIPTION_INACTIVATED',
        subscription: {
          id: 'sub_999',
          externalReference: 'usr_123',
        },
      },
      billingEventType: 'SUBSCRIPTION_CANCELED',
      plan: 'monthly',
      asaasSubscriptionId: 'sub_999',
      renewsAt: null,
      status: 'canceled',
      reason: 'subscription_inactivated',
    })
    expect(markCheckoutCanceledBySubscriptionId).toHaveBeenCalledWith('sub_999')
  })

  it('ignores cancellation snapshots without persisted metadata but cancels the referenced checkout', async () => {
    vi.mocked(getPersistedSubscriptionMetadata).mockResolvedValueOnce(null)
    vi.mocked(getCheckoutRecord).mockResolvedValueOnce({
      id: 'bc_999',
      userId: 'usr_123',
      checkoutReference: 'chk_999',
      plan: 'monthly',
      amountMinor: 3990,
      currency: 'BRL',
      status: 'created',
      asaasLink: 'https://asaas.test/subscription',
      asaasPaymentId: null,
      asaasSubscriptionId: null,
      createdAt: '2026-03-29T00:00:00.000Z',
      updatedAt: '2026-03-29T00:00:00.000Z',
    })

    await expect(handleSubscriptionCanceled({
      event: 'SUBSCRIPTION_DELETED',
      subscription: {
        id: 'sub_missing',
        externalReference: 'curria:v1:c:chk_999',
      },
    }, 'fp_deleted')).resolves.toBe('ignored')

    expect(markCheckoutCanceled).toHaveBeenCalledWith('chk_999')
    expect(updateSubscriptionMetadataForEvent).not.toHaveBeenCalled()
  })

  it('rejects malformed payment events that are missing externalReference and checkoutSession for one-time billing', async () => {
    await expect(handlePaymentSettlement({
      event: 'PAYMENT_RECEIVED',
      payment: {
        id: 'pay_123',
        value: 19.9,
      },
    }, 'fp_567')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      status: 400,
    })
  })
})
