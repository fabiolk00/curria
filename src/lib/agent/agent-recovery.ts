import type OpenAI from 'openai'

import type { AgentReleaseMetadata } from '@/lib/runtime/release-metadata'
import type { Session } from '@/types/agent'

export type StreamTurnResult = {
  assistantText: string
  toolCalls: Array<{
    id: string
    name: string
    argumentsRaw: string
  }>
  finishReason: OpenAI.Chat.Completions.ChatCompletionChunk.Choice['finish_reason'] | null
  model: string
  usage?: {
    inputTokens: number
    outputTokens: number
  }
  usedLengthRecovery?: boolean
  usedZeroTextRecovery?: boolean
  usedConciseRecovery?: boolean
}

type StreamAssistantTurn = (params: {
  session: Session
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
  cachedSystemPrompt: string
  requestId: string
  appUserId: string
  requestStartedAt: number
  signal?: AbortSignal
  maxCompletionTokens: number
  tools?: OpenAI.Chat.Completions.ChatCompletionTool[]
  toolChoice?: OpenAI.Chat.Completions.ChatCompletionToolChoiceOption
}) => AsyncGenerator<{ type: 'text'; content: string }, StreamTurnResult>

type RecoveryPromptBuilder = (params: {
  session: Session
  userMessage: string
  mode: 'concise' | 'empty'
  attempt?: number
}) => string

type UsageTracker = (params: {
  session: Session
  appUserId: string
  releaseMetadata: AgentReleaseMetadata
  model: string
  usage: NonNullable<StreamTurnResult['usage']>
  finishReason: StreamTurnResult['finishReason']
  toolCalls: number
  assistantTextChars: number
  requestId: string
  systemPromptChars: number
  historyChars: number
  allowedToolCount: number
  usedLengthRecovery: boolean
  usedZeroTextRecovery: boolean
  usedConciseRecovery: boolean
}) => Promise<void>

type DeterministicFallbackResolver = (session: Session, userMessage: string) => {
  text: string
  kind: string
}

type LogFields = Record<string, string | number | boolean | null | undefined>

function mergeUsage(
  current: StreamTurnResult['usage'],
  next: StreamTurnResult['usage'],
): StreamTurnResult['usage'] {
  if (!current) {
    return next
  }

  if (!next) {
    return current
  }

  return {
    inputTokens: current.inputTokens + next.inputTokens,
    outputTokens: current.outputTokens + next.outputTokens,
  }
}

export async function* recoverTruncatedTurn(params: {
  initialTurn: StreamTurnResult
  session: Session
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
  cachedSystemPrompt: string
  requestId: string
  appUserId: string
  requestStartedAt: number
  signal?: AbortSignal
  maxCompletionTokens: number
  lengthRecoveryPrompt: string
  streamAssistantTurn: StreamAssistantTurn
  isBootstrapLikeAssistantText: (text: string) => boolean
  isConcreteRewriteContinuationText: (text: string) => boolean
}): AsyncGenerator<{ type: 'text'; content: string }, StreamTurnResult> {
  let accumulatedAssistantText = params.initialTurn.assistantText
  let finishReason = params.initialTurn.finishReason
  let usage = params.initialTurn.usage
  let recoveryAttempts = 0

  while (finishReason === 'length' && recoveryAttempts < 2 && !params.signal?.aborted) {
    recoveryAttempts++

    const continuationTurn = yield* params.streamAssistantTurn({
      session: params.session,
      messages: [
        ...params.messages,
        { role: 'assistant', content: accumulatedAssistantText },
        { role: 'user', content: params.lengthRecoveryPrompt },
      ],
      cachedSystemPrompt: params.cachedSystemPrompt,
      requestId: params.requestId,
      appUserId: params.appUserId,
      requestStartedAt: params.requestStartedAt,
      signal: params.signal,
      maxCompletionTokens: Math.min(params.maxCompletionTokens, 450),
    })

    const shouldReplacePriorText = params.isBootstrapLikeAssistantText(accumulatedAssistantText)
      && !params.isBootstrapLikeAssistantText(continuationTurn.assistantText)
      && params.isConcreteRewriteContinuationText(continuationTurn.assistantText)

    accumulatedAssistantText = shouldReplacePriorText
      ? continuationTurn.assistantText
      : `${accumulatedAssistantText}${continuationTurn.assistantText}`
    finishReason = continuationTurn.finishReason
    usage = mergeUsage(usage, continuationTurn.usage)

    if (continuationTurn.toolCalls.length > 0) {
      return {
        assistantText: accumulatedAssistantText,
        toolCalls: continuationTurn.toolCalls,
        finishReason,
        model: continuationTurn.model,
        usage,
        usedLengthRecovery: true,
      }
    }
  }

  return {
    assistantText: accumulatedAssistantText,
    toolCalls: [],
    finishReason,
    model: params.initialTurn.model,
    usage,
    usedLengthRecovery: recoveryAttempts > 0,
  }
}

export async function* recoverZeroTextTurn(params: {
  initialTurn: StreamTurnResult
  session: Session
  userMessage: string
  requestId: string
  appUserId: string
  requestStartedAt: number
  signal?: AbortSignal
  maxCompletionTokens: number
  recoverySystemPrompt: string
  buildRecoveryUserPrompt: RecoveryPromptBuilder
  streamAssistantTurn: StreamAssistantTurn
}): AsyncGenerator<{ type: 'text'; content: string }, StreamTurnResult> {
  let lastTurn = params.initialTurn
  let usage = params.initialTurn.usage
  let recoveryAttempts = 0

  while (recoveryAttempts < 2 && !params.signal?.aborted) {
    recoveryAttempts++

    const recoveryTurn = yield* params.streamAssistantTurn({
      session: params.session,
      messages: [
        {
          role: 'user',
          content: params.buildRecoveryUserPrompt({
            session: params.session,
            userMessage: params.userMessage,
            mode: 'empty',
            attempt: recoveryAttempts,
          }),
        },
      ],
      cachedSystemPrompt: params.recoverySystemPrompt,
      requestId: params.requestId,
      appUserId: params.appUserId,
      requestStartedAt: params.requestStartedAt,
      signal: params.signal,
      maxCompletionTokens: Math.min(params.maxCompletionTokens, 550),
    })

    usage = mergeUsage(usage, recoveryTurn.usage)
    lastTurn = {
      ...recoveryTurn,
      usage,
    }

    if (recoveryTurn.toolCalls.length > 0 || recoveryTurn.assistantText.trim() || recoveryTurn.finishReason !== 'length') {
      return {
        ...lastTurn,
        usedZeroTextRecovery: true,
      }
    }
  }

  return {
    ...lastTurn,
    model: lastTurn.model || params.initialTurn.model,
    usage,
    usedZeroTextRecovery: recoveryAttempts > 0,
  }
}

export async function* recoverConciseTurn(params: {
  session: Session
  userMessage: string
  requestId: string
  appUserId: string
  requestStartedAt: number
  signal?: AbortSignal
  conciseFallbackMaxTokens: number
  recoverySystemPrompt: string
  buildRecoveryUserPrompt: RecoveryPromptBuilder
  streamAssistantTurn: StreamAssistantTurn
}): AsyncGenerator<{ type: 'text'; content: string }, StreamTurnResult> {
  const turn = yield* params.streamAssistantTurn({
    session: params.session,
    messages: [
      {
        role: 'user',
        content: params.buildRecoveryUserPrompt({
          session: params.session,
          userMessage: params.userMessage,
          mode: 'concise',
        }),
      },
    ],
    cachedSystemPrompt: params.recoverySystemPrompt,
    requestId: params.requestId,
    appUserId: params.appUserId,
    requestStartedAt: params.requestStartedAt,
    signal: params.signal,
    maxCompletionTokens: params.conciseFallbackMaxTokens,
  })

  return {
    ...turn,
    usedConciseRecovery: true,
  }
}

export async function* recoverAssistantResponse(params: {
  session: Session
  userMessage: string
  requestId: string
  appUserId: string
  requestStartedAt: number
  signal?: AbortSignal
  cachedSystemPrompt: string
  historyChars: number
  releaseMetadata: AgentReleaseMetadata
  toolIterations: number
  recoverySystemPrompt: string
  conciseFallbackMaxTokens: number
  buildRecoveryUserPrompt: RecoveryPromptBuilder
  streamAssistantTurn: StreamAssistantTurn
  trackTurnUsage: UsageTracker
  resolveAgentModelForPhase: (phase: Session['phase']) => string
  resolveDeterministicAssistantFallback: DeterministicFallbackResolver
  logWarn: (event: string, payload: LogFields) => void
}): AsyncGenerator<{ type: 'text'; content: string }, {
  recovered: boolean
  assistantText: string
}> {
  let recoverySucceeded = false
  let finalAssistantText = ''
  const maxRecoveryAttempts = 3

  for (let recoveryAttempt = 1; recoveryAttempt <= maxRecoveryAttempts && !recoverySucceeded && !params.signal?.aborted; recoveryAttempt++) {
    if (recoveryAttempt > 1) {
      const delayMs = Math.pow(2, recoveryAttempt - 2) * 1000
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }

    const recoveryTurn = yield* params.streamAssistantTurn({
      session: params.session,
      messages: [
        {
          role: 'user',
          content: params.buildRecoveryUserPrompt({
            session: params.session,
            userMessage: params.userMessage,
            mode: 'empty',
            attempt: recoveryAttempt,
          }),
        },
      ],
      cachedSystemPrompt: params.recoverySystemPrompt,
      requestId: params.requestId,
      appUserId: params.appUserId,
      requestStartedAt: params.requestStartedAt,
      signal: params.signal,
      maxCompletionTokens: params.conciseFallbackMaxTokens,
    })

    if (recoveryTurn.usage) {
      await params.trackTurnUsage({
        session: params.session,
        appUserId: params.appUserId,
        releaseMetadata: params.releaseMetadata,
        model: recoveryTurn.model,
        usage: recoveryTurn.usage,
        finishReason: recoveryTurn.finishReason,
        toolCalls: recoveryTurn.toolCalls.length,
        assistantTextChars: recoveryTurn.assistantText.length,
        requestId: params.requestId,
        systemPromptChars: params.cachedSystemPrompt.length,
        historyChars: params.historyChars,
        allowedToolCount: 0,
        usedLengthRecovery: false,
        usedZeroTextRecovery: false,
        usedConciseRecovery: true,
      })
    }

    if (recoveryTurn.assistantText?.trim()) {
      recoverySucceeded = true
      finalAssistantText = recoveryTurn.assistantText.trim()
    }
  }

  if (!recoverySucceeded) {
    const fallback = params.resolveDeterministicAssistantFallback(params.session, params.userMessage)
    finalAssistantText = fallback.text
    yield {
      type: 'text',
      content: finalAssistantText,
    }
  }

  const fallback = recoverySucceeded
    ? null
    : params.resolveDeterministicAssistantFallback(params.session, params.userMessage)

  params.logWarn(recoverySucceeded ? 'agent.response.empty_recovered' : 'agent.response.empty_fallback', {
    ...params.releaseMetadata,
    requestId: params.requestId,
    sessionId: params.session.id,
    appUserId: params.appUserId,
    phase: params.session.phase,
    stateVersion: params.session.stateVersion,
    model: params.resolveAgentModelForPhase(params.session.phase),
    fallbackKind: fallback?.kind,
    finalAssistantTextChars: finalAssistantText.length,
    toolIterations: params.toolIterations,
    success: true,
  })

  return {
    recovered: recoverySucceeded,
    assistantText: finalAssistantText,
  }
}
