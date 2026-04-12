import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

import { POST } from './route'
import { getCurrentAppUser } from '@/lib/auth/app-user'
import { getSession, createSession, createSessionWithCredit, checkUserQuota, incrementMessageCount, updateSession } from '@/lib/db/sessions'
import { agentLimiter } from '@/lib/rate-limit'
import { runAgentLoop } from '@/lib/agent/agent-loop'
import { dispatchTool } from '@/lib/agent/tools'
import { analyzeGap } from '@/lib/agent/tools/gap-analysis'

const { createCompletion, mockReleaseMetadata } = vi.hoisted(() => ({
  createCompletion: vi.fn(),
  mockReleaseMetadata: {
    releaseId: 'rel_abc123',
    releaseSource: 'vercel_commit',
    commitShortSha: 'abc123def456',
    deploymentEnv: 'production',
    resolvedAgentModel: 'gpt-5-mini',
    resolvedDialogModel: 'gpt-5-mini',
  },
}))

vi.mock('@/lib/openai/client', () => ({
  openai: {
    chat: {
      completions: {
        create: createCompletion,
      },
    },
  },
}))

vi.mock('@/lib/auth/app-user', () => ({
  getCurrentAppUser: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({
  agentLimiter: {
    limit: vi.fn(),
  },
}))

vi.mock('@/lib/db/sessions', () => ({
  getSession: vi.fn(),
  createSession: vi.fn(),
  createSessionWithCredit: vi.fn(),
  getMessages: vi.fn(),
  appendMessage: vi.fn(),
  checkUserQuota: vi.fn(),
  incrementMessageCount: vi.fn(),
  updateSession: vi.fn(),
}))

vi.mock('@/lib/agent/context-builder', () => ({
  buildSystemPrompt: vi.fn(),
  trimMessages: vi.fn((messages: unknown) => messages),
}))

vi.mock('@/lib/agent/tools', () => ({
  TOOL_DEFINITIONS: [],
  dispatchTool: vi.fn(),
}))

vi.mock('@/lib/agent/agent-loop', () => ({
  runAgentLoop: vi.fn(async function* () {
    yield { type: 'done', requestId: 'test', sessionId: 's1', phase: 'intake', atsScore: undefined, messageCount: 1, maxMessages: 15, isNewSession: true, toolIterations: 0 }
  }),
}))

vi.mock('@/lib/agent/usage-tracker', () => ({
  trackApiUsage: vi.fn(),
}))

vi.mock('@/lib/agent/url-extractor', () => ({
  extractUrl: vi.fn(() => null),
}))

vi.mock('@/lib/agent/scraper', () => ({
  scrapeJobPosting: vi.fn(),
}))

vi.mock('@/lib/agent/tools/gap-analysis', () => ({
  analyzeGap: vi.fn(),
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

function expectAgentProvenanceHeaders(response: Response): void {
  expect(response.headers.get('X-Agent-Release')).toBe(mockReleaseMetadata.releaseId)
  expect(response.headers.get('X-Agent-Release-Source')).toBe(mockReleaseMetadata.releaseSource)
  expect(response.headers.get('X-Agent-Resolved-Agent-Model')).toBe(mockReleaseMetadata.resolvedAgentModel)
  expect(response.headers.get('X-Agent-Resolved-Dialog-Model')).toBe(mockReleaseMetadata.resolvedDialogModel)
  expect(response.headers.get('X-Agent-Commit-Short-Sha')).toBe(mockReleaseMetadata.commitShortSha)
}

describe('agent route billing guard', () => {
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
        creditsRemaining: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    })
    vi.mocked(agentLimiter.limit).mockResolvedValue({
      success: true,
      limit: 15,
      remaining: 14,
      reset: 0,
      pending: Promise.resolve(),
    })
    vi.mocked(getSession).mockResolvedValue(null)
    vi.mocked(checkUserQuota).mockResolvedValue(false)
    vi.mocked(createSession).mockResolvedValue({
      id: 'sess_default',
      userId: 'usr_123',
      stateVersion: 1,
      phase: 'intake',
      cvState: {
        fullName: '',
        email: '',
        phone: '',
        summary: '',
        experience: [],
        skills: [],
        education: [],
      },
      agentState: {
        parseStatus: 'empty',
        rewriteHistory: {},
      },
      generatedOutput: { status: 'idle' },
      creditsUsed: 0,
      messageCount: 0,
      creditConsumed: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    vi.mocked(analyzeGap).mockReset()
  })

  it('returns provenance headers on the safe unauthenticated parity request without creating a session', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValue(null)

    const response = await POST(new NextRequest('http://localhost/api/agent', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: '{}',
    }))

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expectAgentProvenanceHeaders(response)
    expect(createSession).not.toHaveBeenCalled()
    expect(incrementMessageCount).not.toHaveBeenCalled()
  })

  it('creates a new free session even when the user currently has zero credits', async () => {
    const response = await POST(new NextRequest('http://localhost/api/agent', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        message: 'Help me improve my resume',
      }),
    }))

    expect(response.status).toBe(200)
    expect(createSession).toHaveBeenCalledWith('usr_123')
  })

  it('returns 400 when body is not valid JSON', async () => {
    const response = await POST(new NextRequest('http://localhost/api/agent', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: 'not valid json',
    }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Invalid JSON body.' })
    expectAgentProvenanceHeaders(response)
  })

  it('returns 404 when a stale sessionId is provided instead of consuming a credit', async () => {
    vi.mocked(getSession).mockResolvedValue(null)

    const response = await POST(new NextRequest('http://localhost/api/agent', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sessionId: 'stale_session_id',
        message: 'Continue our conversation',
      }),
    }))

    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body.error).toBe('Sessão não encontrada. Inicie uma nova análise.')
    expect(body.action).toBe('new_session')
    expect(checkUserQuota).not.toHaveBeenCalled()
    expect(createSession).not.toHaveBeenCalled()
  })

  it('allows long-running sessions instead of blocking on the old message cap', async () => {
    vi.mocked(getSession).mockResolvedValue({
      id: 'sess_full',
      userId: 'usr_123',
      stateVersion: 1,
      phase: 'dialog',
      cvState: {
        fullName: 'Test',
        email: 'test@test.com',
        phone: '123',
        summary: 'test',
        experience: [],
        skills: [],
        education: [],
      },
      agentState: {
        parseStatus: 'parsed',
        rewriteHistory: {},
      },
      generatedOutput: { status: 'idle' },
      creditsUsed: 1,
      messageCount: 30, // maxMessagesPerSession cap
      creditConsumed: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const response = await POST(new NextRequest('http://localhost/api/agent', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sessionId: 'sess_full',
        message: 'One more message',
      }),
    }))

    expect(response.status).toBe(200)
    expect(incrementMessageCount).toHaveBeenCalledWith('sess_full')
  })

  it('does not consume an existing-session message when file preprocessing fails', async () => {
    vi.mocked(getSession).mockResolvedValue({
      id: 'sess_existing_file_fail',
      userId: 'usr_123',
      stateVersion: 1,
      phase: 'dialog',
      cvState: {
        fullName: 'Test',
        email: 'test@test.com',
        phone: '123',
        summary: 'test',
        experience: [],
        skills: [],
        education: [],
      },
      agentState: {
        parseStatus: 'parsed',
        rewriteHistory: {},
      },
      generatedOutput: { status: 'idle' },
      creditsUsed: 1,
      messageCount: 2,
      creditConsumed: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    vi.mocked(dispatchTool).mockRejectedValue(new Error('Storage unavailable'))

    const response = await POST(new NextRequest('http://localhost/api/agent', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sessionId: 'sess_existing_file_fail',
        message: 'Continue',
        file: 'base64data',
        fileMime: 'application/pdf',
      }),
    }))

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({
      error: 'Algo deu errado. Por favor, tente novamente.',
    })
    expect(incrementMessageCount).not.toHaveBeenCalled()
  })

  it('persists a pasted job description into agentState before the agent loop starts', async () => {
    vi.mocked(getSession).mockResolvedValue(null)
    vi.mocked(checkUserQuota).mockResolvedValue(true)
    vi.mocked(createSession).mockResolvedValue({
      id: 'sess_job_target',
      userId: 'usr_123',
      stateVersion: 1,
      phase: 'intake',
      cvState: {
        fullName: '',
        email: '',
        phone: '',
        summary: '',
        experience: [],
        skills: [],
        education: [],
      },
      agentState: {
        parseStatus: 'empty',
        rewriteHistory: {},
      },
      generatedOutput: { status: 'idle' },
      creditsUsed: 1,
      messageCount: 0,
      creditConsumed: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    vi.mocked(incrementMessageCount).mockResolvedValue(true)

    const jobDescription = `Analista de BI Senior

Responsabilidades:
Levantar requisitos com as areas de negocio.
Construir e manter dashboards em Power BI.
Automatizar processos de coleta e transformacao de dados.

Requisitos:
Experiencia com Power BI, DAX e SQL.
Vivencia com ETL e integracao de dados.

Diferenciais:
Python, APIs e Microsoft Fabric.`

    const response = await POST(new NextRequest('http://localhost/api/agent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: jobDescription }),
    }))

    expect(response.status).toBe(200)
    expect(updateSession).toHaveBeenCalledWith('sess_job_target', {
      agentState: expect.objectContaining({
        targetJobDescription: expect.stringContaining('Power BI'),
      }),
    })
  })

  it('promotes a new session to analysis when a saved resume already exists and the user pastes a vacancy', async () => {
    vi.mocked(getSession).mockResolvedValue(null)
    vi.mocked(checkUserQuota).mockResolvedValue(true)
    vi.mocked(createSession).mockResolvedValue({
      id: 'sess_seeded_resume',
      userId: 'usr_123',
      stateVersion: 1,
      phase: 'intake',
      cvState: {
        fullName: 'Fabio Silva',
        email: 'fabio@example.com',
        phone: '11999999999',
        summary: 'Analista de dados com foco em BI, SQL e automacao.',
        experience: [],
        skills: ['SQL', 'Power BI'],
        education: [],
      },
      agentState: {
        parseStatus: 'parsed',
        rewriteHistory: {},
      },
      generatedOutput: { status: 'idle' },
      creditsUsed: 1,
      messageCount: 0,
      creditConsumed: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    vi.mocked(incrementMessageCount).mockResolvedValue(true)

    const jobDescription = `Analista de BI Senior

Responsabilidades:
Levantar requisitos com as areas de negocio.
Construir e manter dashboards em Power BI.
Automatizar processos de coleta e transformacao de dados.

Requisitos:
Experiencia com Power BI, DAX e SQL.
Vivencia com ETL e integracao de dados.

Diferenciais:
Python, APIs e Microsoft Fabric.`

    const response = await POST(new NextRequest('http://localhost/api/agent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: jobDescription }),
    }))

    expect(response.status).toBe(200)
    await response.text()
    expect(updateSession).toHaveBeenCalledWith('sess_seeded_resume', {
      agentState: expect.objectContaining({
        targetJobDescription: expect.stringContaining('Power BI'),
      }),
      phase: 'analysis',
    })
    expect(vi.mocked(runAgentLoop).mock.calls.at(-1)?.[0].session.phase).toBe('analysis')
  })

  it('promotes a seeded session to analysis for summarized requirement lists without explicit role wording', async () => {
    vi.mocked(getSession).mockResolvedValue(null)
    vi.mocked(checkUserQuota).mockResolvedValue(true)
    vi.mocked(createSession).mockResolvedValue({
      id: 'sess_requirement_summary',
      userId: 'usr_123',
      stateVersion: 1,
      phase: 'intake',
      cvState: {
        fullName: 'Fabio Silva',
        email: 'fabio@example.com',
        phone: '11999999999',
        summary: 'Engenheiro de Dados com foco em analytics e ETL.',
        experience: [],
        skills: ['SQL', 'BigQuery', 'Power BI'],
        education: [],
      },
      agentState: {
        parseStatus: 'parsed',
        rewriteHistory: {},
      },
      generatedOutput: { status: 'idle' },
      creditsUsed: 1,
      messageCount: 0,
      creditConsumed: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    vi.mocked(incrementMessageCount).mockResolvedValue(true)

    const requirementSummary = `Requisitos Desejaveis

Experiencia em analises que envolvem multiplas areas de negocio. Vivencia em GitHub, Looker ou outras ferramentas de data visualization. Capacidade de resolver problemas com foco em resultados para o negocio. Experiencia em digital analytics com ferramentas como Google Analytics, Google Tag Manager e Appsflyer. Conhecimento em tecnicas avancadas de ETL e transformacao de dados.

Resumo dos requisitos: SQL, Google Sheets, Looker Platform, Machine Learning, GitHub, R, BigQuery, SQL Server, Google Analytics, Google Tag Manager, Appsflyer.`

    const response = await POST(new NextRequest('http://localhost/api/agent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: requirementSummary }),
    }))

    expect(response.status).toBe(200)
    await response.text()
    expect(updateSession).toHaveBeenCalledWith('sess_requirement_summary', {
      agentState: expect.objectContaining({
        targetJobDescription: expect.stringContaining('Resumo dos requisitos'),
      }),
      phase: 'analysis',
    })
    expect(vi.mocked(runAgentLoop).mock.calls.at(-1)?.[0].session.phase).toBe('analysis')
  })

  it('does not persist targetJobDescription for a short non-job message', async () => {
    vi.mocked(getSession).mockResolvedValue(null)
    vi.mocked(checkUserQuota).mockResolvedValue(true)
    vi.mocked(createSession).mockResolvedValue({
      id: 'sess_no_target',
      userId: 'usr_123',
      stateVersion: 1,
      phase: 'intake',
      cvState: {
        fullName: '',
        email: '',
        phone: '',
        summary: '',
        experience: [],
        skills: [],
        education: [],
      },
      agentState: {
        parseStatus: 'empty',
        rewriteHistory: {},
      },
      generatedOutput: { status: 'idle' },
      creditsUsed: 1,
      messageCount: 0,
      creditConsumed: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    vi.mocked(incrementMessageCount).mockResolvedValue(true)

    const response = await POST(new NextRequest('http://localhost/api/agent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'ola' }),
    }))

    expect(response.status).toBe(200)
    expect(updateSession).not.toHaveBeenCalled()
  })

  it('stores the detected target job without kicking off background gap analysis', async () => {
    vi.mocked(getSession).mockResolvedValue({
      id: 'sess_gap_ready',
      userId: 'usr_123',
      stateVersion: 1,
      phase: 'dialog',
      cvState: {
        fullName: 'Fabio Silva',
        email: 'fabio@example.com',
        phone: '11999999999',
        summary: 'Analista de dados com foco em BI e automacao.',
        experience: [],
        skills: ['SQL', 'Power BI'],
        education: [],
      },
      agentState: {
        parseStatus: 'parsed',
        sourceResumeText: 'Experiencia em Power BI, SQL e integracao de dados.',
        rewriteHistory: {},
      },
      generatedOutput: { status: 'idle' },
      creditsUsed: 1,
      messageCount: 2,
      creditConsumed: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    vi.mocked(incrementMessageCount).mockResolvedValue(true)
    const jobDescription = `Analista de BI Senior

Responsabilidades:
Levantar requisitos com as areas de negocio.
Construir dashboards em Power BI com foco em usabilidade.
Automatizar processos de coleta e transformacao de dados.

Requisitos:
Experiencia com Power BI, DAX, SQL e integracao de dados.
Boa comunicacao com areas nao tecnicas.

Diferenciais:
Python, APIs, Microsoft Fabric e storytelling de dados.`

    const response = await POST(new NextRequest('http://localhost/api/agent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'sess_gap_ready',
        message: jobDescription,
      }),
    }))

    expect(response.status).toBe(200)
    expect(updateSession).toHaveBeenCalledWith('sess_gap_ready', {
      agentState: expect.objectContaining({
        targetJobDescription: expect.stringContaining('Power BI'),
      }),
    })
    expect(analyzeGap).not.toHaveBeenCalled()
  })

  it('does not start background gap analysis for existing sessions anymore', async () => {
    vi.mocked(getSession).mockResolvedValue({
      id: 'sess_gap_background',
      userId: 'usr_123',
      stateVersion: 1,
      phase: 'dialog',
      cvState: {
        fullName: 'Fabio Silva',
        email: 'fabio@example.com',
        phone: '11999999999',
        summary: 'Analista de dados com foco em BI e automacao.',
        experience: [],
        skills: ['SQL', 'Power BI'],
        education: [],
      },
      agentState: {
        parseStatus: 'parsed',
        sourceResumeText: 'Experiencia em Power BI, SQL e integracao de dados.',
        rewriteHistory: {},
      },
      generatedOutput: { status: 'idle' },
      creditsUsed: 1,
      messageCount: 2,
      creditConsumed: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    vi.mocked(incrementMessageCount).mockResolvedValue(true)
    vi.mocked(analyzeGap).mockImplementation(() => new Promise(() => {}))

    const jobDescription = `Analista de BI Senior

Responsabilidades:
Levantar requisitos com as areas de negocio.
Construir dashboards em Power BI com foco em usabilidade.
Automatizar processos de coleta e transformacao de dados.

Requisitos:
Experiencia com Power BI, DAX, SQL e integracao de dados.
Boa comunicacao com areas nao tecnicas.

Diferenciais:
Python, APIs, Microsoft Fabric e storytelling de dados.`

    const response = await POST(new NextRequest('http://localhost/api/agent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'sess_gap_background',
        message: jobDescription,
      }),
    }))

    expect(response.status).toBe(200)
    expect(analyzeGap).not.toHaveBeenCalled()
  })

  it('streams SSE done event for a valid new session', async () => {
    vi.mocked(getSession).mockResolvedValue(null)
    vi.mocked(checkUserQuota).mockResolvedValue(true)
    vi.mocked(createSession).mockResolvedValue({
      id: 'sess_new',
      userId: 'usr_123',
      stateVersion: 1,
      phase: 'intake',
      cvState: {
        fullName: '',
        email: '',
        phone: '',
        summary: '',
        experience: [],
        skills: [],
        education: [],
      },
      agentState: {
        parseStatus: 'empty',
        rewriteHistory: {},
      },
      generatedOutput: { status: 'idle' },
      creditsUsed: 1,
      messageCount: 0,
      creditConsumed: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    vi.mocked(incrementMessageCount).mockResolvedValue(true)

    const response = await POST(new NextRequest('http://localhost/api/agent', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        message: 'Start my resume analysis',
      }),
    }))

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('text/event-stream')
    expectAgentProvenanceHeaders(response)

    const text = await response.text()
    const events = text.split('\n\n').filter(Boolean)
    const doneEvent = events.find((e) => e.includes('"type":"done"'))
    expect(doneEvent).toBeDefined()

    const doneData = JSON.parse(doneEvent!.replace('data: ', ''))
    expect(doneData.type).toBe('done')
    expect(doneData.sessionId).toBe('s1')
    expect(doneData.phase).toBe('intake')
    expect(doneData.isNewSession).toBe(true)
  })

  it('emits sessionCreated as the very first SSE event for new sessions', async () => {
    vi.mocked(getSession).mockResolvedValue(null)
    vi.mocked(checkUserQuota).mockResolvedValue(true)
    vi.mocked(createSession).mockResolvedValue({
      id: 'sess_early',
      userId: 'usr_123',
      stateVersion: 1,
      phase: 'intake',
      cvState: {
        fullName: '',
        email: '',
        phone: '',
        summary: '',
        experience: [],
        skills: [],
        education: [],
      },
      agentState: {
        parseStatus: 'empty',
        rewriteHistory: {},
      },
      generatedOutput: { status: 'idle' },
      creditsUsed: 1,
      messageCount: 0,
      creditConsumed: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    vi.mocked(incrementMessageCount).mockResolvedValue(true)

    const response = await POST(new NextRequest('http://localhost/api/agent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'Hello' }),
    }))

    expect(response.status).toBe(200)

    const text = await response.text()
    const events = text.split('\n\n').filter(Boolean)
    expect(events.length).toBeGreaterThanOrEqual(2)

    const firstData = JSON.parse(events[0].replace('data: ', ''))
    expect(firstData).toEqual({ type: 'sessionCreated', sessionId: 'sess_early' })
  })

  it('returns X-Session-Id header for new sessions', async () => {
    vi.mocked(getSession).mockResolvedValue(null)
    vi.mocked(checkUserQuota).mockResolvedValue(true)
    vi.mocked(createSession).mockResolvedValue({
      id: 'sess_header',
      userId: 'usr_123',
      stateVersion: 1,
      phase: 'intake',
      cvState: {
        fullName: '',
        email: '',
        phone: '',
        summary: '',
        experience: [],
        skills: [],
        education: [],
      },
      agentState: {
        parseStatus: 'empty',
        rewriteHistory: {},
      },
      generatedOutput: { status: 'idle' },
      creditsUsed: 1,
      messageCount: 0,
      creditConsumed: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    vi.mocked(incrementMessageCount).mockResolvedValue(true)

    const response = await POST(new NextRequest('http://localhost/api/agent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'Hello' }),
    }))

    expect(response.headers.get('X-Session-Id')).toBe('sess_header')
  })

  it('does not emit sessionCreated for existing sessions', async () => {
    vi.mocked(getSession).mockResolvedValue({
      id: 'sess_existing',
      userId: 'usr_123',
      stateVersion: 1,
      phase: 'dialog',
      cvState: {
        fullName: 'Test',
        email: 'test@test.com',
        phone: '123',
        summary: 'test',
        experience: [],
        skills: [],
        education: [],
      },
      agentState: {
        parseStatus: 'parsed',
        rewriteHistory: {},
      },
      generatedOutput: { status: 'idle' },
      creditsUsed: 1,
      messageCount: 2,
      creditConsumed: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    vi.mocked(incrementMessageCount).mockResolvedValue(true)

    const response = await POST(new NextRequest('http://localhost/api/agent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'sess_existing',
        message: 'Continue',
      }),
    }))

    expect(response.status).toBe(200)
    expect(response.headers.get('X-Session-Id')).toBeNull()

    const text = await response.text()
    const events = text.split('\n\n').filter(Boolean)
    const hasSessionCreated = events.some((e) => e.includes('"type":"sessionCreated"'))
    expect(hasSessionCreated).toBe(false)
  })

  it('aborts new-session stream with error when incrementMessageCount throws', async () => {
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval')
    vi.mocked(getSession).mockResolvedValue(null)
    vi.mocked(checkUserQuota).mockResolvedValue(true)
    vi.mocked(createSession).mockResolvedValue({
      id: 'sess_inc_fail',
      userId: 'usr_123',
      stateVersion: 1,
      phase: 'intake',
      cvState: {
        fullName: '',
        email: '',
        phone: '',
        summary: '',
        experience: [],
        skills: [],
        education: [],
      },
      agentState: {
        parseStatus: 'empty',
        rewriteHistory: {},
      },
      generatedOutput: { status: 'idle' },
      creditsUsed: 1,
      messageCount: 0,
      creditConsumed: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    vi.mocked(incrementMessageCount).mockRejectedValue(new Error('DB connection lost'))

    const response = await POST(new NextRequest('http://localhost/api/agent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'Hello' }),
    }))

    expect(response.status).toBe(200)
    expect(response.headers.get('X-Session-Id')).toBe('sess_inc_fail')

    const text = await response.text()
    const events = text.split('\n\n').filter(Boolean)

    // sessionCreated is still the first event (frontend already has the ID)
    const firstData = JSON.parse(events[0].replace('data: ', ''))
    expect(firstData).toEqual({ type: 'sessionCreated', sessionId: 'sess_inc_fail' })

    // Second event is the error, stream closes without a done event
    const secondData = JSON.parse(events[1].replace('data: ', ''))
    expect(secondData.type).toBe('error')
    expect(secondData.code).toBe('INTERNAL_ERROR')
    expect(secondData.error).toBe('Algo deu errado. Por favor, tente novamente.')
    expect(clearIntervalSpy).toHaveBeenCalled()

    const hasDone = events.some((e) => e.includes('"type":"done"'))
    expect(hasDone).toBe(false)
    clearIntervalSpy.mockRestore()
  })

  it('sends SSE error and closes stream when incrementMessageCount throws', async () => {
    vi.mocked(getSession).mockResolvedValue(null)
    vi.mocked(checkUserQuota).mockResolvedValue(true)
    vi.mocked(createSession).mockResolvedValue({
      id: 'sess_throw_inc',
      userId: 'usr_123',
      stateVersion: 1,
      phase: 'intake',
      cvState: { fullName: '', email: '', phone: '', summary: '', experience: [], skills: [], education: [] },
      agentState: { parseStatus: 'empty', rewriteHistory: {} },
      generatedOutput: { status: 'idle' },
      creditsUsed: 1,
      messageCount: 0,
      creditConsumed: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    vi.mocked(incrementMessageCount).mockRejectedValue(new Error('DB connection lost'))

    const response = await POST(new NextRequest('http://localhost/api/agent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'Hello' }),
    }))

    expect(response.status).toBe(200)
    const text = await response.text()
    const events = text.split('\n\n').filter(Boolean)

    const firstData = JSON.parse(events[0].replace('data: ', ''))
    expect(firstData).toEqual({ type: 'sessionCreated', sessionId: 'sess_throw_inc' })

    const secondData = JSON.parse(events[1].replace('data: ', ''))
    expect(secondData.type).toBe('error')
    expect(secondData.error).toBe('Algo deu errado. Por favor, tente novamente.')
    expect(secondData.code).toBe('INTERNAL_ERROR')

    expect(events.some((e) => e.includes('"type":"done"'))).toBe(false)
  })

  it('sends SSE error and closes stream when handleFileAttachment throws', async () => {
    vi.mocked(getSession).mockResolvedValue(null)
    vi.mocked(checkUserQuota).mockResolvedValue(true)
    vi.mocked(createSession).mockResolvedValue({
      id: 'sess_throw_file',
      userId: 'usr_123',
      stateVersion: 1,
      phase: 'intake',
      cvState: { fullName: '', email: '', phone: '', summary: '', experience: [], skills: [], education: [] },
      agentState: { parseStatus: 'empty', rewriteHistory: {} },
      generatedOutput: { status: 'idle' },
      creditsUsed: 1,
      messageCount: 0,
      creditConsumed: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    vi.mocked(incrementMessageCount).mockResolvedValue(true)
    vi.mocked(dispatchTool).mockRejectedValue(new Error('Storage unavailable'))

    const response = await POST(new NextRequest('http://localhost/api/agent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'Hello', file: 'base64data', fileMime: 'application/pdf' }),
    }))

    expect(response.status).toBe(200)
    const text = await response.text()
    const events = text.split('\n\n').filter(Boolean)

    const firstData = JSON.parse(events[0].replace('data: ', ''))
    expect(firstData).toEqual({ type: 'sessionCreated', sessionId: 'sess_throw_file' })

    const secondData = JSON.parse(events[1].replace('data: ', ''))
    expect(secondData.type).toBe('error')
    expect(secondData.error).toBe('Algo deu errado. Por favor, tente novamente.')
    expect(secondData.code).toBe('INTERNAL_ERROR')

    expect(incrementMessageCount).not.toHaveBeenCalled()
    expect(events.some((e) => e.includes('"type":"done"'))).toBe(false)
  })

  it('sends AbortError-specific message when pre-loop work is aborted', async () => {
    vi.mocked(getSession).mockResolvedValue(null)
    vi.mocked(checkUserQuota).mockResolvedValue(true)
    vi.mocked(createSession).mockResolvedValue({
      id: 'sess_abort',
      userId: 'usr_123',
      stateVersion: 1,
      phase: 'intake',
      cvState: { fullName: '', email: '', phone: '', summary: '', experience: [], skills: [], education: [] },
      agentState: { parseStatus: 'empty', rewriteHistory: {} },
      generatedOutput: { status: 'idle' },
      creditsUsed: 1,
      messageCount: 0,
      creditConsumed: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    const abortError = new DOMException('The operation was aborted.', 'AbortError')
    vi.mocked(incrementMessageCount).mockRejectedValue(abortError)

    const response = await POST(new NextRequest('http://localhost/api/agent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'Hello' }),
    }))

    const text = await response.text()
    const events = text.split('\n\n').filter(Boolean)

    const secondData = JSON.parse(events[1].replace('data: ', ''))
    expect(secondData.type).toBe('error')
    expect(secondData.code).toBe('INTERNAL_ERROR')
    expect(secondData.error).toBe('A requisição demorou muito. Por favor, tente novamente.')
  })

  it('forwards runAgentLoop events to SSE in order without corruption', async () => {
    vi.mocked(getSession).mockResolvedValue({
      id: 'sess_forwarding',
      userId: 'usr_123',
      stateVersion: 1,
      phase: 'dialog',
      cvState: {
        fullName: 'Test',
        email: 'test@test.com',
        phone: '123',
        summary: 'test',
        experience: [],
        skills: [],
        education: [],
      },
      agentState: {
        parseStatus: 'parsed',
        rewriteHistory: {},
      },
      generatedOutput: { status: 'idle' },
      creditsUsed: 1,
      messageCount: 2,
      creditConsumed: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    vi.mocked(incrementMessageCount).mockResolvedValue(true)
    vi.mocked(runAgentLoop).mockImplementationOnce(async function* () {
      yield { type: 'text', content: 'Hello' }
      yield { type: 'toolStart', toolName: 'parse_file' }
      yield { type: 'toolResult', toolName: 'parse_file', output: { success: true } }
      yield { type: 'patch', patch: { agentState: { parseStatus: 'parsed' } }, phase: 'analysis' }
      yield {
        type: 'done',
        sessionId: 'sess_forwarding',
        phase: 'analysis',
        requestId: 'req_forward',
        messageCount: 3,
        maxMessages: 15,
        isNewSession: false,
        toolIterations: 1,
      }
    })

    const response = await POST(new NextRequest('http://localhost/api/agent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'sess_forwarding',
        message: 'Continue',
      }),
    }))

    expect(response.status).toBe(200)

    const events = parseSseDataEvents(await response.text())
    expect(events.map((event) => event.type)).toEqual([
      'text',
      'toolStart',
      'toolResult',
      'patch',
      'done',
    ])
    expect(events[0]).toEqual({ type: 'text', content: 'Hello' })
    expect(events[1]).toEqual({ type: 'toolStart', toolName: 'parse_file' })
    expect(events[2]).toEqual({ type: 'toolResult', toolName: 'parse_file', output: { success: true } })
    expect(events[3]).toEqual({
      type: 'patch',
      patch: { agentState: { parseStatus: 'parsed' } },
      phase: 'analysis',
    })
    expect(events[4]).toEqual({
      type: 'done',
      sessionId: 'sess_forwarding',
      phase: 'analysis',
      requestId: 'req_forward',
      messageCount: 3,
      maxMessages: 15,
      isNewSession: false,
      toolIterations: 1,
    })
  })

  it('streams a dialog continue fallback through SSE without repeating the bootstrap copy', async () => {
    vi.mocked(getSession).mockResolvedValue({
      id: 'sess_dialog_continue',
      userId: 'usr_123',
      stateVersion: 1,
      phase: 'dialog',
      cvState: {
        fullName: 'Test',
        email: 'test@test.com',
        phone: '123',
        summary: 'test',
        experience: [],
        skills: [],
        education: [],
      },
      agentState: {
        parseStatus: 'parsed',
        rewriteHistory: {},
        sourceResumeText: 'Fabio Silva\nResumo\nExperiencia com Power BI, SQL e ETL.',
        targetJobDescription: 'Analista de BI Senior com foco em Power BI, SQL e ETL.',
      },
      generatedOutput: { status: 'idle' },
      creditsUsed: 1,
      messageCount: 2,
      creditConsumed: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    vi.mocked(incrementMessageCount).mockResolvedValue(true)
    vi.mocked(runAgentLoop).mockImplementationOnce(async function* () {
      yield {
        type: 'text',
        content: 'Posso seguir, sim. Diga se voce quer ajustar resumo, experiencia ou skills.',
      }
      yield {
        type: 'done',
        sessionId: 'sess_dialog_continue',
        phase: 'dialog',
        requestId: 'req_dialog_continue',
        messageCount: 3,
        maxMessages: 15,
        isNewSession: false,
        toolIterations: 0,
      }
    })

    const response = await POST(new NextRequest('http://localhost/api/agent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'sess_dialog_continue',
        message: 'pode fazer',
      }),
    }))

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('text/event-stream')

    const events = parseSseDataEvents(await response.text())
    expect(events.map((event) => event.type)).toEqual(['text', 'done'])
    expect(events[0]).toEqual({
      type: 'text',
      content: 'Posso seguir, sim. Diga se voce quer ajustar resumo, experiencia ou skills.',
    })
    expect(events[1]).toEqual({
      type: 'done',
      sessionId: 'sess_dialog_continue',
      phase: 'dialog',
      requestId: 'req_dialog_continue',
      messageCount: 3,
      maxMessages: 15,
      isNewSession: false,
      toolIterations: 0,
    })
    expect(events.some((event) => JSON.stringify(event).includes('Recebi a vaga e ela ja ficou salva como referencia para o seu curriculo.'))).toBe(false)
    expect(runAgentLoop).toHaveBeenCalledWith(expect.objectContaining({
      userMessage: 'pode fazer',
      session: expect.objectContaining({ phase: 'dialog' }),
    }))
  })

  it('streams the latest pasted vacancy acknowledgement through SSE when dialog recovery fails', async () => {
    vi.mocked(getSession).mockResolvedValue({
      id: 'sess_dialog_new_vacancy',
      userId: 'usr_123',
      stateVersion: 1,
      phase: 'dialog',
      cvState: {
        fullName: 'Test',
        email: 'test@test.com',
        phone: '123',
        summary: 'test',
        experience: [],
        skills: [],
        education: [],
      },
      agentState: {
        parseStatus: 'parsed',
        rewriteHistory: {},
        sourceResumeText: 'Fabio Silva\nResumo\nExperiencia com Power BI, SQL e ETL.',
      },
      generatedOutput: { status: 'idle' },
      creditsUsed: 1,
      messageCount: 2,
      creditConsumed: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    vi.mocked(incrementMessageCount).mockResolvedValue(true)
    vi.mocked(runAgentLoop).mockImplementationOnce(async function* () {
      yield {
        type: 'text',
        content: 'Recebi essa nova vaga. Posso adaptar agora seu resumo para essa oportunidade.',
      }
      yield {
        type: 'done',
        sessionId: 'sess_dialog_new_vacancy',
        phase: 'dialog',
        requestId: 'req_dialog_new_vacancy',
        messageCount: 3,
        maxMessages: 15,
        isNewSession: false,
        toolIterations: 0,
      }
    })

    const response = await POST(new NextRequest('http://localhost/api/agent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'sess_dialog_new_vacancy',
        message: [
          'Responsabilidades',
          'Construir dashboards executivos em Power BI e traduzir necessidades do negocio em indicadores.',
          'Requisitos',
          'SQL avancado, ETL, comunicacao com areas nao tecnicas e Power BI.',
          'Diferenciais',
          'Python, APIs e Microsoft Fabric.',
        ].join('\n'),
      }),
    }))

    expect(response.status).toBe(200)

    const events = parseSseDataEvents(await response.text())
    expect(events.map((event) => event.type)).toEqual(['text', 'done'])
    expect(events[0]).toEqual({
      type: 'text',
      content: 'Recebi essa nova vaga. Posso adaptar agora seu resumo para essa oportunidade.',
    })
    expect(events[1]).toEqual({
      type: 'done',
      sessionId: 'sess_dialog_new_vacancy',
      phase: 'dialog',
      requestId: 'req_dialog_new_vacancy',
      messageCount: 3,
      maxMessages: 15,
      isNewSession: false,
      toolIterations: 0,
    })
    expect(events.some((event) => JSON.stringify(event).includes('Diga qual trecho voce quer ajustar primeiro'))).toBe(false)
    expect(runAgentLoop).toHaveBeenCalledWith(expect.objectContaining({
      userMessage: expect.stringContaining('Responsabilidades'),
      session: expect.objectContaining({ phase: 'dialog' }),
    }))
  })
})
