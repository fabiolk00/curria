import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const {
  mockCreateChatCompletionStreamWithRetry,
  mockGetCurrentAppUser,
  mockAgentLimiterLimit,
  mockGetSession,
  mockCreateSessionWithCredit,
  mockGetMessages,
  mockAppendMessage,
  mockCheckUserQuota,
  mockIncrementMessageCount,
  mockUpdateSession,
  mockDispatchTool,
  mockDispatchToolWithContext,
  mockGetToolDefinitionsForPhase,
} = vi.hoisted(() => ({
  mockCreateChatCompletionStreamWithRetry: vi.fn(),
  mockGetCurrentAppUser: vi.fn(),
  mockAgentLimiterLimit: vi.fn(),
  mockGetSession: vi.fn(),
  mockCreateSessionWithCredit: vi.fn(),
  mockGetMessages: vi.fn(),
  mockAppendMessage: vi.fn(),
  mockCheckUserQuota: vi.fn(),
  mockIncrementMessageCount: vi.fn(),
  mockUpdateSession: vi.fn(),
  mockDispatchTool: vi.fn(),
  mockDispatchToolWithContext: vi.fn(),
  mockGetToolDefinitionsForPhase: vi.fn(() => []),
}))

vi.mock('@/lib/openai/client', () => ({
  openai: {},
}))

vi.mock('@/lib/openai/chat', () => ({
  createChatCompletionStreamWithRetry: mockCreateChatCompletionStreamWithRetry,
}))

vi.mock('@/lib/auth/app-user', () => ({
  getCurrentAppUser: mockGetCurrentAppUser,
}))

vi.mock('@/lib/rate-limit', () => ({
  agentLimiter: {
    limit: mockAgentLimiterLimit,
  },
}))

vi.mock('@/lib/db/sessions', () => ({
  getSession: mockGetSession,
  createSessionWithCredit: mockCreateSessionWithCredit,
  getMessages: mockGetMessages,
  appendMessage: mockAppendMessage,
  checkUserQuota: mockCheckUserQuota,
  incrementMessageCount: mockIncrementMessageCount,
  updateSession: mockUpdateSession,
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
  trackApiUsage: vi.fn(),
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

const originalOpenAIDialogModel = process.env.OPENAI_DIALOG_MODEL
const originalOpenAIModel = process.env.OPENAI_MODEL
const originalOpenAIAgentModel = process.env.OPENAI_AGENT_MODEL
const originalOpenAIModelCombo = process.env.OPENAI_MODEL_COMBO

function buildSession(phase: 'dialog' | 'confirm') {
  return {
    id: phase === 'dialog' ? 'sess_dialog_model_override' : 'sess_confirm_model_override',
    userId: 'usr_123',
    stateVersion: 1,
    phase,
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
      targetJobDescription: 'Analista de BI Senior com foco em Power BI, SQL e ETL.',
    },
    generatedOutput: { status: 'idle' as const },
    creditsUsed: 1,
    messageCount: 2,
    creditConsumed: true,
    createdAt: new Date(),
    updatedAt: new Date(),
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
      prompt_tokens: 25,
      completion_tokens: 12,
      total_tokens: 37,
    },
  }
}

function parseSseDataEvents(payload: string): Array<Record<string, unknown>> {
  return payload
    .split('\n\n')
    .filter((entry) => entry.startsWith('data: '))
    .map((entry) => JSON.parse(entry.replace('data: ', '')) as Record<string, unknown>)
}

async function loadRoute() {
  vi.resetModules()
  return import('./route')
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.OPENAI_MODEL_COMBO = 'combo_a'
  process.env.OPENAI_MODEL = 'gpt-5-mini'
  delete process.env.OPENAI_AGENT_MODEL
  delete process.env.OPENAI_DIALOG_MODEL

  mockGetCurrentAppUser.mockResolvedValue({
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

  mockAgentLimiterLimit.mockResolvedValue({
    success: true,
    limit: 15,
    remaining: 14,
    reset: 0,
    pending: Promise.resolve(),
  })

  mockGetSession.mockResolvedValue(buildSession('dialog'))
  mockCreateSessionWithCredit.mockResolvedValue(null)
  mockGetMessages.mockResolvedValue([
    { role: 'user', content: 'Quero uma analise', createdAt: new Date() },
  ])
  mockAppendMessage.mockResolvedValue(undefined)
  mockCheckUserQuota.mockResolvedValue(true)
  mockIncrementMessageCount.mockResolvedValue(true)
  mockUpdateSession.mockResolvedValue(undefined)
  mockDispatchTool.mockReset()
  mockDispatchToolWithContext.mockReset()
  mockGetToolDefinitionsForPhase.mockReturnValue([])
})

afterEach(() => {
  vi.resetModules()

  if (originalOpenAIDialogModel === undefined) {
    delete process.env.OPENAI_DIALOG_MODEL
  } else {
    process.env.OPENAI_DIALOG_MODEL = originalOpenAIDialogModel
  }

  if (originalOpenAIModel === undefined) {
    delete process.env.OPENAI_MODEL
  } else {
    process.env.OPENAI_MODEL = originalOpenAIModel
  }

  if (originalOpenAIAgentModel === undefined) {
    delete process.env.OPENAI_AGENT_MODEL
  } else {
    process.env.OPENAI_AGENT_MODEL = originalOpenAIAgentModel
  }

  if (originalOpenAIModelCombo === undefined) {
    delete process.env.OPENAI_MODEL_COMBO
  } else {
    process.env.OPENAI_MODEL_COMBO = originalOpenAIModelCombo
  }
})

describe('/api/agent route model selection', () => {
  it('uses OPENAI_DIALOG_MODEL for a real dialog-phase route request after fresh import', async () => {
    process.env.OPENAI_DIALOG_MODEL = 'gpt-5.4-mini'
    mockCreateChatCompletionStreamWithRetry.mockImplementation(
      async () => textStopStream('Resposta de dialogo.') as never,
    )

    const { POST } = await loadRoute()
    const response = await POST(new NextRequest('http://localhost/api/agent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'sess_dialog_model_override',
        message: 'pode seguir',
      }),
    }))

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('text/event-stream')

    const events = parseSseDataEvents(await response.text())
    const requestParams = mockCreateChatCompletionStreamWithRetry.mock.calls.at(-1)?.[1]

    expect(response.headers.get('X-Agent-Resolved-Dialog-Model')).toBe('gpt-5.4-mini')
    if (requestParams) {
      expect(requestParams.model).toBe('gpt-5.4-mini')
    }
    expect(events.length).toBeGreaterThan(0)
    expect(mockAppendMessage).toHaveBeenNthCalledWith(
      1,
      'sess_dialog_model_override',
      'user',
      'pode seguir',
    )
  })

  it('uses OPENAI_DIALOG_MODEL for a real confirm-phase route request after fresh import', async () => {
    process.env.OPENAI_DIALOG_MODEL = 'gpt-5.4-mini'
    mockGetSession.mockResolvedValue(buildSession('confirm'))
    mockCreateChatCompletionStreamWithRetry.mockImplementation(
      async () => textStopStream('Vamos revisar mais um ajuste antes de gerar.') as never,
    )

    const { POST } = await loadRoute()
    const response = await POST(new NextRequest('http://localhost/api/agent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'sess_confirm_model_override',
        message: 'quero revisar mais um ajuste antes de gerar',
      }),
    }))

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('text/event-stream')

    const events = parseSseDataEvents(await response.text())
    const requestParams = mockCreateChatCompletionStreamWithRetry.mock.calls.at(-1)?.[1]

    expect(response.headers.get('X-Agent-Resolved-Dialog-Model')).toBe('gpt-5.4-mini')
    if (requestParams) {
      expect(requestParams.model).toBe('gpt-5.4-mini')
    }
    expect(events.length).toBeGreaterThan(0)
    expect(mockAppendMessage).toHaveBeenNthCalledWith(
      1,
      'sess_confirm_model_override',
      'user',
      'quero revisar mais um ajuste antes de gerar',
    )
  })

  it('inherits the resolved agent model for a real dialog-phase route request when OPENAI_DIALOG_MODEL is unset', async () => {
    process.env.OPENAI_AGENT_MODEL = 'gpt-5.4-mini'
    delete process.env.OPENAI_DIALOG_MODEL
    mockCreateChatCompletionStreamWithRetry.mockImplementation(
      async () => textStopStream('Resposta de dialogo sem override.') as never,
    )

    const { POST } = await loadRoute()
    const response = await POST(new NextRequest('http://localhost/api/agent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'sess_dialog_model_override',
        message: 'reescreva',
      }),
    }))

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('text/event-stream')

    const events = parseSseDataEvents(await response.text())
    const requestParams = mockCreateChatCompletionStreamWithRetry.mock.calls.at(-1)?.[1]

    expect(response.headers.get('X-Agent-Resolved-Dialog-Model')).toBe('gpt-5.4-mini')
    if (requestParams) {
      expect(requestParams.model).toBe('gpt-5.4-mini')
    }
    expect(events.length).toBeGreaterThan(0)
  })

  it('inherits the resolved agent model for a real confirm-phase route request when OPENAI_DIALOG_MODEL is unset', async () => {
    process.env.OPENAI_AGENT_MODEL = 'gpt-5.4-mini'
    delete process.env.OPENAI_DIALOG_MODEL
    mockGetSession.mockResolvedValue(buildSession('confirm'))
    mockCreateChatCompletionStreamWithRetry.mockImplementation(
      async () => textStopStream('Resposta de confirmacao sem override.') as never,
    )

    const { POST } = await loadRoute()
    const response = await POST(new NextRequest('http://localhost/api/agent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'sess_confirm_model_override',
        message: 'quero revisar antes de gerar',
      }),
    }))

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('text/event-stream')

    const events = parseSseDataEvents(await response.text())
    const requestParams = mockCreateChatCompletionStreamWithRetry.mock.calls.at(-1)?.[1]

    expect(response.headers.get('X-Agent-Resolved-Dialog-Model')).toBe('gpt-5.4-mini')
    if (requestParams) {
      expect(requestParams.model).toBe('gpt-5.4-mini')
    }
    expect(events.length).toBeGreaterThan(0)
  })
})
