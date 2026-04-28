import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getCurrentAppUser } from '@/lib/auth/app-user'
import { getAiChatAccess } from '@/lib/billing/ai-chat-access.server'
import { getSession } from '@/lib/db/sessions'
import { logWarn } from '@/lib/observability/structured-log'

import { GET } from './route'

vi.mock('@/lib/auth/app-user', () => ({
  getCurrentAppUser: vi.fn(),
}))

vi.mock('@/lib/billing/ai-chat-access.server', () => ({
  getAiChatAccess: vi.fn(),
}))

vi.mock('@/lib/db/sessions', () => ({
  getSession: vi.fn(),
}))

vi.mock('@/lib/observability/structured-log', () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}))

function buildSession() {
  return {
    id: 'sess_123',
    userId: 'usr_123',
    phase: 'dialog',
    stateVersion: 1,
    cvState: {
      fullName: 'Ana Silva',
      email: 'ana@example.com',
      phone: '555-0100',
      summary: 'Resumo base.',
      experience: [],
      skills: ['SQL'],
      education: [],
    },
    agentState: {
      workflowMode: 'job_targeting',
      targetJobDescription: 'Vaga alvo',
    },
    generatedOutput: { status: 'idle' },
    creditsUsed: 0,
    messageCount: 0,
    creditConsumed: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

describe('GET /api/session/[id]/ai-chat-snapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentAppUser).mockResolvedValue({ id: 'usr_123' } as never)
    vi.mocked(getSession).mockResolvedValue(buildSession() as never)
  })

  it('keeps AI chat snapshot protected for non-Pro users', async () => {
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
      message: 'Este recurso esta disponivel apenas para usuarios do plano PRO.',
      upgradeUrl: '/finalizar-compra?plan=pro',
    })

    const response = await GET(
      new NextRequest('https://example.com/api/session/sess_123/ai-chat-snapshot'),
      { params: { id: 'sess_123' } },
    )

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({
      error: 'Este recurso esta disponivel apenas para usuarios do plano PRO.',
      title: 'Chat com IA exclusivo do plano PRO',
      code: 'PRO_PLAN_REQUIRED',
      upgradeUrl: '/finalizar-compra?plan=pro',
    })
    expect(logWarn).toHaveBeenCalledWith('api.session.ai_chat_snapshot_forbidden', expect.objectContaining({
      requestPath: '/api/session/sess_123/ai-chat-snapshot',
      aiChatAccessReason: 'plan_not_pro',
      aiChatAccessCode: 'PRO_PLAN_REQUIRED',
      success: false,
    }))
  })
})
