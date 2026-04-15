import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  recoverAssistantResponse,
  recoverTruncatedTurn,
  recoverZeroTextTurn,
  type StreamTurnResult,
} from './agent-recovery'

function buildSession() {
  return {
    id: 'sess_123',
    userId: 'usr_123',
    stateVersion: 2,
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

async function collectGenerator<TEvent, TResult>(
  generator: AsyncGenerator<TEvent, TResult>,
): Promise<{ events: TEvent[]; result: TResult }> {
  const events: TEvent[] = []

  while (true) {
    const next = await generator.next()
    if (next.done) {
      return {
        events,
        result: next.value,
      }
    }

    events.push(next.value)
  }
}

function createStreamTurn(
  result: StreamTurnResult,
  chunks: string[] = [],
): (params: unknown) => AsyncGenerator<{ type: 'text'; content: string }, StreamTurnResult> {
  return async function* (_params: unknown) {
    for (const chunk of chunks) {
      yield {
        type: 'text' as const,
        content: chunk,
      }
    }

    return result
  }
}

describe('agent recovery helpers', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('continues truncated turns and accumulates usage through the extracted seam', async () => {
    const session = buildSession()
    const generator = recoverTruncatedTurn({
      initialTurn: {
        assistantText: 'Resumo inicial',
        toolCalls: [],
        finishReason: 'length',
        model: 'test-model',
        usage: {
          inputTokens: 11,
          outputTokens: 7,
        },
      },
      session,
      messages: [{ role: 'user', content: 'Adapte meu curriculo' }],
      cachedSystemPrompt: 'system prompt',
      requestId: 'req_123',
      appUserId: 'usr_123',
      requestStartedAt: 10,
      maxCompletionTokens: 800,
      lengthRecoveryPrompt: 'Continue exatamente de onde parou.',
      streamAssistantTurn: createStreamTurn({
        assistantText: ' com foco em SQL e BI.',
        toolCalls: [],
        finishReason: 'stop',
        model: 'test-model',
        usage: {
          inputTokens: 3,
          outputTokens: 5,
        },
      }, [' com foco em SQL e BI.']),
      isBootstrapLikeAssistantText: () => false,
      isConcreteRewriteContinuationText: () => true,
    })

    const { events, result } = await collectGenerator(generator)

    expect(events).toEqual([{ type: 'text', content: ' com foco em SQL e BI.' }])
    expect(result).toMatchObject({
      assistantText: 'Resumo inicial com foco em SQL e BI.',
      finishReason: 'stop',
      usedLengthRecovery: true,
    })
    expect(result.usage).toEqual({
      inputTokens: 14,
      outputTokens: 12,
    })
  })

  it('retries zero-text responses until the extracted recovery seam yields content', async () => {
    const session = buildSession()
    const attempts: number[] = []
    const streamAssistantTurn = vi.fn()
      .mockImplementationOnce(createStreamTurn({
        assistantText: '',
        toolCalls: [],
        finishReason: 'length',
        model: 'test-model',
        usage: {
          inputTokens: 1,
          outputTokens: 1,
        },
      }))
      .mockImplementationOnce(createStreamTurn({
        assistantText: 'Resposta recuperada.',
        toolCalls: [],
        finishReason: 'stop',
        model: 'test-model',
        usage: {
          inputTokens: 2,
          outputTokens: 3,
        },
      }, ['Resposta recuperada.']))

    const { events, result } = await collectGenerator(recoverZeroTextTurn({
      initialTurn: {
        assistantText: '',
        toolCalls: [],
        finishReason: 'length',
        model: 'test-model',
        usage: {
          inputTokens: 1,
          outputTokens: 1,
        },
      },
      session,
      userMessage: 'Quero ajuda',
      requestId: 'req_zero',
      appUserId: 'usr_123',
      requestStartedAt: 10,
      maxCompletionTokens: 600,
      recoverySystemPrompt: 'recovery prompt',
      buildRecoveryUserPrompt: ({ attempt }) => {
        attempts.push(attempt ?? 0)
        return `attempt-${attempt}`
      },
      streamAssistantTurn,
    }))

    expect(events).toEqual([{ type: 'text', content: 'Resposta recuperada.' }])
    expect(attempts).toEqual([1, 2])
    expect(result).toMatchObject({
      assistantText: 'Resposta recuperada.',
      finishReason: 'stop',
      usedZeroTextRecovery: true,
    })
    expect(result.usage).toEqual({
      inputTokens: 4,
      outputTokens: 5,
    })
  })

  it('falls back deterministically when recovery attempts stay empty', async () => {
    vi.useFakeTimers()

    const session = buildSession()
    const trackTurnUsage = vi.fn().mockResolvedValue(undefined)
    const logWarn = vi.fn()
    const streamAssistantTurn = vi.fn().mockImplementation(createStreamTurn({
      assistantText: '',
      toolCalls: [],
      finishReason: 'stop',
      model: 'test-model',
      usage: {
        inputTokens: 2,
        outputTokens: 0,
      },
    }))

    const pending = collectGenerator(recoverAssistantResponse({
      session,
      userMessage: 'Tenho uma nova vaga',
      requestId: 'req_fallback',
      appUserId: 'usr_123',
      requestStartedAt: 10,
      cachedSystemPrompt: 'system prompt',
      historyChars: 120,
      releaseMetadata: {
        releaseId: 'rel_123',
        releaseSource: 'vercel_commit',
        commitShortSha: 'abc1234',
        deploymentEnv: 'preview',
        resolvedAgentModel: 'test-model',
        resolvedDialogModel: 'test-dialog-model',
      },
      toolIterations: 2,
      recoverySystemPrompt: 'recovery prompt',
      conciseFallbackMaxTokens: 320,
      buildRecoveryUserPrompt: ({ attempt }) => `attempt-${attempt}`,
      streamAssistantTurn,
      trackTurnUsage,
      resolveAgentModelForPhase: () => 'test-dialog-model',
      resolveDeterministicAssistantFallback: () => ({
        text: 'Fallback final para a vaga.',
        kind: 'dialog_saved_target_context',
      }),
      logWarn,
    }))

    await vi.runAllTimersAsync()
    const { events, result } = await pending

    expect(events).toEqual([{ type: 'text', content: 'Fallback final para a vaga.' }])
    expect(result).toEqual({
      recovered: false,
      assistantText: 'Fallback final para a vaga.',
    })
    expect(trackTurnUsage).toHaveBeenCalledTimes(3)
    expect(logWarn).toHaveBeenCalledWith(
      'agent.response.empty_fallback',
      expect.objectContaining({
        fallbackKind: 'dialog_saved_target_context',
        toolIterations: 2,
        finalAssistantTextChars: 'Fallback final para a vaga.'.length,
      }),
    )
  })
})
