import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

import { POST } from './route'
import { getProcessedEvent } from '@/lib/asaas/idempotency'
import {
  handlePaymentReceived,
  handleSubscriptionCanceled,
  handleSubscriptionCreated,
  handleSubscriptionRenewed,
} from '@/lib/asaas/event-handlers'

vi.mock('@/lib/asaas/idempotency', () => ({
  computeEventFingerprint: vi.fn(() => 'fp_123'),
  getProcessedEvent: vi.fn(),
}))

vi.mock('@/lib/asaas/event-handlers', () => ({
  handlePaymentReceived: vi.fn(),
  handleSubscriptionCreated: vi.fn(),
  handleSubscriptionRenewed: vi.fn(),
  handleSubscriptionCanceled: vi.fn(),
}))

function createRequest(payload: unknown, token = 'test-token'): NextRequest {
  return new NextRequest('http://localhost/api/webhook/asaas', {
    method: 'POST',
    headers: {
      'asaas-access-token': token,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
}

describe('Asaas webhook route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.ASAAS_ACCESS_TOKEN = 'test-token'
    vi.mocked(getProcessedEvent).mockResolvedValue(false)
    vi.mocked(handlePaymentReceived).mockResolvedValue('processed')
    vi.mocked(handleSubscriptionCreated).mockResolvedValue('processed')
    vi.mocked(handleSubscriptionRenewed).mockResolvedValue('processed')
    vi.mocked(handleSubscriptionCanceled).mockResolvedValue('processed')
  })

  it('rejects webhook requests with an invalid token', async () => {
    const response = await POST(createRequest({
      event: 'PAYMENT_RECEIVED',
      amount: 1900,
      payment: { id: 'pay_123', externalReference: 'curria:v1:u:usr_123:c:chk_123', amount: 1900 },
    }, 'wrong-token'))

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({
      success: false,
      code: 'UNAUTHORIZED',
      error: 'Unauthorized',
    })
  })

  it('skips duplicate events before invoking handlers', async () => {
    vi.mocked(getProcessedEvent).mockResolvedValue(true)

    const response = await POST(createRequest({
      event: 'PAYMENT_RECEIVED',
      amount: 1900,
      payment: { id: 'pay_123', externalReference: 'curria:v1:u:usr_123:c:chk_123', amount: 1900 },
    }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true, cached: true })
    expect(handlePaymentReceived).not.toHaveBeenCalled()
  })

  it('routes payment events to the payment handler', async () => {
    const response = await POST(createRequest({
      event: 'PAYMENT_RECEIVED',
      amount: 1900,
      payment: { id: 'pay_123', externalReference: 'curria:v1:u:usr_123:c:chk_123', amount: 1900 },
    }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true })
    expect(handlePaymentReceived).toHaveBeenCalledWith({
      event: 'PAYMENT_RECEIVED',
      amount: 1900,
      payment: { id: 'pay_123', externalReference: 'curria:v1:u:usr_123:c:chk_123', amount: 1900 },
    }, 'fp_123')
  })

  it('returns structured validation failures from billing handlers', async () => {
    vi.mocked(handlePaymentReceived).mockRejectedValue(
      Object.assign(new Error('Billing checkout record not found for externalReference.'), {
        code: 'VALIDATION_ERROR',
        status: 400,
      }),
    )

    const response = await POST(createRequest({
      event: 'PAYMENT_RECEIVED',
      amount: 1900,
      payment: { id: 'pay_123', externalReference: 'curria:v1:u:usr_123:c:chk_missing', amount: 1900 },
    }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      success: false,
      code: 'VALIDATION_ERROR',
      error: 'Billing checkout record not found for externalReference.',
    })
  })

  it('keeps failed webhooks retryable by not converting them to success', async () => {
    vi.mocked(handlePaymentReceived).mockRejectedValue(new Error('temporary failure'))

    const response = await POST(createRequest({
      event: 'PAYMENT_RECEIVED',
      amount: 1900,
      payment: { id: 'pay_123', externalReference: 'curria:v1:u:usr_123:c:chk_123', amount: 1900 },
    }))

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({
      success: false,
      code: 'INTERNAL_ERROR',
      error: 'temporary failure',
    })
  })

  it('processes a later retry successfully after an earlier temporary failure', async () => {
    vi.mocked(handlePaymentReceived)
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValueOnce('processed')
    vi.mocked(getProcessedEvent)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)

    const payload = {
      event: 'PAYMENT_RECEIVED' as const,
      amount: 1900,
      payment: { id: 'pay_123', externalReference: 'curria:v1:u:usr_123:c:chk_123', amount: 1900 },
    }

    const firstResponse = await POST(createRequest(payload))
    const secondResponse = await POST(createRequest(payload))

    expect(firstResponse.status).toBe(500)
    expect(await firstResponse.json()).toEqual({
      success: false,
      code: 'INTERNAL_ERROR',
      error: 'temporary failure',
    })

    expect(secondResponse.status).toBe(200)
    expect(await secondResponse.json()).toEqual({ success: true })
    expect(handlePaymentReceived).toHaveBeenCalledTimes(2)
  })

  it('handles concurrent identical webhook deliveries when the second arrival is deduplicated downstream', async () => {
    vi.mocked(getProcessedEvent).mockResolvedValue(false)
    vi.mocked(handlePaymentReceived)
      .mockImplementationOnce(
        () =>
          new Promise<'processed'>((resolve) => {
            setTimeout(() => resolve('processed'), 25)
          }),
      )
      .mockResolvedValueOnce('duplicate')

    const payload = {
      event: 'PAYMENT_RECEIVED' as const,
      amount: 1900,
      payment: { id: 'pay_123', externalReference: 'curria:v1:u:usr_123:c:chk_123', amount: 1900 },
    }

    const firstRequest = POST(createRequest(payload))
    const secondRequest = POST(createRequest(payload))

    const [firstResponse, secondResponse] = await Promise.all([firstRequest, secondRequest])
    const firstBody = await firstResponse.json()
    const secondBody = await secondResponse.json()

    expect(handlePaymentReceived).toHaveBeenCalledTimes(2)
    expect([firstBody, secondBody]).toContainEqual({ success: true })
    expect([firstBody, secondBody]).toContainEqual({ success: true, cached: true })
  })
})
