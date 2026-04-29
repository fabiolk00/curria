import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getCurrentAppUser } from '@/lib/auth/app-user'
import { getAiChatAccess } from '@/lib/billing/ai-chat-access.server'
import { getMessages, getSession } from '@/lib/db/sessions'
import { logError, logWarn } from '@/lib/observability/structured-log'

import { GET } from './route'

vi.mock('@/lib/auth/app-user', () => ({
  getCurrentAppUser: vi.fn(),
}))

vi.mock('@/lib/billing/ai-chat-access.server', () => ({
  getAiChatAccess: vi.fn(),
}))

vi.mock('@/lib/db/sessions', () => ({
  getSession: vi.fn(),
  getMessages: vi.fn(),
}))

vi.mock('@/lib/observability/structured-log', () => ({
  logError: vi.fn(),
  logWarn: vi.fn(),
  serializeError: (error: unknown) => ({
    errorMessage: error instanceof Error ? error.message : String(error),
  }),
}))

describe('GET /api/session/[id]/messages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAiChatAccess).mockResolvedValue({
      allowed: true,
      feature: 'ai_chat',
      reason: 'active_pro',
      plan: 'pro',
      status: 'active',
      renewsAt: '2026-05-20T00:00:00.000Z',
      asaasSubscriptionId: 'sub_123',
    })
  })

  it('returns 403 when the authenticated user is not entitled to AI chat', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValue({
      id: 'usr_123',
    } as Awaited<ReturnType<typeof getCurrentAppUser>>)
    vi.mocked(getAiChatAccess).mockResolvedValue({
      allowed: false,
      feature: 'ai_chat',
      reason: 'plan_not_pro',
      plan: 'monthly',
      status: 'active',
      renewsAt: '2026-05-20T00:00:00.000Z',
      asaasSubscriptionId: 'sub_123',
      code: 'PRO_PLAN_REQUIRED',
      title: 'Chat com IA exclusivo do plano PRO',
      message: 'Este recurso está disponível apenas para usuários do plano PRO. Faça upgrade para acessar o chat com IA.',
      upgradeUrl: '/finalizar-compra?plan=pro',
    })

    const response = await GET(
      new NextRequest('https://example.com/api/session/sess_123/messages'),
      { params: { id: 'sess_123' } },
    )

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({
      error: 'Este recurso está disponível apenas para usuários do plano PRO. Faça upgrade para acessar o chat com IA.',
      title: 'Chat com IA exclusivo do plano PRO',
      code: 'PRO_PLAN_REQUIRED',
      upgradeUrl: '/finalizar-compra?plan=pro',
    })
    expect(getSession).not.toHaveBeenCalled()
    expect(getMessages).not.toHaveBeenCalled()
    expect(getAiChatAccess).toHaveBeenCalledWith('usr_123')
    expect(logWarn).toHaveBeenCalledWith('api.session.messages_forbidden', expect.objectContaining({
      requestMethod: 'GET',
      requestPath: '/api/session/sess_123/messages',
      sessionId: 'sess_123',
      appUserId: 'usr_123',
      aiChatAccessReason: 'plan_not_pro',
      aiChatAccessCode: 'PRO_PLAN_REQUIRED',
      success: false,
    }))
  })

  it('scopes history lookups to the authenticated user so another user cannot read them', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValue({
      id: 'usr_other',
    } as Awaited<ReturnType<typeof getCurrentAppUser>>)
    vi.mocked(getSession).mockResolvedValue(null)

    const response = await GET(
      new NextRequest('https://example.com/api/session/sess_foreign/messages'),
      { params: { id: 'sess_foreign' } },
    )

    expect(response.status).toBe(404)
    expect(getSession).toHaveBeenCalledWith('sess_foreign', 'usr_other')
    expect(getMessages).not.toHaveBeenCalled()
  })

  it('logs not-found access with session context', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValue({
      id: 'usr_123',
    } as Awaited<ReturnType<typeof getCurrentAppUser>>)
    vi.mocked(getSession).mockResolvedValue(null)

    const response = await GET(
      new NextRequest('https://example.com/api/session/sess_123/messages'),
      { params: { id: 'sess_123' } },
    )

    expect(response.status).toBe(404)
    expect(logWarn).toHaveBeenCalledWith('api.session.messages_not_found', expect.objectContaining({
      requestMethod: 'GET',
      requestPath: '/api/session/sess_123/messages',
      sessionId: 'sess_123',
      appUserId: 'usr_123',
      success: false,
    }))
  })

  it('logs structured failures when message retrieval throws', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValue({
      id: 'usr_123',
    } as Awaited<ReturnType<typeof getCurrentAppUser>>)
    vi.mocked(getSession).mockResolvedValue({
      id: 'sess_123',
      userId: 'usr_123',
    } as Awaited<ReturnType<typeof getSession>>)
    vi.mocked(getMessages).mockRejectedValue(new Error('messages down'))

    const response = await GET(
      new NextRequest('https://example.com/api/session/sess_123/messages'),
      { params: { id: 'sess_123' } },
    )

    expect(response.status).toBe(500)
    expect(logError).toHaveBeenCalledWith('api.session.messages_failed', expect.objectContaining({
      requestMethod: 'GET',
      requestPath: '/api/session/sess_123/messages',
      sessionId: 'sess_123',
      appUserId: 'usr_123',
      success: false,
      errorMessage: 'messages down',
    }))
  })
})
