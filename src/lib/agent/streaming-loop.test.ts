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
    conversationMaxOutputTokens: 900,
    conciseFallbackMaxTokens: 350,
    maxToolIterations: 3,
    maxHistoryMessages: 24,
    maxMessagesPerSession: 30,
    maxSystemPromptCharsByPhase: {
      intake: 6_000,
      analysis: 8_000,
      dialog: 8_000,
      confirm: 6_500,
      generation: 6_000,
    },
    phaseToolAllowlist: {
      intake: ['parse_file', 'set_phase'],
      analysis: ['score_ats', 'analyze_gap', 'set_phase'],
      dialog: ['rewrite_section', 'apply_gap_action', 'set_phase'],
      confirm: ['generate_file', 'create_target_resume', 'set_phase'],
      generation: ['generate_file', 'create_target_resume', 'set_phase'],
    },
  },
  MODEL_CONFIG: {
    agentModel: 'test-model',
    structuredModel: 'test-model',
    visionModel: 'test-model',
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
  calculateUsageCostCents: vi.fn(() => 1),
}))

vi.mock('@/lib/agent/tools', () => ({
  getToolDefinitionsForPhase: vi.fn(() => []),
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

  it('falls back to a concise answer when truncation recovery still cannot finish', async () => {
    async function* emptyLengthStream() {
      yield {
        choices: [{
          delta: {},
          finish_reason: 'length',
        }],
        usage: null,
      }
    }

    mockCreateChatCompletionStreamWithRetry
      .mockResolvedValueOnce(
        mockLengthExceededStream() as never,
      )
      .mockResolvedValueOnce(
        emptyLengthStream() as never,
      )
      .mockResolvedValueOnce(
        emptyLengthStream() as never,
      )
      .mockResolvedValueOnce(
        mockTextStream('Resposta curta final.') as never,
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
      'Resposta curta final.',
    )
  })

  it('includes saved resume context and avoids duplicating the vacancy text in concise recovery prompts', async () => {
    async function* emptyLengthStream() {
      yield {
        choices: [{
          delta: {},
          finish_reason: 'length',
        }],
        usage: null,
      }
    }

    const jobDescription = [
      'Responsabilidades',
      'Projetar, desenvolver e manter dashboards e solucoes analiticas.',
      'Requisitos',
      'SQL avancado, Power BI, ETL/ELT e ingles fluente.',
      'Diferenciais',
      'Python, Snowflake e Airflow.',
    ].join('\n')

    const session = {
      ...buildSession(),
      phase: 'analysis' as const,
      agentState: {
        parseStatus: 'parsed' as const,
        rewriteHistory: {},
        sourceResumeText: 'Fabio Silva\nResumo\nExperiencia com Power BI, SQL, ETL e integracao de dados.',
        targetJobDescription: jobDescription,
      },
    }

    mockCreateChatCompletionStreamWithRetry
      .mockResolvedValueOnce(emptyLengthStream() as never)
      .mockResolvedValueOnce(mockTextStream('Resposta curta final.') as never)

    for await (const _event of runAgentLoop({
      session,
      userMessage: jobDescription,
      appUserId: 'usr_123',
      requestId: 'req_recovery_prompt',
      isNewSession: false,
      requestStartedAt: Date.now(),
    })) {
      // consume stream
    }

    const recoveryRequest = mockCreateChatCompletionStreamWithRetry.mock.calls[1]?.[1]
    const recoveryPrompt = recoveryRequest?.messages?.[1]?.content

    expect(typeof recoveryPrompt).toBe('string')
    expect(recoveryPrompt).toContain('Saved resume context:')
    expect(recoveryPrompt).not.toContain('Saved target job context:')
  })

  it('returns a vacancy-specific fallback instead of the generic empty fallback when every recovery returns empty', async () => {
    async function* emptyStopStream() {
      yield {
        choices: [{
          delta: {},
          finish_reason: 'stop',
        }],
        usage: null,
      }
    }

    const session = {
      ...buildSession(),
      phase: 'intake' as const,
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
        parseStatus: 'empty' as const,
        rewriteHistory: {},
      },
    }

    mockCreateChatCompletionStreamWithRetry
      .mockResolvedValueOnce(emptyStopStream() as never)
      .mockResolvedValueOnce(emptyStopStream() as never)
      .mockResolvedValueOnce(emptyStopStream() as never)
      .mockResolvedValueOnce(emptyStopStream() as never)
      .mockResolvedValueOnce(emptyStopStream() as never)

    const userMessage = [
      'Responsabilidades',
      'Projetar, desenvolver e manter dashboards e solucoes analiticas.',
      'Requisitos',
      'SQL avancado, Power BI, ETL/ELT e ingles fluente.',
      'Diferenciais',
      'Python, Snowflake e Airflow.',
    ].join('\n')

    const events = []
    for await (const event of runAgentLoop({
      session,
      userMessage,
      appUserId: 'usr_123',
      requestId: 'req_empty_vacancy',
      isNewSession: false,
      requestStartedAt: Date.now(),
    })) {
      events.push(event)
    }

    const finalText = events
      .filter((event) => event.type === 'text')
      .map((event) => event.content)
      .join('')

    expect(finalText).toContain('Recebi a vaga')
    expect(finalText).toContain('currículo')
    expect(finalText).not.toContain('Não consegui concluir a resposta completa desta vez')
    expect(mockAppendMessage).toHaveBeenNthCalledWith(
      2,
      'sess_123',
      'assistant',
      expect.stringContaining('Recebi a vaga'),
    )
  })

  it('returns a structured vacancy fallback instead of asking the user to retry when analysis data already exists', async () => {
    async function* emptyStopStream() {
      yield {
        choices: [{
          delta: {},
          finish_reason: 'stop',
        }],
        usage: null,
      }
    }

    const session = {
      ...buildSession(),
      phase: 'analysis' as const,
      atsScore: {
        total: 78,
        breakdown: {
          format: 80,
          structure: 76,
          keywords: 74,
          contact: 95,
          impact: 65,
        },
        issues: [],
        suggestions: [],
      },
      agentState: {
        parseStatus: 'parsed' as const,
        rewriteHistory: {},
        targetJobDescription: 'Analista de BI Senior com foco em Power BI, SQL e ETL.',
        targetFitAssessment: {
          level: 'partial' as const,
          summary: 'Seu perfil atende bem BI e SQL, mas ainda falta evidenciar melhor ETL e impacto.',
          reasons: ['Boa aderencia em BI', 'Gaps em ETL'],
          assessedAt: new Date().toISOString(),
        },
        gapAnalysis: {
          analyzedAt: new Date().toISOString(),
          result: {
            matchScore: 72,
            missingSkills: ['ETL', 'DAX'],
            weakAreas: ['impacto mensuravel'],
            improvementSuggestions: ['Destacar projetos com ETL'],
          },
        },
      },
    }

    mockCreateChatCompletionStreamWithRetry
      .mockResolvedValueOnce(emptyStopStream() as never)
      .mockResolvedValueOnce(emptyStopStream() as never)
      .mockResolvedValueOnce(emptyStopStream() as never)
      .mockResolvedValueOnce(emptyStopStream() as never)
      .mockResolvedValueOnce(emptyStopStream() as never)

    const events = []
    for await (const event of runAgentLoop({
      session,
      userMessage: 'Reescreva meu curriculo para essa vaga',
      appUserId: 'usr_123',
      requestId: 'req_structured_vacancy_fallback',
      isNewSession: false,
      requestStartedAt: Date.now(),
    })) {
      events.push(event)
    }

    const finalText = events
      .filter((event) => event.type === 'text')
      .map((event) => event.content)
      .join('')

    expect(finalText).toContain('Pontuacao ATS atual: 78/100.')
    expect(finalText).toContain('Aderencia inicial: parcial.')
    expect(finalText).toContain('Principais gaps: ETL, DAX, impacto mensuravel.')
    expect(finalText).not.toContain('Tente novamente com um pedido curto')
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

  it('generates files directly from confirm after explicit approval without another model turn', async () => {
    const session = {
      ...buildSession(),
      phase: 'confirm' as const,
    }

    mockDispatchToolWithContext
      .mockResolvedValueOnce({
        output: { success: true, phase: 'generation' },
        outputJson: JSON.stringify({ success: true, phase: 'generation' }),
        persistedPatch: {
          phase: 'generation',
        },
      })
      .mockResolvedValueOnce({
        output: {
          success: true,
          docxUrl: 'https://example.com/resume.docx',
          pdfUrl: 'https://example.com/resume.pdf',
        },
        outputJson: JSON.stringify({
          success: true,
          docxUrl: 'https://example.com/resume.docx',
          pdfUrl: 'https://example.com/resume.pdf',
        }),
        persistedPatch: {
          generatedOutput: {
            status: 'ready',
            docxPath: 'usr_123/sess_123/resume.docx',
            pdfPath: 'usr_123/sess_123/resume.pdf',
          },
        },
      })

    const events = []
    for await (const event of runAgentLoop({
      session,
      userMessage: 'sim, pode gerar',
      appUserId: 'usr_123',
      requestId: 'req_confirm',
      isNewSession: false,
      requestStartedAt: Date.now(),
    })) {
      events.push(event)
    }

    expect(mockCreateChatCompletionStreamWithRetry).not.toHaveBeenCalled()
    expect(events.map((event) => event.type)).toEqual([
      'toolStart',
      'toolResult',
      'patch',
      'toolStart',
      'toolResult',
      'patch',
      'text',
      'done',
    ])
    expect(mockAppendMessage).toHaveBeenNthCalledWith(
      2,
      'sess_123',
      'assistant',
      'Seus arquivos ATS-otimizados estao prontos. Confira os downloads de DOCX e PDF acima.',
    )
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
