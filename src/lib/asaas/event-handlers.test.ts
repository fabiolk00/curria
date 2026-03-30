import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getPersistedSubscriptionMetadata,
  grantCreditsForEvent,
  updateSubscriptionMetadataForEvent,
} from './credit-grants'
import {
  handlePaymentReceived,
  handleSubscriptionCanceled,
  handleSubscriptionCreated,
  handleSubscriptionRenewed,
} from './event-handlers'
import {
  getCheckoutRecord,
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
  getCheckoutRecord: vi.fn(),
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
      amountMinor: 1900,
      currency: 'BRL',
      status: 'created',
      asaasLink: 'https://asaas.test/pay',
      asaasPaymentId: null,
      asaasSubscriptionId: null,
      createdAt: '2026-03-29T00:00:00.000Z',
      updatedAt: '2026-03-29T00:00:00.000Z',
    })
  })

  it('resolves one-time payments from a v1 checkout reference', async () => {
    await handlePaymentReceived({
      event: 'PAYMENT_RECEIVED',
      amount: 1900,
      payment: {
        id: 'pay_123',
        externalReference: 'curria:v1:u:usr_123:c:chk_123',
        subscription: null,
        amount: 1900,
      },
    }, 'fp_123')

    expect(grantCreditsForEvent).toHaveBeenCalledWith({
      appUserId: 'usr_123',
      eventFingerprint: 'fp_123',
      eventPayload: {
        event: 'PAYMENT_RECEIVED',
        amount: 1900,
        payment: {
          id: 'pay_123',
          externalReference: 'curria:v1:u:usr_123:c:chk_123',
          subscription: null,
          amount: 1900,
        },
      },
      plan: 'unit',
      amountMinor: 1900,
      checkoutReference: 'chk_123',
      reason: 'payment_received',
    })
    expect(markCheckoutPaid).toHaveBeenCalledWith('chk_123', 'pay_123')
  })

  it('surfaces partial-success failures when payment credits were granted but checkout marking fails', async () => {
    vi.mocked(markCheckoutPaid).mockRejectedValueOnce(new Error('failed to mark paid'))

    await expect(handlePaymentReceived({
      event: 'PAYMENT_RECEIVED',
      amount: 1900,
      payment: {
        id: 'pay_123',
        externalReference: 'curria:v1:u:usr_123:c:chk_123',
        subscription: null,
        amount: 1900,
      },
    }, 'fp_mark_paid_failure')).rejects.toThrow('failed to mark paid')

    expect(grantCreditsForEvent).toHaveBeenCalledWith(expect.objectContaining({
      appUserId: 'usr_123',
      checkoutReference: 'chk_123',
      reason: 'payment_received',
    }))
  })

  it('rejects legacy external references for one-time payments', async () => {
    await expect(handlePaymentReceived({
      event: 'PAYMENT_RECEIVED',
      amount: 1900,
      payment: {
        id: 'pay_123',
        externalReference: 'usr_123',
        subscription: null,
        amount: 1900,
      },
    }, 'fp_legacy')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      status: 400,
    })
  })

  it('resolves subscription creation from a v1 checkout reference', async () => {
    vi.mocked(getCheckoutRecord).mockResolvedValueOnce({
      id: 'bc_234',
      userId: 'usr_123',
      checkoutReference: 'chk_234',
      plan: 'pro',
      amountMinor: 9700,
      currency: 'BRL',
      status: 'created',
      asaasLink: 'https://asaas.test/subscription',
      asaasPaymentId: null,
      asaasSubscriptionId: null,
      createdAt: '2026-03-29T00:00:00.000Z',
      updatedAt: '2026-03-29T00:00:00.000Z',
    })

    await handleSubscriptionCreated({
      event: 'SUBSCRIPTION_CREATED',
      amount: 9700,
      subscription: {
        id: 'sub_123',
        externalReference: 'curria:v1:u:usr_123:c:chk_234',
        nextDueDate: '2099-04-29',
      },
    }, 'fp_234')

    expect(grantCreditsForEvent).toHaveBeenCalledWith({
      appUserId: 'usr_123',
      eventFingerprint: 'fp_234',
      eventPayload: {
        event: 'SUBSCRIPTION_CREATED',
        amount: 9700,
        subscription: {
          id: 'sub_123',
          externalReference: 'curria:v1:u:usr_123:c:chk_234',
          nextDueDate: '2099-04-29',
        },
      },
      plan: 'pro',
      amountMinor: 9700,
      checkoutReference: 'chk_234',
      asaasSubscriptionId: 'sub_123',
      renewsAt: '2099-04-29',
      reason: 'subscription_created',
    })
    expect(markCheckoutSubscriptionActive).toHaveBeenCalledWith('chk_234', 'sub_123')
  })

  it('surfaces partial-success failures when subscription credits were granted but activation marking fails', async () => {
    vi.mocked(getCheckoutRecord).mockResolvedValueOnce({
      id: 'bc_234',
      userId: 'usr_123',
      checkoutReference: 'chk_234',
      plan: 'pro',
      amountMinor: 9700,
      currency: 'BRL',
      status: 'created',
      asaasLink: 'https://asaas.test/subscription',
      asaasPaymentId: null,
      asaasSubscriptionId: null,
      createdAt: '2026-03-29T00:00:00.000Z',
      updatedAt: '2026-03-29T00:00:00.000Z',
    })
    vi.mocked(markCheckoutSubscriptionActive).mockRejectedValueOnce(
      new Error('failed to mark subscription active'),
    )

    await expect(handleSubscriptionCreated({
      event: 'SUBSCRIPTION_CREATED',
      amount: 9700,
      subscription: {
        id: 'sub_123',
        externalReference: 'curria:v1:u:usr_123:c:chk_234',
        nextDueDate: '2099-04-29',
      },
    }, 'fp_mark_subscription_failure')).rejects.toThrow('failed to mark subscription active')

    expect(grantCreditsForEvent).toHaveBeenCalledWith(expect.objectContaining({
      appUserId: 'usr_123',
      checkoutReference: 'chk_234',
      asaasSubscriptionId: 'sub_123',
      reason: 'subscription_created',
    }))
  })

  it('rejects past renewal dates during subscription creation', async () => {
    vi.mocked(getCheckoutRecord).mockResolvedValueOnce({
      id: 'bc_234',
      userId: 'usr_123',
      checkoutReference: 'chk_234',
      plan: 'monthly',
      amountMinor: 3900,
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
      amount: 3900,
      subscription: {
        id: 'sub_123',
        externalReference: 'curria:v1:u:usr_123:c:chk_234',
        nextDueDate: '2000-01-01',
      },
    }, 'fp_past')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      status: 400,
    })
  })

  it('uses persisted subscription metadata on subscription renewal', async () => {
    await handleSubscriptionRenewed({
      event: 'SUBSCRIPTION_RENEWED',
      subscription: {
        id: 'sub_123',
        externalReference: 'usr_123',
        nextDueDate: '2099-05-29',
      },
    }, 'fp_345')

    expect(getPersistedSubscriptionMetadata).toHaveBeenCalledWith('sub_123')
    expect(grantCreditsForEvent).toHaveBeenCalledWith(expect.objectContaining({
      appUserId: 'usr_123',
      plan: 'monthly',
      asaasSubscriptionId: 'sub_123',
      renewsAt: '2099-05-29',
      reason: 'subscription_renewed',
    }))
    expect(getCheckoutRecord).not.toHaveBeenCalled()
  })

  it('handles pre-cutover recurring renewals via subscription id without checkout lookup', async () => {
    vi.mocked(getPersistedSubscriptionMetadata).mockResolvedValueOnce({
      appUserId: 'usr_legacy123',
      plan: 'monthly',
      asaasSubscriptionId: 'sub_legacy_123',
      renewsAt: '2099-04-29T00:00:00.000Z',
      status: 'active',
    })

    await handleSubscriptionRenewed({
      event: 'SUBSCRIPTION_RENEWED',
      subscription: {
        id: 'sub_legacy_123',
        externalReference: 'usr_legacy123',
        nextDueDate: '2099-06-29',
      },
    }, 'fp_legacy_renewal')

    expect(getPersistedSubscriptionMetadata).toHaveBeenCalledWith('sub_legacy_123')
    expect(getCheckoutRecord).not.toHaveBeenCalled()
    expect(grantCreditsForEvent).toHaveBeenCalledWith(expect.objectContaining({
      appUserId: 'usr_legacy123',
      plan: 'monthly',
      asaasSubscriptionId: 'sub_legacy_123',
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
      event: 'SUBSCRIPTION_CANCELED',
      subscription: {
        id: 'sub_999',
        externalReference: 'usr_123',
      },
    }, 'fp_456')

    expect(updateSubscriptionMetadataForEvent).toHaveBeenCalledWith({
      appUserId: 'usr_123',
      eventFingerprint: 'fp_456',
      eventPayload: {
        event: 'SUBSCRIPTION_CANCELED',
        subscription: {
          id: 'sub_999',
          externalReference: 'usr_123',
        },
      },
      plan: 'monthly',
      asaasSubscriptionId: 'sub_999',
      renewsAt: null,
      status: 'canceled',
      reason: 'subscription_canceled',
    })
    expect(markCheckoutCanceledBySubscriptionId).toHaveBeenCalledWith('sub_999')
  })

  it('rejects malformed events that are missing externalReference', async () => {
    await expect(handlePaymentReceived({
      event: 'PAYMENT_RECEIVED',
      amount: 1900,
      payment: {
        id: 'pay_123',
        amount: 1900,
      },
    }, 'fp_567')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      status: 400,
    })
  })
})
