import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

import { currentUser } from '@clerk/nextjs/server'

import { POST } from './route'
import { getCurrentAppUser } from '@/lib/auth/app-user'
import {
  createCheckoutRecordPending,
  markCheckoutCreated,
  markCheckoutFailed,
} from '@/lib/asaas/billing-checkouts'
import { createCheckoutLink } from '@/lib/asaas/checkout'
import { getActiveRecurringSubscription } from '@/lib/asaas/quota'

vi.mock('@clerk/nextjs/server', () => ({
  currentUser: vi.fn(),
}))

vi.mock('@/lib/auth/app-user', () => ({
  getCurrentAppUser: vi.fn(),
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

describe('checkout route billing sequencing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
    vi.mocked(createCheckoutRecordPending).mockResolvedValue({
      id: 'bc_123',
      userId: 'usr_123',
      checkoutReference: 'chk_123',
      plan: 'monthly',
      amountMinor: 3900,
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

  it('creates a pending record before calling Asaas and marks it created on success', async () => {
    const response = await POST(new NextRequest('http://localhost/api/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({ plan: 'monthly' }),
    }))

    expect(response.status).toBe(200)
    expect(vi.mocked(createCheckoutRecordPending).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(createCheckoutLink).mock.invocationCallOrder[0],
    )
    expect(vi.mocked(createCheckoutLink)).toHaveBeenCalledWith(expect.objectContaining({
      checkoutReference: 'chk_123',
      externalReference: 'curria:v1:c:chk_123',
    }))
    expect(markCheckoutCreated).toHaveBeenCalledWith('chk_123', 'https://asaas.test/pay')
    expect(await response.json()).toEqual({ url: 'https://asaas.test/pay' })
  })

  it('marks the checkout failed when Asaas creation fails', async () => {
    vi.mocked(createCheckoutLink).mockRejectedValueOnce(new Error('asaas down'))

    const response = await POST(new NextRequest('http://localhost/api/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ plan: 'monthly' }),
    }))

    expect(response.status).toBe(500)
    expect(markCheckoutFailed).toHaveBeenCalledWith('chk_123', 'asaas down')
  })

  it('returns unauthorized when no active app user is available', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValueOnce(null)

    const response = await POST(new NextRequest('http://localhost/api/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ plan: 'monthly' }),
    }))

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(createCheckoutRecordPending).not.toHaveBeenCalled()
  })

  it('returns a json error when resolving the app user throws', async () => {
    vi.mocked(getCurrentAppUser).mockRejectedValueOnce(new Error('bootstrap failed'))

    const response = await POST(new NextRequest('http://localhost/api/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ plan: 'monthly' }),
    }))

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Internal server error' })
    expect(markCheckoutFailed).not.toHaveBeenCalled()
  })

  it('continues checkout when Clerk profile lookup fails', async () => {
    vi.mocked(currentUser).mockRejectedValueOnce(new Error('clerk profile unavailable'))

    const response = await POST(new NextRequest('http://localhost/api/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({ plan: 'monthly' }),
    }))

    expect(response.status).toBe(200)
    expect(createCheckoutLink).toHaveBeenCalledWith(expect.objectContaining({
      userName: 'Usuario CurrIA',
      userEmail: null,
    }))
  })

  it('marks the checkout failed when persisting the created state fails after Asaas succeeds', async () => {
    vi.mocked(markCheckoutCreated).mockRejectedValueOnce(new Error('failed to mark created'))

    const response = await POST(new NextRequest('http://localhost/api/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({ plan: 'monthly' }),
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

    const response = await POST(new NextRequest('http://localhost/api/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({ plan: 'monthly' }),
    }))

    expect(response.status).toBe(500)
    expect(createCheckoutLink).not.toHaveBeenCalled()
    expect(markCheckoutFailed).toHaveBeenCalledWith(
      'chk_123',
      'Invalid app user id for externalReference: invalid user id',
    )
  })

  it('blocks a new monthly checkout when the user already has an active recurring subscription', async () => {
    vi.mocked(getActiveRecurringSubscription).mockResolvedValueOnce({
      plan: 'monthly',
      asaasSubscriptionId: 'sub_123',
      renewsAt: '2026-04-30T00:00:00.000Z',
    })

    const response = await POST(
      new NextRequest('http://localhost/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ plan: 'pro' }),
      }),
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error:
        'Voce ja possui um plano mensal ativo. Cancele o plano atual antes de contratar outro plano mensal.',
    })
    expect(createCheckoutRecordPending).not.toHaveBeenCalled()
    expect(createCheckoutLink).not.toHaveBeenCalled()
  })

  it('allows a new monthly checkout when the previous subscription is not active anymore', async () => {
    vi.mocked(getActiveRecurringSubscription).mockResolvedValueOnce(null)

    const response = await POST(
      new NextRequest('http://localhost/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
        body: JSON.stringify({ plan: 'pro' }),
      }),
    )

    expect(response.status).toBe(200)
    expect(createCheckoutRecordPending).toHaveBeenCalled()
  })

  it('fails closed when recurring subscription validation is unavailable', async () => {
    vi.mocked(getActiveRecurringSubscription).mockRejectedValueOnce(
      new Error('billing lookup unavailable'),
    )

    const response = await POST(
      new NextRequest('http://localhost/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ plan: 'monthly' }),
      }),
    )

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({
      error: 'Nao foi possivel validar seu plano atual no momento. Tente novamente em instantes.',
    })
    expect(createCheckoutRecordPending).not.toHaveBeenCalled()
  })
})
