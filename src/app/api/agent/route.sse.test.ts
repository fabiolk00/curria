import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

import { POST } from './route'
import { getCurrentAppUser } from '@/lib/auth/app-user'
import { appendAssistantTurn } from '@/lib/agent/agent-persistence'
import { runAgentLoop } from '@/lib/agent/agent-loop'
import {
  appendMessage,
  getSession,
  incrementMessageCount,
  updateSession,
} from '@/lib/db/sessions'
import { createJob } from '@/lib/jobs/repository'
import { startDurableJobProcessing } from '@/lib/jobs/runtime'
import { agentLimiter } from '@/lib/rate-limit'

vi.mock('@/lib/auth/app-user', () => ({
  getCurrentAppUser: vi.fn(),
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
  runAgentLoop: vi.fn(async function* (params: { session: { id: string } }) {
    yield {
      type: 'text',
      content: 'Resposta síncrona.',
    }
    yield {
      type: 'done',
      sessionId: params.session.id,
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

vi.mock('@/lib/runtime/release-metadata', () => ({
  getAgentReleaseMetadata: vi.fn(() => ({
    releaseId: 'rel_route_sse',
    releaseSource: 'test',
    commitShortSha: 'abc123',
    deploymentEnv: 'test',
    resolvedAgentModel: 'gpt-5-mini',
    resolvedDialogModel: 'gpt-5-mini',
  })),
}))

function parseSseDataEvents(payload: string): Array<Record<string, unknown>> {
  return payload
    .split('\n\n')
    .filter((entry) => entry.startsWith('data: '))
    .map((entry) => JSON.parse(entry.replace('data: ', '')) as Record<string, unknown>)
}

function buildSession(overrides?: Record<string, unknown>) {
  return {
    id: 'sess_sse',
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
      targetJobDescription: 'Senior Analytics Engineer com foco em SQL, dbt e BigQuery.',
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

describe('/api/agent SSE contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
    vi.mocked(getSession).mockResolvedValue(buildSession())
    vi.mocked(incrementMessageCount).mockResolvedValue(true)
    vi.mocked(updateSession).mockResolvedValue(undefined)
    vi.mocked(appendMessage).mockResolvedValue(undefined)
    vi.mocked(startDurableJobProcessing).mockResolvedValue(null)
  })

  it('acknowledges heavy generation requests and dispatches through durable jobs instead of the sync loop', async () => {
    vi.mocked(createJob).mockResolvedValue({
      wasCreated: true,
      job: {
        jobId: 'job_generation',
        userId: 'usr_123',
        sessionId: 'sess_sse',
        idempotencyKey: 'agent:sess_sse:artifact_generation:abc',
        type: 'artifact_generation',
        status: 'queued',
        dispatchInputRef: {
          kind: 'session_cv_state',
          sessionId: 'sess_sse',
          snapshotSource: 'base',
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    } as any)

    const response = await POST(new NextRequest('http://localhost/api/agent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'sess_sse',
        message: 'Aceito',
      }),
    }))

    expect(response.status).toBe(200)
    expect(typeof appendAssistantTurn).toBe('function')

    const events = parseSseDataEvents(await response.text())
    expect(startDurableJobProcessing).toHaveBeenCalledWith({
      jobId: 'job_generation',
      userId: 'usr_123',
    })
    expect(events.map((event) => event.type)).toEqual(['text', 'done'])
    expect(events[0]).toEqual({
      type: 'text',
      content: 'Recebi seu aceite e iniciei a geração do currículo em segundo plano. Vou manter esta solicitação vinculada à sessão atual.',
    })
  })

  it('keeps lightweight prompts on the synchronous streaming path', async () => {
    const response = await POST(new NextRequest('http://localhost/api/agent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'sess_sse',
        message: 'oi',
      }),
    }))

    expect(response.status).toBe(200)

    const events = parseSseDataEvents(await response.text())
    expect(events.map((event) => event.type)).toEqual(['text', 'done'])
    expect(events[0]).toEqual({
      type: 'text',
      content: 'Resposta síncrona.',
    })
  })
})
