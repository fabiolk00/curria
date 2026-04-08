import { beforeEach, describe, expect, it, vi } from 'vitest'

import { runAgentLoop } from './agent-loop'

const {
  mockGetMessages,
  mockAppendMessage,
  mockBuildSystemPrompt,
  mockTrimMessages,
  mockCreateChatCompletionWithRetry,
  mockTrackApiUsage,
  mockGetChatCompletionUsage,
} = vi.hoisted(() => ({
  mockGetMessages: vi.fn(),
  mockAppendMessage: vi.fn(),
  mockBuildSystemPrompt: vi.fn(),
  mockTrimMessages: vi.fn(),
  mockCreateChatCompletionWithRetry: vi.fn(),
  mockTrackApiUsage: vi.fn(),
  mockGetChatCompletionUsage: vi.fn(),
}))

vi.mock('@/lib/agent/context-builder', () => ({
  buildSystemPrompt: mockBuildSystemPrompt,
  trimMessages: mockTrimMessages,
}))

vi.mock('@/lib/agent/tool-errors', () => ({
  TOOL_ERROR_CODES: {
    VALIDATION_ERROR: 'VALIDATION_ERROR',
  },
  toolFailure: vi.fn(),
}))

vi.mock('@/lib/agent/tools', () => ({
  TOOL_DEFINITIONS: [],
  dispatchTool: vi.fn(),
}))

vi.mock('@/lib/db/sessions', () => ({
  getMessages: mockGetMessages,
  appendMessage: mockAppendMessage,
}))

vi.mock('@/lib/agent/config', () => ({
  AGENT_CONFIG: {
    timeout: 30_000,
    maxTokens: 2_000,
    maxToolIterations: 4,
    maxMessagesPerSession: 15,
  },
  MODEL_CONFIG: {
    agent: 'test-model',
  },
}))

vi.mock('@/lib/agent/usage-tracker', () => ({
  trackApiUsage: mockTrackApiUsage,
}))

vi.mock('@/lib/openai/client', () => ({
  openai: {},
}))

vi.mock('@/lib/openai/chat', () => ({
  getChatCompletionUsage: mockGetChatCompletionUsage,
  createChatCompletionWithRetry: mockCreateChatCompletionWithRetry,
}))

vi.mock('@/lib/observability/structured-log', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  serializeError: vi.fn(() => ({})),
}))

describe('runAgentLoop', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetMessages.mockResolvedValue([
      { role: 'user', content: 'Quero uma análise', createdAt: new Date() },
    ])
    mockBuildSystemPrompt.mockReturnValue('system prompt')
    mockTrimMessages.mockImplementation((messages: unknown) => messages)
    mockGetChatCompletionUsage.mockReturnValue({ inputTokens: 10, outputTokens: 0 })
    mockTrackApiUsage.mockResolvedValue(undefined)
  })

  it('persists and streams a fallback reply when the model finishes without assistant text', async () => {
    mockCreateChatCompletionWithRetry
      .mockResolvedValueOnce({
        choices: [
          {
            finish_reason: 'stop',
            message: {
              content: '',
              tool_calls: [],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            finish_reason: 'stop',
            message: {
              content: 'Aqui está uma resposta final útil.',
              tool_calls: [],
            },
          },
        ],
      })

    const session = {
      id: 'sess_123',
      userId: 'usr_123',
      stateVersion: 1,
      phase: 'dialog' as const,
      cvState: {
        fullName: 'Fabio',
        email: 'fabio@example.com',
        phone: '41999999999',
        summary: 'Resumo',
        experience: [],
        skills: [],
        education: [],
      },
      agentState: {
        parseStatus: 'parsed' as const,
        rewriteHistory: {},
      },
      generatedOutput: { status: 'idle' as const },
      creditsUsed: 1,
      messageCount: 1,
      creditConsumed: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const events = []
    for await (const event of runAgentLoop({
      session,
      userMessage: 'Cruze meu perfil com a vaga',
      appUserId: 'usr_123',
      requestId: 'req_123',
      isNewSession: false,
      requestStartedAt: Date.now(),
    })) {
      events.push(event)
    }

    const deltaEvents = events.filter((event) => event.type === 'delta')
    expect(deltaEvents.length).toBeGreaterThan(0)
    expect(deltaEvents.map((event) => event.text).join('')).toContain('Aqui está uma resposta final útil.')
    expect(events.at(-1)).toMatchObject({
      type: 'done',
      sessionId: 'sess_123',
    })
    expect(mockAppendMessage).toHaveBeenNthCalledWith(1, 'sess_123', 'user', 'Cruze meu perfil com a vaga')
    expect(mockAppendMessage).toHaveBeenNthCalledWith(
      2,
      'sess_123',
      'assistant',
      'Aqui está uma resposta final útil.',
    )
  })
})
