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
    process.env.ASAAS_SANDBOX = 'true'
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
      value: 19.90,
      externalReference: 'curria:v1:c:chk_unit',
      callback: {
        successUrl: 'https://curria.test/pricing',
        autoRedirect: false,
      },
    })
  })

  it('creates recurring hosted checkouts via Asaas Checkout sessions', async () => {
    mockPost.mockResolvedValueOnce({ id: 'checkout_123' })

    await expect(createCheckoutLink({
      appUserId: 'usr_123',
      userName: 'Test User',
      userEmail: 'test@example.com',
      plan: 'monthly',
      checkoutReference: 'chk_monthly',
      externalReference: 'curria:v1:c:chk_monthly',
      successUrl: 'https://curria.test/dashboard',
      cancelUrl: 'https://curria.test/pricing',
      expiredUrl: 'https://curria.test/pricing',
    })).resolves.toBe('https://sandbox.asaas.com/checkoutSession/show?id=checkout_123')

    expect(mockPost).toHaveBeenCalledWith('/checkouts', {
      billingTypes: ['CREDIT_CARD'],
      chargeTypes: ['RECURRENT'],
      minutesToExpire: 60,
      callback: {
        successUrl: 'https://curria.test/dashboard',
        cancelUrl: 'https://curria.test/pricing',
        expiredUrl: 'https://curria.test/pricing',
      },
      items: [
        {
          name: `CurrIA - ${PLANS.monthly.name}`,
          description: PLANS.monthly.description,
          quantity: 1,
          value: 39.90,
        },
      ],
      subscription: {
        cycle: 'MONTHLY',
        nextDueDate: expect.any(String),
      },
      externalReference: 'curria:v1:c:chk_monthly',
    })
    expect(mockPost).not.toHaveBeenCalledWith('/paymentLinks', expect.objectContaining({
      chargeType: 'RECURRENT',
    }))
  })
})
