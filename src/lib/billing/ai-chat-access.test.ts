import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  AI_CHAT_ACCESS_UNAVAILABLE_CODE,
  AI_CHAT_PRO_REQUIRED_CODE,
  AI_CHAT_UPGRADE_URL,
  resolveAiChatAccessFromBillingMetadata,
} from '@/lib/billing/ai-chat-access'
import { getAiChatAccess } from '@/lib/billing/ai-chat-access.server'
import { createSignedE2EAuthCookie } from '@/lib/auth/e2e-auth'
import { getUserBillingMetadata } from '@/lib/asaas/quota'
import { cookies } from 'next/headers'

vi.mock('@/lib/asaas/quota', () => ({
  getUserBillingMetadata: vi.fn(),
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}))

const originalEnabled = process.env.E2E_AUTH_ENABLED
const originalSecret = process.env.E2E_AUTH_BYPASS_SECRET
const originalNodeEnv = process.env.NODE_ENV
const originalCi = process.env.CI

describe('ai chat access', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.E2E_AUTH_ENABLED
    delete process.env.E2E_AUTH_BYPASS_SECRET
    ;(process.env as Record<string, string | undefined>).NODE_ENV = 'test'
    process.env.CI = 'false'
    vi.mocked(cookies).mockReturnValue({
      get: vi.fn(() => undefined),
    } as unknown as ReturnType<typeof cookies>)
  })

  afterAll(() => {
    if (originalEnabled === undefined) {
      delete process.env.E2E_AUTH_ENABLED
    } else {
      process.env.E2E_AUTH_ENABLED = originalEnabled
    }

    if (originalSecret === undefined) {
      delete process.env.E2E_AUTH_BYPASS_SECRET
    } else {
      process.env.E2E_AUTH_BYPASS_SECRET = originalSecret
    }

    if (originalNodeEnv === undefined) {
      delete (process.env as Record<string, string | undefined>).NODE_ENV
    } else {
      ;(process.env as Record<string, string | undefined>).NODE_ENV = originalNodeEnv
    }

    if (originalCi === undefined) {
      delete process.env.CI
    } else {
      process.env.CI = originalCi
    }
  })

  it('allows a synthetic E2E-authenticated user without querying billing metadata', async () => {
    process.env.E2E_AUTH_ENABLED = 'true'
    process.env.E2E_AUTH_BYPASS_SECRET = 'test-e2e-secret'

    const cookie = await createSignedE2EAuthCookie({
      appUserId: 'usr_e2e_chat',
      displayName: 'E2E Chat User',
      primaryEmail: 'e2e@example.com',
    })

    vi.mocked(cookies).mockReturnValue({
      get: vi.fn((name: string) => (
        name === 'curria_e2e_auth'
          ? { name, value: cookie }
          : undefined
      )),
    } as unknown as ReturnType<typeof cookies>)

    await expect(getAiChatAccess('usr_e2e_chat')).resolves.toEqual({
      allowed: true,
      feature: 'ai_chat',
      reason: 'active_pro',
      plan: 'pro',
      status: 'active',
      renewsAt: null,
      asaasSubscriptionId: 'e2e_auth_bypass',
    })
    expect(getUserBillingMetadata).not.toHaveBeenCalled()
  })

  it('allows users with an active Pro subscription', () => {
    const decision = resolveAiChatAccessFromBillingMetadata({
      plan: 'pro',
      renewsAt: '2026-05-20T00:00:00.000Z',
      status: 'active',
      asaasSubscriptionId: 'sub_pro_123',
    }, {
      now: new Date('2026-04-25T00:00:00.000Z'),
    })

    expect(decision).toEqual({
      allowed: true,
      feature: 'ai_chat',
      reason: 'active_pro',
      plan: 'pro',
      status: 'active',
      renewsAt: '2026-05-20T00:00:00.000Z',
      asaasSubscriptionId: 'sub_pro_123',
    })
  })

  it('allows active Pro subscriptions even when renewsAt is missing', () => {
    const decision = resolveAiChatAccessFromBillingMetadata({
      plan: 'pro',
      renewsAt: null,
      status: 'active',
      asaasSubscriptionId: 'sub_pro_123',
    })

    expect(decision.allowed).toBe(true)
  })

  it('denies non-Pro plans and returns the upgrade path', () => {
    const decision = resolveAiChatAccessFromBillingMetadata({
      plan: 'monthly',
      renewsAt: '2026-05-20T00:00:00.000Z',
      status: 'active',
      asaasSubscriptionId: 'sub_monthly_123',
    })

    expect(decision).toMatchObject({
      allowed: false,
      reason: 'plan_not_pro',
      code: AI_CHAT_PRO_REQUIRED_CODE,
      upgradeUrl: AI_CHAT_UPGRADE_URL,
      plan: 'monthly',
    })
  })

  it('denies inactive Pro subscriptions', () => {
    const decision = resolveAiChatAccessFromBillingMetadata({
      plan: 'pro',
      renewsAt: '2026-05-20T00:00:00.000Z',
      status: 'canceled',
      asaasSubscriptionId: 'sub_pro_123',
    })

    expect(decision).toMatchObject({
      allowed: false,
      reason: 'subscription_inactive',
      code: AI_CHAT_PRO_REQUIRED_CODE,
    })
  })

  it('denies expired Pro subscriptions when renewsAt is in the past', () => {
    const decision = resolveAiChatAccessFromBillingMetadata({
      plan: 'pro',
      renewsAt: '2026-04-20T00:00:00.000Z',
      status: 'active',
      asaasSubscriptionId: 'sub_pro_123',
    }, {
      now: new Date('2026-04-25T00:00:00.000Z'),
    })

    expect(decision).toMatchObject({
      allowed: false,
      reason: 'subscription_expired',
      code: AI_CHAT_PRO_REQUIRED_CODE,
    })
  })

  it('denies missing billing metadata by default', () => {
    const decision = resolveAiChatAccessFromBillingMetadata(null)

    expect(decision).toMatchObject({
      allowed: false,
      reason: 'billing_missing',
      code: AI_CHAT_PRO_REQUIRED_CODE,
    })
  })

  it('denies access when the billing lookup fails', async () => {
    vi.mocked(getUserBillingMetadata).mockRejectedValue(new Error('lookup failed'))

    await expect(getAiChatAccess('usr_123')).resolves.toMatchObject({
      allowed: false,
      reason: 'billing_unavailable',
      code: AI_CHAT_ACCESS_UNAVAILABLE_CODE,
    })
  })
})
