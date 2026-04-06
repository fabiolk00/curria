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

  it('creates one-time hosted checkouts with PIX + CREDIT_CARD and full billing info', async () => {
    mockPost.mockResolvedValueOnce({ id: 'checkout_unit_123' })

    await expect(createCheckoutLink({
      appUserId: 'usr_123',
      userName: 'Test User',
      userEmail: 'test@example.com',
      plan: 'unit',
      checkoutReference: 'chk_unit',
      externalReference: 'curria:v1:u:usr_123:c:chk_unit',
      successUrl: 'https://curria.test/pricing',
      cancelUrl: 'https://curria.test/pricing',
      expiredUrl: 'https://curria.test/pricing',
      billingInfo: {
        cpfCnpj: '12345678901234',
        phoneNumber: '11999999999',
        address: 'Rua Test',
        addressNumber: '123',
        postalCode: '01234567',
        province: 'SP',
      },
    })).resolves.toBe('https://sandbox.asaas.com/checkoutSession/show?id=checkout_unit_123')

    expect(mockPost).toHaveBeenCalledWith('/checkouts', {
      billingTypes: ['PIX', 'CREDIT_CARD'],
      chargeTypes: ['DETACHED'],
      minutesToExpire: 60,
      externalReference: 'curria:v1:u:usr_123:c:chk_unit',
      callback: {
        successUrl: 'https://curria.test/pricing',
        cancelUrl: 'https://curria.test/pricing',
        expiredUrl: 'https://curria.test/pricing',
      },
      customerData: {
        name: 'Test User',
        email: 'test@example.com',
        cpfCnpj: '12345678901234',
        phoneNumber: '11999999999',
        address: 'Rua Test',
        addressNumber: '123',
        postalCode: '01234567',
        province: 'SP',
      },
      items: [
        {
          name: `CurrIA - ${PLANS.unit.name}`,
          description: PLANS.unit.description,
          quantity: 1,
          value: 19.90,
        },
      ],
    })
  })

  it('creates one-time checkouts without billing info when not provided', async () => {
    mockPost.mockResolvedValueOnce({ id: 'checkout_unit_456' })

    await expect(createCheckoutLink({
      appUserId: 'usr_123',
      userName: 'Test User',
      userEmail: 'test@example.com',
      plan: 'unit',
      checkoutReference: 'chk_unit_2',
      externalReference: 'curria:v1:u:usr_123:c:chk_unit_2',
      successUrl: 'https://curria.test/pricing',
      cancelUrl: 'https://curria.test/pricing',
      expiredUrl: 'https://curria.test/pricing',
    })).resolves.toBe('https://sandbox.asaas.com/checkoutSession/show?id=checkout_unit_456')

    expect(mockPost).toHaveBeenCalledWith('/checkouts', {
      billingTypes: ['PIX', 'CREDIT_CARD'],
      chargeTypes: ['DETACHED'],
      minutesToExpire: 60,
      externalReference: 'curria:v1:u:usr_123:c:chk_unit_2',
      callback: {
        successUrl: 'https://curria.test/pricing',
        cancelUrl: 'https://curria.test/pricing',
        expiredUrl: 'https://curria.test/pricing',
      },
      customerData: {
        name: 'Test User',
        email: 'test@example.com',
      },
      items: [
        {
          name: `CurrIA - ${PLANS.unit.name}`,
          description: PLANS.unit.description,
          quantity: 1,
          value: 19.90,
        },
      ],
    })
  })

  it('creates recurring hosted checkouts with CREDIT_CARD only, no address in payload', async () => {
    mockPost.mockResolvedValueOnce({ id: 'checkout_123' })

    await expect(createCheckoutLink({
      appUserId: 'usr_123',
      userName: 'Test User',
      userEmail: 'test@example.com',
      plan: 'monthly',
      checkoutReference: 'chk_monthly',
      externalReference: 'curria:v1:u:usr_123:c:chk_monthly',
      successUrl: 'https://curria.test/dashboard',
      cancelUrl: 'https://curria.test/pricing',
      expiredUrl: 'https://curria.test/pricing',
      billingInfo: {
        cpfCnpj: '12345678901234',
        phoneNumber: '11999999999',
        address: 'Rua Test',
        addressNumber: '123',
        postalCode: '01234567',
        province: 'SP',
      },
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
      customerData: {
        name: 'Test User',
        email: 'test@example.com',
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
      externalReference: 'curria:v1:u:usr_123:c:chk_monthly',
    })
    expect(mockPost).not.toHaveBeenCalledWith('/checkouts', expect.objectContaining({
      chargeTypes: ['RECURRENT'],
      billingTypes: ['PIX', 'CREDIT_CARD'],
    }))
  })
})
