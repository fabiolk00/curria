import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PLANS } from '@/lib/plans'

import { createCheckoutLink } from './checkout'

const { mockPost } = vi.hoisted(() => ({
  mockPost: vi.fn(),
}))

vi.mock('@/lib/asaas/client', () => ({
  asaas: {
    post: mockPost,
  },
}))

describe('Asaas checkout link creation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates one-time hosted checkouts via payment links', async () => {
    mockPost.mockResolvedValueOnce({ url: 'https://sandbox.asaas.com/payment-link/unit' })

    await expect(createCheckoutLink({
      appUserId: 'usr_123',
      userName: 'Test User',
      userEmail: 'test@example.com',
      plan: 'unit',
      checkoutReference: 'chk_unit',
      externalReference: 'curria:v1:c:chk_unit',
      successUrl: 'https://curria.test/pricing',
    })).resolves.toBe('https://sandbox.asaas.com/payment-link/unit')

    expect(mockPost).toHaveBeenCalledWith('/paymentLinks', {
      name: `CurrIA - ${PLANS.unit.name}`,
      description: PLANS.unit.description,
      billingType: 'UNDEFINED',
      chargeType: 'DETACHED',
      value: 19,
      externalReference: 'curria:v1:c:chk_unit',
      callback: {
        successUrl: 'https://curria.test/pricing',
        autoRedirect: false,
      },
    })
  })

  it('creates recurring hosted checkouts via recurring payment links instead of subscriptions', async () => {
    mockPost.mockResolvedValueOnce({ url: 'https://sandbox.asaas.com/payment-link/monthly' })

    await expect(createCheckoutLink({
      appUserId: 'usr_123',
      userName: 'Test User',
      userEmail: 'test@example.com',
      plan: 'monthly',
      checkoutReference: 'chk_monthly',
      externalReference: 'curria:v1:c:chk_monthly',
      successUrl: 'https://curria.test/pricing',
    })).resolves.toBe('https://sandbox.asaas.com/payment-link/monthly')

    expect(mockPost).toHaveBeenCalledWith('/paymentLinks', {
      name: `CurrIA - ${PLANS.monthly.name}`,
      description: PLANS.monthly.description,
      billingType: 'CREDIT_CARD',
      chargeType: 'RECURRENT',
      subscriptionCycle: 'MONTHLY',
      value: 39,
      externalReference: 'curria:v1:c:chk_monthly',
      callback: {
        successUrl: 'https://curria.test/pricing',
        autoRedirect: false,
      },
    })
    expect(mockPost).not.toHaveBeenCalledWith('/subscriptions', expect.anything())
  })
})
