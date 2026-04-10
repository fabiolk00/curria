import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

import { POST } from './route'
import { getCurrentAppUser } from '@/lib/auth/app-user'
import {
  appendMessage,
  checkUserQuota,
  createSessionWithCredit,
  getMessages,
  getSession,
  incrementMessageCount,
  updateSession,
} from '@/lib/db/sessions'
import { agentLimiter } from '@/lib/rate-limit'
import { createChatCompletionStreamWithRetry } from '@/lib/openai/chat'

const {
  mockDispatchTool,
  mockDispatchToolWithContext,
  mockGetToolDefinitionsForPhase,
} = vi.hoisted(() => ({
  mockDispatchTool: vi.fn(),
  mockDispatchToolWithContext: vi.fn(),
  mockGetToolDefinitionsForPhase: vi.fn(() => []),
}))

vi.mock('@/lib/openai/client', () => ({
  openai: {},
}))

vi.mock('@/lib/openai/chat', () => ({
  createChatCompletionStreamWithRetry: vi.fn(),
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
  createSessionWithCredit: vi.fn(),
  getMessages: vi.fn(),
  appendMessage: vi.fn(),
  checkUserQuota: vi.fn(),
  incrementMessageCount: vi.fn(),
  updateSession: vi.fn(),
}))

vi.mock('@/lib/agent/context-builder', () => ({
  buildSystemPrompt: vi.fn(() => 'system prompt'),
  trimMessages: vi.fn((messages: unknown) => messages),
}))

vi.mock('@/lib/agent/tools', () => ({
  TOOL_DEFINITIONS: [],
  dispatchTool: mockDispatchTool,
  dispatchToolWithContext: mockDispatchToolWithContext,
  getToolDefinitionsForPhase: mockGetToolDefinitionsForPhase,
}))

vi.mock('@/lib/agent/usage-tracker', () => ({
  trackApiUsage: vi.fn(() => Promise.resolve()),
  calculateUsageCostCents: vi.fn(() => 1),
}))

vi.mock('@/lib/agent/url-extractor', () => ({
  extractUrl: vi.fn(() => null),
}))

vi.mock('@/lib/agent/scraper', () => ({
  scrapeJobPosting: vi.fn(),
}))

vi.mock('@/lib/observability/structured-log', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  serializeError: vi.fn(() => ({})),
}))

function parseSseDataEvents(payload: string): Array<Record<string, unknown>> {
  return payload
    .split('\n\n')
    .filter((entry) => entry.startsWith('data: '))
    .map((entry) => JSON.parse(entry.replace('data: ', '')) as Record<string, unknown>)
}

async function* emptyStopStream() {
  yield {
    choices: [{
      delta: {},
      finish_reason: 'stop',
    }],
    usage: null,
  }
}

async function* emptyLengthStream() {
  yield {
    choices: [{
      delta: {},
      finish_reason: 'length',
    }],
    usage: null,
  }

  yield {
    choices: [],
    usage: {
      prompt_tokens: 1540,
      completion_tokens: 1250,
      total_tokens: 2790,
    },
  }
}

async function* textStopStream(text: string) {
  yield {
    choices: [{
      delta: { content: text },
      finish_reason: null,
    }],
    usage: null,
  }

  yield {
    choices: [{
      delta: {},
      finish_reason: 'stop',
    }],
    usage: {
      prompt_tokens: 45,
      completion_tokens: 20,
      total_tokens: 65,
    },
  }
}

function buildDialogSession(overrides?: {
  id?: string
  agentState?: Record<string, unknown>
}) {
  return {
    id: overrides?.id ?? 'sess_dialog',
    userId: 'usr_123',
    stateVersion: 1,
    phase: 'dialog' as const,
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
      parseStatus: 'parsed' as const,
      rewriteHistory: {},
      sourceResumeText: 'Fabio Silva\nResumo\nExperiencia com Power BI, SQL e ETL.',
      ...overrides?.agentState,
    },
    generatedOutput: { status: 'idle' as const },
    creditsUsed: 1,
    messageCount: 2,
    creditConsumed: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

function buildIntakeSession(overrides?: {
  id?: string
  agentState?: Record<string, unknown>
}) {
  return {
    id: overrides?.id ?? 'sess_intake',
    userId: 'usr_123',
    stateVersion: 1,
    phase: 'intake' as const,
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
      parseStatus: 'parsed' as const,
      rewriteHistory: {},
      sourceResumeText: 'Fabio Silva\nResumo\nExperiencia com Power BI, SQL e ETL.',
      ...overrides?.agentState,
    },
    generatedOutput: { status: 'idle' as const },
    creditsUsed: 1,
    messageCount: 0,
    creditConsumed: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

describe('/api/agent SSE fallback coverage', () => {
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
    })

    vi.mocked(agentLimiter.limit).mockResolvedValue({
      success: true,
      limit: 15,
      remaining: 14,
      reset: 0,
      pending: Promise.resolve(),
    })

    vi.mocked(getMessages).mockResolvedValue([
      { role: 'user', content: 'Quero uma analise', createdAt: new Date() },
    ])
    vi.mocked(appendMessage).mockResolvedValue(undefined)
    vi.mocked(checkUserQuota).mockResolvedValue(true)
    vi.mocked(createSessionWithCredit).mockResolvedValue(null)
    vi.mocked(incrementMessageCount).mockResolvedValue(true)
    mockDispatchTool.mockReset()
    mockDispatchToolWithContext.mockReset()
    mockGetToolDefinitionsForPhase.mockReturnValue([])
  })

  it('streams a dialog continue fallback through the real agent loop without repeating the bootstrap copy', async () => {
    const session = buildDialogSession({
      id: 'sess_dialog_continue_real',
      agentState: {
        targetJobDescription: 'Analista de BI Senior com foco em Power BI, SQL e ETL.',
      },
    })

    vi.mocked(getSession).mockResolvedValue(session)
    vi.mocked(createChatCompletionStreamWithRetry).mockImplementation(
      async () => emptyStopStream() as never,
    )

    const response = await POST(new NextRequest('http://localhost/api/agent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionId: session.id,
        message: 'pode fazer',
      }),
    }))

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('text/event-stream')

    const events = parseSseDataEvents(await response.text())
    const finalText = events
      .filter((event) => event.type === 'text')
      .map((event) => String(event.content ?? ''))
      .join('')

    expect(finalText).toContain('Posso seguir, sim.')
    expect(finalText).toContain('resumo profissional')
    expect(finalText).not.toContain('Recebi a vaga e ela ja ficou salva como referencia para o seu curriculo.')
    expect(events.at(-1)).toMatchObject({
      type: 'done',
      sessionId: session.id,
      phase: 'dialog',
      isNewSession: false,
    })
    expect(createChatCompletionStreamWithRetry).toHaveBeenCalledTimes(5)
    expect(vi.mocked(appendMessage).mock.calls.at(-1)).toEqual([
      session.id,
      'assistant',
      expect.stringContaining('Posso seguir, sim.'),
    ])
  })

  it('streams a rewrite-specific dialog fallback for terse requests like "reescreva"', async () => {
    const session = buildDialogSession({
      id: 'sess_dialog_rewrite_real',
      agentState: {
        targetJobDescription: 'Analista de BI Senior com foco em Power BI, SQL e ETL.',
      },
    })

    vi.mocked(getSession).mockResolvedValue(session)
    vi.mocked(createChatCompletionStreamWithRetry).mockImplementation(
      async () => emptyStopStream() as never,
    )

    const response = await POST(new NextRequest('http://localhost/api/agent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionId: session.id,
        message: 'reescreva',
      }),
    }))

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('text/event-stream')

    const events = parseSseDataEvents(await response.text())
    const finalText = events
      .filter((event) => event.type === 'text')
      .map((event) => String(event.content ?? ''))
      .join('')

    expect(finalText).toContain('Posso reescrever agora seu resumo profissional.')
    expect(finalText).toContain('Ja tenho seu curriculo e a vaga como referencia.')
    expect(finalText).not.toContain('Recebi a vaga e ela ja ficou salva como referencia para o seu curriculo.')
    expect(events.at(-1)).toMatchObject({
      type: 'done',
      sessionId: session.id,
      phase: 'dialog',
      isNewSession: false,
    })
    expect(createChatCompletionStreamWithRetry).toHaveBeenCalledTimes(5)
    expect(vi.mocked(appendMessage).mock.calls.at(-1)).toEqual([
      session.id,
      'assistant',
      expect.stringContaining('Posso reescrever agora seu resumo profissional.'),
    ])
  })

  it('streams the latest pasted vacancy acknowledgement through the real agent loop when dialog recovery fails', async () => {
    const session = buildDialogSession({
      id: 'sess_dialog_latest_vacancy_real',
      agentState: {
        targetJobDescription: undefined,
      },
    })
    const jobDescription = [
      'Responsabilidades',
      'Construir dashboards executivos em Power BI e traduzir necessidades do negocio em indicadores.',
      'Requisitos',
      'SQL avancado, ETL, comunicacao com areas nao tecnicas e Power BI.',
      'Diferenciais',
      'Python, APIs e Microsoft Fabric.',
    ].join('\n')

    vi.mocked(getSession).mockResolvedValue(session)
    vi.mocked(createChatCompletionStreamWithRetry).mockImplementation(
      async () => emptyStopStream() as never,
    )

    const response = await POST(new NextRequest('http://localhost/api/agent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionId: session.id,
        message: jobDescription,
      }),
    }))

    expect(response.status).toBe(200)

    const events = parseSseDataEvents(await response.text())
    const finalText = events
      .filter((event) => event.type === 'text')
      .map((event) => String(event.content ?? ''))
      .join('')

    expect(finalText).toContain('Recebi essa nova vaga')
    expect(finalText).toContain('adaptar agora seu resumo')
    expect(finalText).not.toContain('Diga qual trecho voce quer ajustar primeiro')
    expect(events.at(-1)).toMatchObject({
      type: 'done',
      sessionId: session.id,
      phase: 'dialog',
      isNewSession: false,
    })
    expect(updateSession).toHaveBeenCalledWith(session.id, {
      agentState: expect.objectContaining({
        targetJobDescription: expect.stringContaining('Power BI'),
      }),
      phase: undefined,
    })
    expect(createChatCompletionStreamWithRetry).toHaveBeenCalledTimes(5)
    expect(vi.mocked(appendMessage).mock.calls.at(-1)).toEqual([
      session.id,
      'assistant',
      expect.stringContaining('Recebi essa nova vaga'),
    ])
  })

  it('recovers an intake turn that ends with length and zero visible text before falling back to the generic retry loop', async () => {
    const session = buildIntakeSession({
      id: 'sess_intake_zero_text_real',
    })

    vi.mocked(getSession).mockResolvedValue(session)
    vi.mocked(createChatCompletionStreamWithRetry)
      .mockImplementationOnce(async () => emptyLengthStream() as never)
      .mockImplementation(async () => textStopStream('Bom dia! Otimo iniciar. Pode me dizer qual vaga voce esta mirando?') as never)

    const response = await POST(new NextRequest('http://localhost/api/agent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionId: session.id,
        message: 'bom dia',
      }),
    }))

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('text/event-stream')

    const events = parseSseDataEvents(await response.text())
    const finalText = events
      .filter((event) => event.type === 'text')
      .map((event) => String(event.content ?? ''))
      .join('')

    expect(finalText).toContain('Pode me dizer qual vaga')
    expect(events.at(-1)).toMatchObject({
      type: 'done',
      sessionId: session.id,
      phase: 'intake',
      isNewSession: false,
    })
    expect(vi.mocked(createChatCompletionStreamWithRetry)).toHaveBeenCalledTimes(2)
    expect(vi.mocked(appendMessage).mock.calls.at(-1)).toEqual([
      session.id,
      'assistant',
      'Bom dia! Otimo iniciar. Pode me dizer qual vaga voce esta mirando?',
    ])
  })
})
