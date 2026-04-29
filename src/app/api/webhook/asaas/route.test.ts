import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

import { POST } from './route'
import { computeEventFingerprint, getProcessedEvent } from '@/lib/asaas/idempotency'
import {
  handlePaymentSettlement,
  reconcileProcessedEventState,
  handleSubscriptionCanceled,
  handleSubscriptionCreated,
  handleSubscriptionRenewed,
  handleSubscriptionUpdated,
} from '@/lib/asaas/event-handlers'

// Mock rate limiter before importing the route
const mockWebhookLimiter = vi.hoisted(() => ({
  limit: vi.fn(async () => ({ success: true })),
}))
const mockLogWarn = vi.hoisted(() => vi.fn())

vi.mock('@/lib/rate-limit', () => ({
  webhookLimiter: mockWebhookLimiter,
  agentLimiter: vi.fn(),
  publicLimiter: vi.fn(),
}))

vi.mock('@/lib/asaas/idempotency', () => ({
  computeEventFingerprint: vi.fn(() => 'fp_123'),
  getProcessedEvent: vi.fn(),
}))

vi.mock('@/lib/asaas/event-handlers', () => ({
  handlePaymentSettlement: vi.fn(),
  reconcileProcessedEventState: vi.fn(),
  handleSubscriptionCreated: vi.fn(),
  handleSubscriptionUpdated: vi.fn(),
  handleSubscriptionRenewed: vi.fn(),
  handleSubscriptionCanceled: vi.fn(),
}))

vi.mock('@/lib/observability/structured-log', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: mockLogWarn,
  serializeError: (error: unknown) => (
    error instanceof Error ? { errorMessage: error.message } : {}
  ),
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
    process.env.ASAAS_WEBHOOK_TOKEN = 'test-token'
    mockWebhookLimiter.limit.mockResolvedValue({ success: true })
    vi.mocked(getProcessedEvent).mockResolvedValue(false)
    vi.mocked(handlePaymentSettlement).mockResolvedValue('processed')
    vi.mocked(reconcileProcessedEventState).mockResolvedValue()
    vi.mocked(handleSubscriptionCreated).mockResolvedValue('processed')
    vi.mocked(handleSubscriptionUpdated).mockResolvedValue('processed')
    vi.mocked(handleSubscriptionRenewed).mockResolvedValue('processed')
    vi.mocked(handleSubscriptionCanceled).mockResolvedValue('processed')
  })

  it('rejects webhook requests with an invalid token', async () => {
    const response = await POST(createRequest({
      event: 'PAYMENT_RECEIVED',
      payment: { id: 'pay_123', externalReference: 'curria:v1:c:chk_123', value: 19.9 },
    }, 'wrong-token'))

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({
      success: false,
      code: 'UNAUTHORIZED',
      error: 'Unauthorized',
    })
    expect(mockLogWarn).toHaveBeenCalledWith('asaas.webhook.unauthorized', expect.objectContaining({
      tokenPresent: true,
      tokenTrimmedPresent: true,
      tokenLength: 'wrong-token'.length,
      tokenTrimmedLength: 'wrong-token'.length,
      tokenFingerprint: expect.any(String),
      expectedTokenLength: 'test-token'.length,
      expectedTokenFingerprint: expect.any(String),
    }))
  })

  it('accepts webhook requests when the provider token has surrounding whitespace', async () => {
    const response = await POST(createRequest({
      event: 'PAYMENT_RECEIVED',
      payment: { id: 'pay_123', externalReference: 'curria:v1:c:chk_123', value: 19.9 },
    }, ' test-token '))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true })
    expect(handlePaymentSettlement).toHaveBeenCalledTimes(1)
    expect(mockWebhookLimiter.limit).toHaveBeenCalledWith('test-token')
  })

  it('rejects webhook requests when the auth token header is missing', async () => {
    const response = await POST(new NextRequest('http://localhost/api/webhook/asaas', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        event: 'PAYMENT_RECEIVED',
        payment: { id: 'pay_123', externalReference: 'curria:v1:c:chk_123', value: 19.9 },
      }),
    }))

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({
      success: false,
      code: 'UNAUTHORIZED',
      error: 'Unauthorized',
    })
  })

  it('returns 500 when ASAAS_WEBHOOK_TOKEN is missing', async () => {
    delete process.env.ASAAS_WEBHOOK_TOKEN

    const response = await POST(createRequest({
      event: 'PAYMENT_RECEIVED',
      payment: { id: 'pay_123', externalReference: 'curria:v1:c:chk_123', value: 19.9 },
    }))

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({
      success: false,
      code: 'INTERNAL_ERROR',
      error: 'Missing required environment variable ASAAS_WEBHOOK_TOKEN for Asaas webhook.',
    })
    expect(mockWebhookLimiter.limit).not.toHaveBeenCalled()
  })

  it('returns 200 ignored for unsupported official events instead of 400', async () => {
    const response = await POST(createRequest({
      event: 'PAYMENT_CREATED',
      payment: { id: 'pay_123', externalReference: 'curria:v1:c:chk_123', value: 19.9 },
    }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true, ignored: true })
    expect(computeEventFingerprint).not.toHaveBeenCalled()
    expect(handlePaymentSettlement).not.toHaveBeenCalled()
  })

  it('returns 400 for malformed webhook payloads before any billing handler runs', async () => {
    const response = await POST(createRequest({
      event: 'PAYMENT_CONFIRMED',
    }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      success: false,
      code: 'VALIDATION_ERROR',
      error: 'PAYMENT_CONFIRMED events require a payment object.',
    })
    expect(computeEventFingerprint).not.toHaveBeenCalled()
    expect(handlePaymentSettlement).not.toHaveBeenCalled()
  })

  it('skips duplicate events before invoking handlers', async () => {
    vi.mocked(getProcessedEvent).mockResolvedValue(true)

    const response = await POST(createRequest({
      event: 'PAYMENT_CONFIRMED',
      payment: { id: 'pay_123', externalReference: 'curria:v1:c:chk_123', value: 19.9 },
    }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true, cached: true })
    expect(handlePaymentSettlement).not.toHaveBeenCalled()
    expect(reconcileProcessedEventState).toHaveBeenCalledWith({
      event: 'PAYMENT_CONFIRMED',
      payment: { id: 'pay_123', externalReference: 'curria:v1:c:chk_123', value: 19.9 },
    })
  })

  it('routes settled payment events to the settlement handler', async () => {
    const payload = {
      event: 'PAYMENT_CONFIRMED',
      payment: { id: 'pay_123', externalReference: 'curria:v1:c:chk_123', value: 19.9 },
    }

    const response = await POST(createRequest(payload))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true })
    expect(handlePaymentSettlement).toHaveBeenCalledWith(payload, 'fp_123')
  })

  it('keeps trusting the webhook token contract even when an Origin header is present', async () => {
    const response = await POST(new NextRequest('http://localhost/api/webhook/asaas', {
      method: 'POST',
      headers: {
        'asaas-access-token': 'test-token',
        'content-type': 'application/json',
        origin: 'https://evil.example',
      },
      body: JSON.stringify({
        event: 'PAYMENT_RECEIVED',
        payment: { id: 'pay_123', externalReference: 'curria:v1:c:chk_123', value: 19.9 },
      }),
    }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true })
    expect(handlePaymentSettlement).toHaveBeenCalledTimes(1)
  })

  it('returns structured validation failures from billing handlers', async () => {
    vi.mocked(handlePaymentSettlement).mockRejectedValue(
      Object.assign(new Error('Billing checkout record not found for externalReference.'), {
        code: 'VALIDATION_ERROR',
        status: 400,
      }),
    )

    const response = await POST(createRequest({
      event: 'PAYMENT_RECEIVED',
      payment: { id: 'pay_123', externalReference: 'curria:v1:c:chk_missing', value: 19.9 },
    }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      success: false,
      code: 'VALIDATION_ERROR',
      error: 'Billing checkout record not found for externalReference.',
    })
  })

  it('returns 200 ignored when the subscription handler intentionally no-ops a snapshot', async () => {
    vi.mocked(handleSubscriptionCreated).mockResolvedValueOnce('ignored')

    const response = await POST(createRequest({
      event: 'SUBSCRIPTION_CREATED',
      subscription: {
        id: 'sub_123',
        externalReference: 'curria:v1:c:chk_123',
        status: 'INACTIVE',
        deleted: true,
        value: 39,
      },
    }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true, ignored: true })
  })

  it('keeps failed webhooks retryable by not converting them to success', async () => {
    vi.mocked(handlePaymentSettlement).mockRejectedValue(new Error('temporary failure'))

    const response = await POST(createRequest({
      event: 'PAYMENT_RECEIVED',
      payment: { id: 'pay_123', externalReference: 'curria:v1:c:chk_123', value: 19.9 },
    }))

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({
      success: false,
      code: 'INTERNAL_ERROR',
      error: 'temporary failure',
    })
  })

  it('processes a later retry successfully after an earlier temporary failure', async () => {
    vi.mocked(handlePaymentSettlement)
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValueOnce('processed')
    vi.mocked(getProcessedEvent)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)

    const payload = {
      event: 'PAYMENT_RECEIVED',
      payment: { id: 'pay_123', externalReference: 'curria:v1:c:chk_123', value: 19.9 },
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
    expect(handlePaymentSettlement).toHaveBeenCalledTimes(2)
  })

  it('handles concurrent identical webhook deliveries when the second arrival is deduplicated downstream', async () => {
    vi.mocked(getProcessedEvent).mockResolvedValue(false)
    vi.mocked(handlePaymentSettlement)
      .mockImplementationOnce(
        () =>
          new Promise<'processed'>((resolve) => {
            setTimeout(() => resolve('processed'), 25)
          }),
      )
      .mockResolvedValueOnce('duplicate')

    const payload = {
      event: 'PAYMENT_RECEIVED',
      payment: { id: 'pay_123', externalReference: 'curria:v1:c:chk_123', value: 19.9 },
    }

    const firstRequest = POST(createRequest(payload))
    const secondRequest = POST(createRequest(payload))

    const [firstResponse, secondResponse] = await Promise.all([firstRequest, secondRequest])
    const firstBody = await firstResponse.json()
    const secondBody = await secondResponse.json()

    expect(handlePaymentSettlement).toHaveBeenCalledTimes(2)
    expect(reconcileProcessedEventState).toHaveBeenCalledTimes(1)
    expect([firstBody, secondBody]).toContainEqual({ success: true })
    expect([firstBody, secondBody]).toContainEqual({ success: true, cached: true })
  })
})
