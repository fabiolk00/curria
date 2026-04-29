import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

import { POST } from './route'
import { getCurrentAppUser } from '@/lib/auth/app-user'
import { getAiChatAccess } from '@/lib/billing/ai-chat-access.server'
import { agentLimiter } from '@/lib/rate-limit'
import {
  appendMessage,
  createSession,
  getSession,
  incrementMessageCount,
  updateSession,
} from '@/lib/db/sessions'
import { createJob } from '@/lib/jobs/repository'
import { startDurableJobProcessing } from '@/lib/jobs/runtime'
import { recordQuery } from '@/lib/observability/request-query-context'
import { logInfo, logWarn } from '@/lib/observability/structured-log'
import { runAgentLoop } from '@/lib/agent/agent-loop'

const { mockReleaseMetadata } = vi.hoisted(() => ({
  mockReleaseMetadata: {
    releaseId: 'rel_route',
    releaseSource: 'test',
    commitShortSha: 'abc123',
    deploymentEnv: 'test',
    resolvedAgentModel: 'gpt-5-mini',
    resolvedDialogModel: 'gpt-5-mini',
  },
}))

vi.mock('@/lib/auth/app-user', () => ({
  getCurrentAppUser: vi.fn(),
}))

vi.mock('@/lib/billing/ai-chat-access.server', () => ({
  getAiChatAccess: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({
  agentLimiter: {
    limit: vi.fn(),
  },
}))

vi.mock('@/lib/db/sessions', () => ({
  appendMessage: vi.fn(),
  createSession: vi.fn(),
  getMessages: vi.fn(async () => []),
  getSession: vi.fn(),
  incrementMessageCount: vi.fn(),
  updateSession: vi.fn(),
}))

vi.mock('@/lib/agent/agent-loop', () => ({
  runAgentLoop: vi.fn(async function* () {
    yield {
      type: 'text',
      content: 'Resposta síncrona.',
    }
    yield {
      type: 'done',
      sessionId: 'sess_existing',
      phase: 'dialog',
      requestId: 'req_sync',
      messageCount: 3,
      maxMessages: 30,
      isNewSession: false,
      toolIterations: 0,
    }
  }),
}))

vi.mock('@/lib/jobs/repository', () => ({
  createJob: vi.fn(),
}))

vi.mock('@/lib/jobs/runtime', () => ({
  startDurableJobProcessing: vi.fn(),
}))

vi.mock('@/lib/observability/structured-log', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  serializeError: (error: unknown) => ({
    errorMessage: error instanceof Error ? error.message : String(error),
  }),
}))

vi.mock('@/lib/runtime/release-metadata', () => ({
  getAgentReleaseMetadata: vi.fn(() => mockReleaseMetadata),
}))

function parseSseDataEvents(payload: string): Array<Record<string, unknown>> {
  return payload
    .split('\n\n')
    .filter((entry) => entry.startsWith('data: '))
    .map((entry) => JSON.parse(entry.replace('data: ', '')) as Record<string, unknown>)
}

function buildSession(overrides?: Record<string, unknown>) {
  return {
    id: 'sess_existing',
    userId: 'usr_123',
    stateVersion: 1,
    phase: 'dialog',
    cvState: {
      fullName: 'Fabio Silva',
      email: 'fabio@example.com',
      phone: '11999999999',
      summary: 'Analista de dados com foco em BI.',
      experience: [],
      skills: ['SQL', 'Power BI'],
      education: [],
    },
    agentState: {
      parseStatus: 'parsed',
      rewriteHistory: {},
      sourceResumeText: 'Resumo salvo.',
    },
    generatedOutput: { status: 'idle' },
    creditsUsed: 1,
    messageCount: 2,
    creditConsumed: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as any
}

describe('/api/agent route', () => {
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
    vi.mocked(getCurrentAppUser).mockResolvedValue({
      id: 'usr_123',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      authIdentity: {
        id: 'identity_123',
        userId: 'usr_123',
        provider: 'clerk',
        providerSubject: 'clerk_123',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      creditAccount: {
        id: 'cred_123',
        userId: 'usr_123',
        creditsRemaining: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    } as any)
    vi.mocked(agentLimiter.limit).mockResolvedValue({
      success: true,
      limit: 15,
      remaining: 14,
      reset: 0,
      pending: Promise.resolve(),
    } as any)
    vi.mocked(getSession).mockResolvedValue(null)
    vi.mocked(createSession).mockResolvedValue(buildSession({
      id: 'sess_new',
      phase: 'intake',
      messageCount: 0,
    }))
    vi.mocked(incrementMessageCount).mockResolvedValue(true)
    vi.mocked(updateSession).mockResolvedValue(undefined)
    vi.mocked(appendMessage).mockResolvedValue(undefined)
    vi.mocked(startDurableJobProcessing).mockResolvedValue(null)
    vi.mocked(createJob).mockResolvedValue({
      wasCreated: true,
      job: {
        jobId: 'job_123',
        userId: 'usr_123',
        sessionId: 'sess_new',
        idempotencyKey: 'agent:sess_new:job_targeting:abc',
        type: 'job_targeting',
        status: 'queued',
        dispatchInputRef: {
          kind: 'session_cv_state',
          sessionId: 'sess_new',
          snapshotSource: 'base',
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    } as any)
  })

  it('returns provenance headers on unauthorized requests', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValue(null)

    const response = await POST(new NextRequest('http://localhost/api/agent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'oi' }),
    }))

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(response.headers.get('X-Agent-Release')).toBe(mockReleaseMetadata.releaseId)
  })

  it('returns 403 before rate limiting or session work when Pro chat access is denied', async () => {
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

    const response = await POST(new NextRequest('http://localhost/api/agent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'oi' }),
    }))

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({
      error: 'Este recurso está disponível apenas para usuários do plano PRO. Faça upgrade para acessar o chat com IA.',
      title: 'Chat com IA exclusivo do plano PRO',
      code: 'PRO_PLAN_REQUIRED',
      upgradeUrl: '/finalizar-compra?plan=pro',
    })
    expect(getAiChatAccess).toHaveBeenCalledWith('usr_123')
    expect(agentLimiter.limit).not.toHaveBeenCalled()
    expect(getSession).not.toHaveBeenCalled()
    expect(createSession).not.toHaveBeenCalled()
    expect(appendMessage).not.toHaveBeenCalled()
  })

  it('emits the request query summary without a warning when DB activity stays under threshold', async () => {
    vi.mocked(createSession).mockImplementation(async () => {
      recordQuery('POST /rest/v1/sessions')
      return buildSession({
        id: 'sess_new',
        phase: 'intake',
        messageCount: 0,
      })
    })

    const response = await POST(new NextRequest('http://localhost/api/agent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'oi' }),
    }))

    await response.text()

    expect(response.status).toBe(200)
    expect(logInfo).toHaveBeenCalledWith(
      'db.request_queries',
      expect.objectContaining({
        requestMethod: 'POST',
        requestPath: '/api/agent',
        queryCount: 1,
      }),
    )
    expect(logWarn).not.toHaveBeenCalledWith(
      'db.n_plus_one_threshold_exceeded',
      expect.anything(),
    )
  })

  it('returns X-Session-Id and emits sessionCreated before async acknowledgement on new sessions', async () => {
    const response = await POST(new NextRequest('http://localhost/api/agent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        message: [
          'Analista de BI Senior',
          'Responsabilidades',
          'Construir dashboards em Power BI e integrar dados com SQL.',
          'Requisitos',
          'Power BI, SQL, ETL e comunicação com negócio.',
        ].join('\n'),
      }),
    }))

    expect(response.status).toBe(200)
    expect(response.headers.get('X-Session-Id')).toBe('sess_new')

    const events = parseSseDataEvents(await response.text())
    expect(events.map((event) => event.type)).toEqual([
      'sessionCreated',
      'text',
      'done',
    ])
    expect(events[0]).toEqual({
      type: 'sessionCreated',
      sessionId: 'sess_new',
    })
  })

  it('omits X-Session-Id and sessionCreated for existing-session sync requests', async () => {
    vi.mocked(getSession).mockResolvedValue(buildSession())

    const response = await POST(new NextRequest('http://localhost/api/agent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'sess_existing',
        message: 'oi',
      }),
    }))

    expect(response.status).toBe(200)
    expect(response.headers.get('X-Session-Id')).toBeNull()

    const events = parseSseDataEvents(await response.text())
    expect(events.map((event) => event.type)).toEqual(['text', 'done'])
    expect(events.some((event) => event.type === 'sessionCreated')).toBe(false)
  })

  it('emits a structured error event when the agent stream fails after starting', async () => {
    vi.mocked(createSession).mockImplementation(async () => {
      recordQuery('POST /rest/v1/sessions')
      return buildSession({
        id: 'sess_new',
        phase: 'intake',
        messageCount: 0,
      })
    })
    vi.mocked(runAgentLoop).mockImplementationOnce(async function* () {
      yield {
        type: 'text',
        content: 'Parcial',
      }
      throw new Error('stream exploded')
    })

    const response = await POST(new NextRequest('http://localhost/api/agent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'oi' }),
    }))

    const events = parseSseDataEvents(await response.text())

    expect(events.map((event) => event.type)).toEqual([
      'sessionCreated',
      'text',
      'error',
    ])
    expect(logWarn).toHaveBeenCalledWith(
      'agent.request.stream_failed',
      expect.objectContaining({
        success: false,
        errorCode: 'INTERNAL_ERROR',
      }),
    )
    expect(logInfo).toHaveBeenCalledWith(
      'db.request_queries',
      expect.objectContaining({
        requestMethod: 'POST',
        requestPath: '/api/agent',
        queryCount: 1,
      }),
    )
  })
})
