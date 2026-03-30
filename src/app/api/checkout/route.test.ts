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
      externalReference: 'curria:v1:u:usr_123:c:chk_123',
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
})
