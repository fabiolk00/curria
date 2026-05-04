import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

import { currentUser } from '@clerk/nextjs/server'

import { POST } from './route'
import { getCurrentAppUser } from '@/lib/auth/app-user'
import { saveBillingInfo } from '@/lib/billing/customer-info'
import {
  createCheckoutRecordPending,
  markCheckoutCreated,
  markCheckoutFailed,
} from '@/lib/asaas/billing-checkouts'
import { createCheckoutLink } from '@/lib/asaas/checkout'
import {
  ACTIVE_MONTHLY_PLAN_ERROR_MESSAGE,
  CHECKOUT_BILLING_SETUP_ERROR_MESSAGE,
  RECURRING_SUBSCRIPTION_VALIDATION_ERROR_MESSAGE,
} from '@/lib/asaas/checkout-errors'
import { getActiveRecurringSubscription } from '@/lib/asaas/quota'
import { buildAppUrl } from '@/lib/config/app-url'

vi.mock('@clerk/nextjs/server', () => ({
  currentUser: vi.fn(),
}))

vi.mock('@/lib/auth/app-user', () => ({
  getCurrentAppUser: vi.fn(),
}))

vi.mock('@/lib/billing/customer-info', () => ({
  saveBillingInfo: vi.fn(),
}))

vi.mock('@/lib/asaas/billing-checkouts', () => ({
  createCheckoutRecordPending: vi.fn(),
  markCheckoutCreated: vi.fn(),
  markCheckoutFailed: vi.fn(),
}))

vi.mock('@/lib/asaas/checkout', () => ({
  createCheckoutLink: vi.fn(),
}))

vi.mock('@/lib/asaas/quota', () => ({
  getActiveRecurringSubscription: vi.fn(),
}))

const mockBillingBody = {
  plan: 'monthly' as const,
  cpfCnpj: '12345678901',
  phoneNumber: '11999999999',
  address: 'Rua X',
  addressNumber: '123',
  postalCode: '01234567',
  province: 'SP',
}

describe('checkout route billing sequencing', () => {
  const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.trampofy.com.br'
    vi.mocked(getCurrentAppUser).mockResolvedValue({
      id: 'usr_123',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      authIdentity: null,
      creditAccount: null,
    } as never)
    vi.mocked(currentUser).mockResolvedValue({
      fullName: 'Test User',
      firstName: 'Test',
      emailAddresses: [{ emailAddress: 'test@example.com' }],
    } as never)
    vi.mocked(saveBillingInfo).mockResolvedValue(undefined)
    vi.mocked(createCheckoutRecordPending).mockResolvedValue({
      id: 'bc_123',
      userId: 'usr_123',
      checkoutReference: 'chk_123',
      plan: 'monthly',
      amountMinor: 3990,
      currency: 'BRL',
      status: 'pending',
      asaasLink: null,
      asaasPaymentId: null,
      asaasSubscriptionId: null,
      createdAt: '2026-03-29T00:00:00.000Z',
      updatedAt: '2026-03-29T00:00:00.000Z',
    })
    vi.mocked(createCheckoutLink).mockResolvedValue('https://asaas.test/pay')
    vi.mocked(getActiveRecurringSubscription).mockResolvedValue(null)
  })

  afterAll(() => {
    if (originalAppUrl === undefined) {
      delete process.env.NEXT_PUBLIC_APP_URL
      return
    }

    process.env.NEXT_PUBLIC_APP_URL = originalAppUrl
  })

  it('creates a pending record before calling Asaas and marks it created on success', async () => {
    const response = await POST(new NextRequest('http://localhost:3000/api/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify(mockBillingBody),
    }))

    expect(response.status).toBe(200)
    expect(vi.mocked(createCheckoutRecordPending).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(createCheckoutLink).mock.invocationCallOrder[0],
    )
    expect(vi.mocked(createCheckoutLink)).toHaveBeenCalledWith(expect.objectContaining({
      checkoutReference: 'chk_123',
      externalReference: 'curria:v1:c:chk_123',
      successUrl: buildAppUrl('/profile-setup'),
      cancelUrl: buildAppUrl('/#pricing'),
      expiredUrl: buildAppUrl('/#pricing'),
      billingInfo: {
        cpfCnpj: '12345678901',
        phoneNumber: '11999999999',
        address: 'Rua X',
        addressNumber: '123',
        postalCode: '01234567',
        province: 'SP',
      },
    }))
    expect(markCheckoutCreated).toHaveBeenCalledWith('chk_123', 'https://asaas.test/pay')
    expect(await response.json()).toEqual({ url: 'https://asaas.test/pay' })
  })

  it('rejects a 7-digit cep before saving billing info', async () => {
    const response = await POST(new NextRequest('http://localhost:3000/api/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({
        ...mockBillingBody,
        postalCode: '8061022',
        province: 'sp',
      }),
    }))

    expect(response.status).toBe(400)
    expect(saveBillingInfo).not.toHaveBeenCalled()
  })

  it('normalizes a country-coded phone number and lowercase state before saving billing info', async () => {
    const response = await POST(new NextRequest('http://localhost:3000/api/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({
        ...mockBillingBody,
        phoneNumber: '+55 (11) 99999-9999',
        province: 'sp',
      }),
    }))

    expect(response.status).toBe(200)
    expect(saveBillingInfo).toHaveBeenCalledWith('usr_123', expect.objectContaining({
      phoneNumber: '11999999999',
      province: 'SP',
    }))
  })

  it('returns a known checkout setup error when the billing table is missing', async () => {
    vi.mocked(saveBillingInfo).mockRejectedValueOnce({
      code: '42P01',
      message: 'relation "customer_billing_info" does not exist',
    })

    const response = await POST(new NextRequest('http://localhost:3000/api/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify(mockBillingBody),
    }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: CHECKOUT_BILLING_SETUP_ERROR_MESSAGE,
    })
    expect(createCheckoutRecordPending).not.toHaveBeenCalled()
  })

  it('marks the checkout failed when Asaas creation fails', async () => {
    vi.mocked(createCheckoutLink).mockRejectedValueOnce(new Error('asaas down'))

    const response = await POST(new NextRequest('http://localhost:3000/api/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify(mockBillingBody),
    }))

    expect(response.status).toBe(500)
    expect(markCheckoutFailed).toHaveBeenCalledWith('chk_123', 'asaas down')
  })

  it('returns unauthorized when no active app user is available', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValueOnce(null)

    const response = await POST(new NextRequest('http://localhost:3000/api/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(mockBillingBody),
    }))

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(createCheckoutRecordPending).not.toHaveBeenCalled()
  })

  it('returns a json error when resolving the app user throws', async () => {
    vi.mocked(getCurrentAppUser).mockRejectedValueOnce(new Error('bootstrap failed'))

    const response = await POST(new NextRequest('http://localhost:3000/api/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(mockBillingBody),
    }))

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Internal server error' })
    expect(markCheckoutFailed).not.toHaveBeenCalled()
  })

  it('continues checkout when Clerk profile lookup fails', async () => {
    vi.mocked(currentUser).mockRejectedValueOnce(new Error('clerk profile unavailable'))

    const response = await POST(new NextRequest('http://localhost:3000/api/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify(mockBillingBody),
    }))

    expect(response.status).toBe(200)
    expect(createCheckoutLink).toHaveBeenCalledWith(expect.objectContaining({
      userName: 'Usuario Trampofy',
      userEmail: null,
      successUrl: buildAppUrl('/profile-setup'),
      cancelUrl: buildAppUrl('/#pricing'),
    }))
  })

  it('rejects a spoofed origin header before creating a checkout session', async () => {
    const response = await POST(new NextRequest('http://localhost:3000/api/checkout', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://evil.example',
      },
      body: JSON.stringify(mockBillingBody),
    }))

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: 'Forbidden' })
    expect(createCheckoutLink).not.toHaveBeenCalled()
  })

  it('rejects checkout when browser trust signals are missing', async () => {
    const response = await POST(new NextRequest('http://localhost:3000/api/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(mockBillingBody),
    }))

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: 'Forbidden' })
    expect(createCheckoutRecordPending).not.toHaveBeenCalled()
  })

  it('marks the checkout failed when persisting the created state fails after Asaas succeeds', async () => {
    vi.mocked(markCheckoutCreated).mockRejectedValueOnce(new Error('failed to mark created'))

    const response = await POST(new NextRequest('http://localhost:3000/api/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify(mockBillingBody),
    }))

    expect(response.status).toBe(500)
    expect(createCheckoutLink).toHaveBeenCalled()
    expect(markCheckoutFailed).toHaveBeenCalledWith('chk_123', 'failed to mark created')
  })

  it('marks the checkout failed when externalReference formatting fails after the pending row exists', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValueOnce({
      id: 'invalid user id',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      authIdentity: null,
      creditAccount: null,
    } as never)

    const response = await POST(new NextRequest('http://localhost:3000/api/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify(mockBillingBody),
    }))

    expect(response.status).toBe(500)
    expect(createCheckoutLink).not.toHaveBeenCalled()
    expect(markCheckoutFailed).toHaveBeenCalledWith(
      'chk_123',
      'Failed to format checkout external reference.',
    )
  })

  it('blocks a new monthly checkout when the user already has an active recurring subscription', async () => {
    vi.mocked(getActiveRecurringSubscription).mockResolvedValueOnce({
      plan: 'monthly',
      asaasSubscriptionId: 'sub_123',
      renewsAt: '2026-04-30T00:00:00.000Z',
    })

    const response = await POST(
      new NextRequest('http://localhost:3000/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
        body: JSON.stringify({ ...mockBillingBody, plan: 'pro' }),
      }),
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: ACTIVE_MONTHLY_PLAN_ERROR_MESSAGE,
    })
    expect(createCheckoutRecordPending).not.toHaveBeenCalled()
    expect(createCheckoutLink).not.toHaveBeenCalled()
  })

  it('allows a new monthly checkout when the previous subscription is not active anymore', async () => {
    vi.mocked(getActiveRecurringSubscription).mockResolvedValueOnce(null)

    const response = await POST(
      new NextRequest('http://localhost:3000/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
        body: JSON.stringify({ ...mockBillingBody, plan: 'pro' }),
      }),
    )

    expect(response.status).toBe(200)
    expect(createCheckoutRecordPending).toHaveBeenCalledWith('usr_123', 'pro', 5990)
  })

  it('fails closed when recurring subscription validation is unavailable', async () => {
    vi.mocked(getActiveRecurringSubscription).mockRejectedValueOnce(
      new Error('billing lookup unavailable'),
    )

    const response = await POST(
      new NextRequest('http://localhost:3000/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
        body: JSON.stringify(mockBillingBody),
      }),
    )

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({
      error: RECURRING_SUBSCRIPTION_VALIDATION_ERROR_MESSAGE,
    })
    expect(createCheckoutRecordPending).not.toHaveBeenCalled()
  })
})
