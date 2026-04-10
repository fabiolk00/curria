import { beforeEach, describe, expect, it, vi } from 'vitest'

import { mockTextStream, mockTextThenToolStream } from './mock-openai-stream'
import { runAgentLoop } from '../streaming-loop'

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
    id: 'sess_prompt_regression',
    userId: 'usr_123',
    stateVersion: 1,
    phase: 'dialog' as const,
    cvState: {
      fullName: 'John Smith',
      email: '',
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

describe('streaming prompt semantics regression', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetMessages.mockResolvedValue([
      { role: 'user', content: 'Quero otimizar meu curriculo', createdAt: new Date() },
    ])
    mockTrimMessages.mockImplementation((messages: unknown) => messages)
    mockTrackApiUsage.mockResolvedValue(undefined)
    mockAppendMessage.mockResolvedValue(undefined)
  })

  it('rebuilds prompt after parsing and drops duplicate raw resume text once canonical state is available', async () => {
    const promptsBuilt: string[] = []
    const actualContextBuilder = await vi.importActual<typeof import('../context-builder')>('../context-builder')

    mockBuildSystemPrompt.mockImplementation((session) => {
      const prompt = actualContextBuilder.buildSystemPrompt(session)
      promptsBuilt.push(prompt)
      return prompt
    })

    mockCreateChatCompletionStreamWithRetry
      .mockResolvedValueOnce(
        mockTextThenToolStream('Analisando seu arquivo', 'parse_file', {
          file_base64: 'abc',
          mime_type: 'application/pdf',
        }) as never,
      )
      .mockResolvedValueOnce(
        mockTextStream('Agora vou usar o conteudo recem extraido.') as never,
      )

    mockDispatchToolWithContext.mockImplementation(async (_toolName, _toolInput, session) => {
      session.agentState.sourceResumeText = 'John Smith\nFreshly parsed resume text'
      return {
        output: { success: true, text: 'John Smith\nFreshly parsed resume text', pageCount: 1 },
        outputJson: JSON.stringify({ success: true, text: 'John Smith\nFreshly parsed resume text', pageCount: 1 }),
        persistedPatch: {
          agentState: {
            sourceResumeText: 'John Smith\nFreshly parsed resume text',
            parseStatus: 'parsed',
          },
        },
      }
    })

    const events = []
    for await (const event of runAgentLoop({
      session: buildSession(),
      userMessage: 'Analise meu curriculo anexado',
      appUserId: 'usr_123',
      requestId: 'req_prompt_regression',
      isNewSession: false,
      requestStartedAt: Date.now(),
    })) {
      events.push(event)
    }

    expect(events.at(-1)).toMatchObject({ type: 'done' })
    expect(promptsBuilt).toHaveLength(2)
    expect(promptsBuilt[0]).toContain('Do not ask the user to upload a resume. Do not call parse_file.')
    expect(promptsBuilt[1]).not.toContain('Do not ask the user to upload a resume. Do not call parse_file.')
    expect(promptsBuilt[1]).not.toContain('Freshly parsed resume text')
    expect(promptsBuilt[1]).toContain('"fullName": "John Smith"')
  })
})
