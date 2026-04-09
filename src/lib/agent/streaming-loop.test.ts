import { beforeEach, describe, expect, it, vi } from 'vitest'

import { mockLengthExceededStream, mockTextStream, mockTextThenToolStream, mockToolCallStream } from './__tests__/mock-openai-stream'
import { runAgentLoop } from './streaming-loop'

const {
  mockGetMessages,
  mockAppendMessage,
  mockBuildSystemPrompt,
  mockTrimMessages,
  mockCreateChatCompletionStreamWithRetry,
  mockTrackApiUsage,
  mockDispatchToolWithContext,
} = vi.hoisted(() => ({
  mockGetMessages: vi.fn(),
  mockAppendMessage: vi.fn(),
  mockBuildSystemPrompt: vi.fn(),
  mockTrimMessages: vi.fn(),
  mockCreateChatCompletionStreamWithRetry: vi.fn(),
  mockTrackApiUsage: vi.fn(),
  mockDispatchToolWithContext: vi.fn(),
}))

vi.mock('@/lib/agent/context-builder', () => ({
  buildSystemPrompt: mockBuildSystemPrompt,
  trimMessages: mockTrimMessages,
}))

vi.mock('@/lib/db/sessions', () => ({
  getMessages: mockGetMessages,
  appendMessage: mockAppendMessage,
}))

vi.mock('@/lib/agent/config', () => ({
  AGENT_CONFIG: {
    timeout: 30_000,
    maxTokens: 2_000,
    maxToolIterations: 3,
    maxHistoryMessages: 24,
    maxMessagesPerSession: 15,
  },
  MODEL_CONFIG: {
    agent: 'test-model',
  },
}))

vi.mock('@/lib/openai/client', () => ({
  openai: {},
}))

vi.mock('@/lib/openai/chat', () => ({
  createChatCompletionStreamWithRetry: mockCreateChatCompletionStreamWithRetry,
}))

vi.mock('@/lib/agent/usage-tracker', () => ({
  trackApiUsage: mockTrackApiUsage,
}))

vi.mock('@/lib/agent/tools', () => ({
  TOOL_DEFINITIONS: [],
  dispatchToolWithContext: mockDispatchToolWithContext,
}))

vi.mock('@/lib/observability/structured-log', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  serializeError: vi.fn(() => ({})),
}))

function buildSession() {
  return {
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
}

describe('runAgentLoop streaming', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetMessages.mockResolvedValue([
      { role: 'user', content: 'Quero uma análise', createdAt: new Date() },
    ])
    mockBuildSystemPrompt.mockReturnValue('system prompt')
    mockTrimMessages.mockImplementation((messages: unknown) => messages)
    mockTrackApiUsage.mockResolvedValue(undefined)
    mockDispatchToolWithContext.mockResolvedValue({
      output: { success: true },
      outputJson: JSON.stringify({ success: true }),
      persistedPatch: undefined,
    })
  })

  it('streams text chunks and completes the turn', async () => {
    mockCreateChatCompletionStreamWithRetry.mockResolvedValue(
      mockTextStream('Aqui está uma resposta final útil.') as never,
    )

    const events = []
    for await (const event of runAgentLoop({
      session: buildSession(),
      userMessage: 'Cruze meu perfil com a vaga',
      appUserId: 'usr_123',
      requestId: 'req_123',
      isNewSession: false,
      requestStartedAt: Date.now(),
    })) {
      events.push(event)
    }

    const textEvents = events.filter((event) => event.type === 'text')
    expect(textEvents.map((event) => event.content).join('')).toContain('Aqui está uma resposta final útil.')
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

  it('forwards text before tool dispatch', async () => {
    mockCreateChatCompletionStreamWithRetry
      .mockResolvedValueOnce(
        mockTextThenToolStream('hello world', 'rewrite_section', {
          section: 'summary',
          current_content: 'old',
          instructions: 'new',
        }) as never,
      )
      .mockResolvedValueOnce(
        mockTextStream('follow up answer') as never,
      )

    const events = []
    for await (const event of runAgentLoop({
      session: buildSession(),
      userMessage: 'Teste',
      appUserId: 'usr_123',
      requestId: 'req_123',
      isNewSession: false,
      requestStartedAt: Date.now(),
    })) {
      events.push(event)
    }

    const firstTextIndex = events.findIndex((event) => event.type === 'text')
    const firstToolIndex = events.findIndex((event) => event.type === 'toolStart')

    expect(firstTextIndex).toBeGreaterThanOrEqual(0)
    expect(firstToolIndex).toBeGreaterThan(firstTextIndex)
  })

  it('emits patch only after dispatch persistence completes', async () => {
    const callOrder: string[] = []

    mockCreateChatCompletionStreamWithRetry
      .mockResolvedValueOnce(
        mockToolCallStream('rewrite_section', {
          section: 'summary',
          current_content: 'old',
          instructions: 'new',
        }) as never,
      )
      .mockResolvedValueOnce(
        mockTextStream('final answer') as never,
      )

    mockDispatchToolWithContext.mockImplementation(async () => {
      callOrder.push('persist')
      return {
        output: { success: true },
        outputJson: JSON.stringify({ success: true }),
        persistedPatch: {
          phase: 'dialog',
        },
      }
    })

    for await (const event of runAgentLoop({
      session: buildSession(),
      userMessage: 'Teste',
      appUserId: 'usr_123',
      requestId: 'req_123',
      isNewSession: false,
      requestStartedAt: Date.now(),
    })) {
      if (event.type === 'patch') {
        callOrder.push('patch-event')
      }
    }

    expect(callOrder).toEqual(['persist', 'patch-event'])
  })

  it('stops after max tool loop iterations', async () => {
    mockCreateChatCompletionStreamWithRetry.mockImplementation(async () =>
      mockToolCallStream('rewrite_section', {
        section: 'summary',
        current_content: 'old',
        instructions: 'new',
      }) as never,
    )

    const events = []
    for await (const event of runAgentLoop({
      session: buildSession(),
      userMessage: 'Teste',
      appUserId: 'usr_123',
      requestId: 'req_123',
      isNewSession: false,
      requestStartedAt: Date.now(),
    })) {
      events.push(event)
    }

    expect(mockCreateChatCompletionStreamWithRetry.mock.calls.length).toBeLessThanOrEqual(6)
    expect(events).toContainEqual(expect.objectContaining({
      type: 'error',
      error: expect.stringContaining('número máximo'),
    }))
    expect(events.at(-1)).toMatchObject({
      type: 'done',
    })
  })

  it('breaks the tool chain on malformed tool arguments', async () => {
    async function* malformedToolStream() {
      yield {
        choices: [{
          delta: {
            tool_calls: [{
              index: 0,
              id: 'call_ok',
              function: { name: 'parse_file' },
            }],
          },
          finish_reason: null,
        }],
        usage: null,
      }

      yield {
        choices: [{
          delta: {
            tool_calls: [{
              index: 0,
              function: { arguments: '{"file_base64":"abc","mime_type":"application/pdf"}' },
            }],
          },
          finish_reason: null,
        }],
        usage: null,
      }

      yield {
        choices: [{
          delta: {
            tool_calls: [{
              index: 1,
              id: 'call_bad',
              function: { name: 'rewrite_section' },
            }],
          },
          finish_reason: null,
        }],
        usage: null,
      }

      yield {
        choices: [{
          delta: {
            tool_calls: [{
              index: 1,
              function: { arguments: '{ invalid json' },
            }],
          },
          finish_reason: null,
        }],
        usage: null,
      }

      yield {
        choices: [{
          delta: {},
          finish_reason: 'tool_calls',
        }],
        usage: null,
      }
    }

    mockCreateChatCompletionStreamWithRetry
      .mockResolvedValueOnce(malformedToolStream() as never)
      .mockResolvedValueOnce(mockTextStream('fallback answer') as never)

    const events = []
    for await (const event of runAgentLoop({
      session: buildSession(),
      userMessage: 'Teste',
      appUserId: 'usr_123',
      requestId: 'req_123',
      isNewSession: false,
      requestStartedAt: Date.now(),
    })) {
      events.push(event)
    }

    expect(mockDispatchToolWithContext).toHaveBeenCalledTimes(1)
    expect(mockDispatchToolWithContext).toHaveBeenCalledWith(
      'parse_file',
      { file_base64: 'abc', mime_type: 'application/pdf' },
      expect.any(Object),
      undefined,
    )
    expect(events).toContainEqual(expect.objectContaining({
      type: 'error',
      code: 'LLM_INVALID_OUTPUT',
    }))
    expect(events.filter((event) => event.type === 'toolResult')).toHaveLength(1)
  })

  it('appends a tool message for failed tool executions before the next assistant turn', async () => {
    mockCreateChatCompletionStreamWithRetry
      .mockResolvedValueOnce(
        mockToolCallStream('rewrite_section', {
          section: 'summary',
          current_content: 'old',
          instructions: 'new',
        }) as never,
      )
      .mockResolvedValueOnce(
        mockTextStream('fallback answer') as never,
      )

    mockDispatchToolWithContext.mockResolvedValueOnce({
      output: { success: false, code: 'VALIDATION_ERROR', error: 'Input validation failed.' },
      outputJson: JSON.stringify({ success: false, code: 'VALIDATION_ERROR', error: 'Input validation failed.' }),
      outputFailure: { success: false, code: 'VALIDATION_ERROR', error: 'Input validation failed.' },
      persistedPatch: undefined,
    })

    const events = []
    for await (const event of runAgentLoop({
      session: buildSession(),
      userMessage: 'Teste',
      appUserId: 'usr_123',
      requestId: 'req_123',
      isNewSession: false,
      requestStartedAt: Date.now(),
    })) {
      events.push(event)
    }

    expect(events).toContainEqual(expect.objectContaining({
      type: 'error',
      code: 'VALIDATION_ERROR',
    }))

    const secondRequestParams = mockCreateChatCompletionStreamWithRetry.mock.calls[1]?.[1]
    const toolMessages = secondRequestParams.messages.filter((message: { role: string }) => message.role === 'tool')

    expect(toolMessages).toHaveLength(1)
    expect(toolMessages[0]).toMatchObject({
      role: 'tool',
      tool_call_id: 'call_test_1',
    })
    expect(JSON.parse(toolMessages[0].content)).toEqual({
      success: false,
      code: 'VALIDATION_ERROR',
      error: 'Input validation failed.',
    })
  })

  it('continues a truncated streamed response instead of surfacing a user-facing error', async () => {
    mockCreateChatCompletionStreamWithRetry
      .mockResolvedValueOnce(
        mockLengthExceededStream() as never,
      )
      .mockResolvedValueOnce(
        mockTextStream('and now it finishes cleanly.') as never,
      )

    const events = []
    for await (const event of runAgentLoop({
      session: buildSession(),
      userMessage: 'Teste',
      appUserId: 'usr_123',
      requestId: 'req_123',
      isNewSession: false,
      requestStartedAt: Date.now(),
    })) {
      events.push(event)
    }

    expect(events.some((event) => event.type === 'error' && event.error.includes('too long and was truncated'))).toBe(false)
    expect(events.at(-1)).toMatchObject({
      type: 'done',
      sessionId: 'sess_123',
    })
    expect(mockAppendMessage).toHaveBeenNthCalledWith(
      2,
      'sess_123',
      'assistant',
      'This is a very long response and now it finishes cleanly.',
    )
  })

  it('emits an error when the stream ends without a finish reason', async () => {
    async function* incompleteStream() {
      yield {
        choices: [{
          delta: { content: 'partial answer' },
          finish_reason: null,
        }],
        usage: null,
      }
    }

    mockCreateChatCompletionStreamWithRetry.mockResolvedValue(
      incompleteStream() as never,
    )

    const events = []
    for await (const event of runAgentLoop({
      session: buildSession(),
      userMessage: 'Teste',
      appUserId: 'usr_123',
      requestId: 'req_123',
      isNewSession: false,
      requestStartedAt: Date.now(),
    })) {
      events.push(event)
    }

    expect(events).toContainEqual(expect.objectContaining({
      type: 'error',
      error: 'The AI response was incomplete.',
    }))
  })

  it('stops cleanly when the abort signal fires after the first chunk', async () => {
    const controller = new AbortController()

    mockCreateChatCompletionStreamWithRetry.mockResolvedValue(
      mockTextStream('hello world from stream') as never,
    )

    const events = []
    for await (const event of runAgentLoop({
      session: buildSession(),
      userMessage: 'Teste de cancelamento',
      appUserId: 'usr_123',
      requestId: 'req_abort',
      isNewSession: false,
      requestStartedAt: Date.now(),
      signal: controller.signal,
    })) {
      events.push(event)

      if (event.type === 'text') {
        controller.abort()
      }
    }

    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      type: 'text',
      content: expect.stringContaining('hello'),
    })
    expect(events.some((event) => event.type === 'done')).toBe(false)
    expect(mockDispatchToolWithContext).not.toHaveBeenCalled()
  })
})
