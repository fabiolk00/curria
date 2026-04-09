import type OpenAI from 'openai'
import { APIError } from 'openai'

import { buildSystemPrompt, trimMessages } from '@/lib/agent/context-builder'
import { AGENT_CONFIG, MODEL_CONFIG } from '@/lib/agent/config'
import { TOOL_ERROR_CODES, toolFailure } from '@/lib/agent/tool-errors'
import { dispatchToolWithContext, TOOL_DEFINITIONS } from '@/lib/agent/tools'
import { trackApiUsage } from '@/lib/agent/usage-tracker'
import { appendMessage, getMessages } from '@/lib/db/sessions'
import { createChatCompletionStreamWithRetry } from '@/lib/openai/chat'
import { openai } from '@/lib/openai/client'
import { logError, logInfo, logWarn, serializeError } from '@/lib/observability/structured-log'
import type {
  AgentDoneChunk,
  AgentErrorChunk,
  AgentPatchChunk,
  AgentTextChunk,
  AgentToolResultChunk,
  AgentToolStartChunk,
  Session,
} from '@/types/agent'

const EMPTY_ASSISTANT_RECOVERY_PROMPT = 'The previous completion returned no visible assistant text. Respond to the user now with a direct, helpful plain-text answer. Do not call tools. Do not leave the content empty.'
const LENGTH_RECOVERY_PROMPT = 'Your previous response was cut off by token limits. Continue exactly where it stopped. Do not repeat prior text. Do not call tools.'

type AgentLoopEvent =
  | AgentTextChunk
  | AgentToolStartChunk
  | AgentToolResultChunk
  | AgentPatchChunk
  | AgentDoneChunk
  | AgentErrorChunk

type AgentLoopParams = {
  session: Session
  userMessage: string
  appUserId: string
  requestId: string
  isNewSession: boolean
  requestStartedAt: number
  signal?: AbortSignal
}

type AccumulatedToolCall = {
  id: string
  name: string
  argumentsRaw: string
}

type StreamTurnResult = {
  assistantText: string
  toolCalls: AccumulatedToolCall[]
  finishReason: OpenAI.Chat.Completions.ChatCompletionChunk.Choice['finish_reason'] | null
  usage?: {
    inputTokens: number
    outputTokens: number
  }
}

function parseJsonObject(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null
    }
    return parsed as Record<string, unknown>
  } catch {
    return null
  }
}

function toOpenAIHistory(
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  return history.map((message) => ({
    role: message.role,
    content: message.content,
  }))
}

function buildToolMessage(
  toolCallId: string,
  content: string,
): OpenAI.Chat.Completions.ChatCompletionToolMessageParam {
  return { role: 'tool', tool_call_id: toolCallId, content }
}

function buildAssistantToolCallMessage(params: {
  assistantText: string
  toolCalls: AccumulatedToolCall[]
}): OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam {
  return {
    role: 'assistant',
    content: params.assistantText,
    tool_calls: params.toolCalls.map((toolCall) => ({
      id: toolCall.id,
      type: 'function',
      function: {
        name: toolCall.name,
        arguments: toolCall.argumentsRaw,
      },
    })),
  }
}

function mapAPIErrorMessage(error: APIError): string {
  const status = error.status ?? 0
  const statusMessages: Record<number, string> = {
    400: 'Erro na requisição. Por favor, tente novamente.',
    401: 'Erro de configuração da IA. Entre em contato com o suporte.',
    403: 'Acesso negado ao serviço de IA. Entre em contato com o suporte.',
    429: 'O serviço de IA está sobrecarregado. Tente novamente em alguns segundos.',
    500: 'O serviço de IA está temporariamente indisponível. Tente novamente.',
    502: 'O serviço de IA está temporariamente indisponível. Tente novamente.',
    503: 'O serviço de IA está em manutenção. Tente novamente em alguns minutos.',
  }

  return statusMessages[status] ?? 'Algo deu errado. Por favor, tente novamente.'
}

function buildErrorChunk(params: {
  error: unknown
  requestId: string
  fallbackMessage?: string
}): AgentErrorChunk {
  if (params.error instanceof APIError && params.error.status) {
    return {
      type: 'error',
      error: mapAPIErrorMessage(params.error),
      code: TOOL_ERROR_CODES.INTERNAL_ERROR,
      requestId: params.requestId,
    }
  }

  if ((params.error instanceof Error || params.error instanceof DOMException) && params.error.name === 'AbortError') {
    return {
      type: 'error',
      error: 'A requisição demorou muito. Por favor, tente novamente.',
      code: TOOL_ERROR_CODES.INTERNAL_ERROR,
      requestId: params.requestId,
    }
  }

  return {
    type: 'error',
    error: params.fallbackMessage ?? 'Algo deu errado. Por favor, tente novamente.',
    code: TOOL_ERROR_CODES.INTERNAL_ERROR,
    requestId: params.requestId,
  }
}

function createErrorChunk(
  error: string,
  requestId: string,
  code: AgentErrorChunk['code'] = TOOL_ERROR_CODES.INTERNAL_ERROR,
): AgentErrorChunk {
  return {
    type: 'error',
    error,
    code,
    requestId,
  }
}

function toUsage(
  usage: OpenAI.CompletionUsage | null | undefined,
): StreamTurnResult['usage'] | undefined {
  if (!usage) {
    return undefined
  }

  return {
    inputTokens: usage.prompt_tokens ?? 0,
    outputTokens: usage.completion_tokens ?? 0,
  }
}

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

async function* streamAssistantTurn(params: {
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
}): AsyncGenerator<AgentTextChunk, StreamTurnResult> {
  const streamStartedAt = Date.now()

  // Only include tool_choice if tools are provided. OpenAI API requires tools when tool_choice is set.
  const requestParams: Parameters<typeof createChatCompletionStreamWithRetry>[1] = {
    model: MODEL_CONFIG.agent,
    max_completion_tokens: params.maxCompletionTokens,
    messages: [
      { role: 'system', content: params.cachedSystemPrompt },
      ...params.messages,
    ],
    stream: true,
    stream_options: { include_usage: true },
  }

  if (params.tools && params.tools.length > 0) {
    requestParams.tools = params.tools
    if (params.toolChoice) {
      requestParams.tool_choice = params.toolChoice
    }
  }

  const stream = await createChatCompletionStreamWithRetry(
    openai,
    requestParams,
    3,
    AGENT_CONFIG.timeout,
    params.signal,
  )

  const toolCalls: AccumulatedToolCall[] = []
  let assistantText = ''
  let finishReason: StreamTurnResult['finishReason'] = null
  let usage: StreamTurnResult['usage']
  let loggedFirstToken = false

  for await (const chunk of stream) {
    if (params.signal?.aborted) {
      throw new DOMException('Request aborted', 'AbortError')
    }

    if (chunk.usage) {
      usage = toUsage(chunk.usage)
    }

    const choice = chunk.choices[0]
    if (!choice) {
      continue
    }

    const { delta } = choice
    if (choice.finish_reason) {
      finishReason = choice.finish_reason
    }

    if (delta.content) {
      assistantText += delta.content

      if (!loggedFirstToken) {
        loggedFirstToken = true
        logInfo('agent.stream.first_token', {
          requestId: params.requestId,
          sessionId: params.session.id,
          appUserId: params.appUserId,
          phase: params.session.phase,
          stateVersion: params.session.stateVersion,
          setupMs: streamStartedAt - params.requestStartedAt,
          firstTokenMs: Date.now() - streamStartedAt,
          totalLatencyMs: Date.now() - params.requestStartedAt,
          success: true,
        })
      }

      yield {
        type: 'text',
        content: delta.content,
      }
    }

    if (!delta.tool_calls) {
      continue
    }

    for (const toolCallDelta of delta.tool_calls) {
      const index = toolCallDelta.index ?? 0

      if (!toolCalls[index]) {
        toolCalls[index] = {
          id: toolCallDelta.id ?? '',
          name: toolCallDelta.function?.name ?? '',
          argumentsRaw: '',
        }
      }

      if (toolCallDelta.id) {
        toolCalls[index].id = toolCallDelta.id
      }

      if (toolCallDelta.function?.name) {
        toolCalls[index].name = toolCallDelta.function.name
      }

      if (toolCallDelta.function?.arguments) {
        toolCalls[index].argumentsRaw += toolCallDelta.function.arguments
      }
    }
  }

  return {
    assistantText,
    toolCalls: toolCalls.filter(Boolean),
    finishReason,
    usage,
  }
}

async function* recoverTruncatedTurn(params: {
  initialTurn: StreamTurnResult
  session: Session
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
  cachedSystemPrompt: string
  requestId: string
  appUserId: string
  requestStartedAt: number
  signal?: AbortSignal
  maxCompletionTokens: number
}): AsyncGenerator<AgentTextChunk, StreamTurnResult> {
  let accumulatedAssistantText = params.initialTurn.assistantText
  let finishReason = params.initialTurn.finishReason
  let usage = params.initialTurn.usage
  let recoveryAttempts = 0

  while (finishReason === 'length' && recoveryAttempts < 2 && !params.signal?.aborted) {
    recoveryAttempts++

    const continuationTurn = yield* streamAssistantTurn({
      session: params.session,
      messages: [
        ...params.messages,
        { role: 'assistant', content: accumulatedAssistantText },
        { role: 'user', content: LENGTH_RECOVERY_PROMPT },
      ],
      cachedSystemPrompt: params.cachedSystemPrompt,
      requestId: params.requestId,
      appUserId: params.appUserId,
      requestStartedAt: params.requestStartedAt,
      signal: params.signal,
      maxCompletionTokens: Math.min(params.maxCompletionTokens, 1200),
    })

    accumulatedAssistantText += continuationTurn.assistantText
    finishReason = continuationTurn.finishReason
    usage = mergeUsage(usage, continuationTurn.usage)

    if (continuationTurn.toolCalls.length > 0) {
      return {
        assistantText: accumulatedAssistantText,
        toolCalls: continuationTurn.toolCalls,
        finishReason,
        usage,
      }
    }
  }

  return {
    assistantText: accumulatedAssistantText,
    toolCalls: [],
    finishReason,
    usage,
  }
}

export async function* runAgentLoop(
  params: AgentLoopParams,
): AsyncGenerator<AgentLoopEvent> {
  const { session, userMessage, appUserId, requestId, isNewSession, requestStartedAt, signal } = params

  await appendMessage(session.id, 'user', userMessage)

  const history = await getMessages(session.id, AGENT_CONFIG.maxHistoryMessages)
  const messages = toOpenAIHistory(
    trimMessages(history.map((message) => ({ role: message.role, content: message.content }))),
  )

  let toolIterations = 0
  let assistantResponded = false
  let cachedSystemPrompt = buildSystemPrompt(session)
  let systemPromptDirty = false

  try {
    while (true) {
      if (signal?.aborted) {
        logInfo('agent.request.cancelled', {
          requestId,
          sessionId: session.id,
          appUserId,
          phase: session.phase,
          toolIterations,
          success: false,
          latencyMs: Date.now() - requestStartedAt,
        })
        return
      }

      toolIterations++

      if (toolIterations > AGENT_CONFIG.maxToolIterations) {
        logError('agent.tool_loop.exceeded', {
          requestId,
          sessionId: session.id,
          appUserId,
          phase: session.phase,
          stateVersion: session.stateVersion,
          toolIterations,
          maxToolIterations: AGENT_CONFIG.maxToolIterations,
          success: false,
        })

        yield {
          type: 'error',
          error: 'A IA excedeu o número máximo de chamadas de ferramenta. Tente novamente.',
          code: TOOL_ERROR_CODES.INTERNAL_ERROR,
          requestId,
        }
        break
      }

      if (systemPromptDirty) {
        cachedSystemPrompt = buildSystemPrompt(session)
        systemPromptDirty = false
      }

      let turn = yield* streamAssistantTurn({
        session,
        messages,
        cachedSystemPrompt,
        requestId,
        appUserId,
        requestStartedAt,
        signal,
        maxCompletionTokens: AGENT_CONFIG.maxTokens,
        tools: TOOL_DEFINITIONS,
      })

      if (turn.finishReason === 'length' && turn.toolCalls.length === 0 && turn.assistantText.trim()) {
        turn = yield* recoverTruncatedTurn({
          initialTurn: turn,
          session,
          messages,
          cachedSystemPrompt,
          requestId,
          appUserId,
          requestStartedAt,
          signal,
          maxCompletionTokens: AGENT_CONFIG.maxTokens,
        })
      }

      if (turn.usage) {
        trackApiUsage({
          userId: appUserId,
          sessionId: session.id,
          model: MODEL_CONFIG.agent,
          inputTokens: turn.usage.inputTokens,
          outputTokens: turn.usage.outputTokens,
          endpoint: 'agent',
        }).catch(() => {})
      }

      if (turn.assistantText.trim()) {
        assistantResponded = true
        await appendMessage(session.id, 'assistant', turn.assistantText.trim())
      }

      if (turn.finishReason === 'tool_calls') {
        if (turn.toolCalls.length === 0) {
          yield createErrorChunk(
            'The AI response was incomplete.',
            requestId,
          )
          break
        }
      } else if (turn.finishReason === 'stop') {
        break
      } else if (turn.finishReason === 'length') {
        logWarn('agent.response.truncated_after_recovery', {
          requestId,
          sessionId: session.id,
          appUserId,
          phase: session.phase,
          stateVersion: session.stateVersion,
          toolIterations,
          success: true,
        })
        break
      } else if (!turn.finishReason) {
        yield createErrorChunk(
          'The AI response was incomplete.',
          requestId,
        )
        break
      } else {
        yield createErrorChunk(
          `Unexpected finish reason: ${turn.finishReason}`,
          requestId,
        )
        break
      }

      messages.push(buildAssistantToolCallMessage({
        assistantText: turn.assistantText,
        toolCalls: turn.toolCalls,
      }))

      for (const toolCall of turn.toolCalls) {
        yield {
          type: 'toolStart',
          toolName: toolCall.name,
        }

        const toolInput = parseJsonObject(toolCall.argumentsRaw)
        if (!toolInput) {
          const failure = toolFailure(
            TOOL_ERROR_CODES.LLM_INVALID_OUTPUT,
            `Failed to parse arguments for tool "${toolCall.name}".`,
          )

          messages.push(buildToolMessage(toolCall.id, JSON.stringify(failure)))

          yield createErrorChunk(failure.error, requestId, failure.code)
          break
        }

        const toolResult = await dispatchToolWithContext(toolCall.name, toolInput, session, signal)

        if (toolResult.outputFailure) {
          // Append tool message for failed execution (required by chat API protocol)
          // Even failed tools must have a matching tool message in the conversation history
          messages.push(buildToolMessage(toolCall.id, JSON.stringify(toolResult.outputFailure)))

          yield {
            type: 'error',
            error: toolResult.outputFailure.error,
            code: toolResult.outputFailure.code,
            requestId,
          }

          if (toolResult.persistedPatch) {
            yield {
              type: 'patch',
              patch: toolResult.persistedPatch,
              phase: session.phase,
            }
            systemPromptDirty = true
          }
          continue
        }

        // Add successful tool results to message history
        messages.push(buildToolMessage(toolCall.id, toolResult.outputJson))

        yield {
          type: 'toolResult',
          toolName: toolCall.name,
          output: toolResult.output,
        }

        if (toolResult.persistedPatch) {
          yield {
            type: 'patch',
            patch: toolResult.persistedPatch,
            phase: session.phase,
          }
          systemPromptDirty = true
        }
      }
    }

    if (!assistantResponded && !signal?.aborted) {
      // Recovery attempt with retry logic: up to 3 attempts with exponential backoff
      let recoverySucceeded = false
      let finalAssistantText = ''
      const maxRecoveryAttempts = 3

      for (let recoveryAttempt = 1; recoveryAttempt <= maxRecoveryAttempts && !recoverySucceeded && !signal?.aborted; recoveryAttempt++) {
        if (recoveryAttempt > 1) {
          // Wait before retry: 1s, 2s delays
          const delayMs = Math.pow(2, recoveryAttempt - 2) * 1000
          await new Promise(resolve => setTimeout(resolve, delayMs))
        }

        const recoveryTurn = yield* streamAssistantTurn({
          session,
          messages: [
            ...messages,
            { role: 'system', content: EMPTY_ASSISTANT_RECOVERY_PROMPT },
          ],
          cachedSystemPrompt,
          requestId,
          appUserId,
          requestStartedAt,
          signal,
          maxCompletionTokens: Math.min(AGENT_CONFIG.maxTokens, 900),
          // No tools in recovery mode, so no tool_choice needed
        })

        if (recoveryTurn.usage) {
          trackApiUsage({
            userId: appUserId,
            sessionId: session.id,
            model: MODEL_CONFIG.agent,
            inputTokens: recoveryTurn.usage.inputTokens,
            outputTokens: recoveryTurn.usage.outputTokens,
            endpoint: 'agent',
          }).catch(() => {})
        }

        // Check if recovery was successful (got assistant text)
        if (recoveryTurn.assistantText?.trim()) {
          recoverySucceeded = true
          finalAssistantText = recoveryTurn.assistantText.trim()
        }
      }

      if (!recoverySucceeded) {
        // Final fallback after all recovery attempts failed
        finalAssistantText = 'I encountered an issue processing your request. Please try again or rephrase your question.'
      }

      assistantResponded = true
      await appendMessage(session.id, 'assistant', finalAssistantText)

      logWarn(recoverySucceeded ? 'agent.response.empty_recovered' : 'agent.response.empty_fallback', {
        requestId,
        sessionId: session.id,
        appUserId,
        phase: session.phase,
        stateVersion: session.stateVersion,
        toolIterations,
        success: true,
      })
    }

    logInfo('agent.stream.completed', {
      requestId,
      sessionId: session.id,
      appUserId,
      phase: session.phase,
      stateVersion: session.stateVersion,
      isNewSession,
      messageCountAfter: session.messageCount + 1,
      toolLoopsUsed: toolIterations,
      success: true,
      latencyMs: Date.now() - requestStartedAt,
    })

    yield {
      type: 'done',
      requestId,
      sessionId: session.id,
      phase: session.phase,
      atsScore: session.atsScore,
      messageCount: session.messageCount + 1,
      maxMessages: AGENT_CONFIG.maxMessagesPerSession,
      isNewSession,
      toolIterations,
    }
  } catch (error) {
    if ((error instanceof Error || error instanceof DOMException) && error.name === 'AbortError' && signal?.aborted) {
      logInfo('agent.request.cancelled', {
        requestId,
        sessionId: session.id,
        appUserId,
        phase: session.phase,
        toolIterations,
        success: false,
        latencyMs: Date.now() - requestStartedAt,
      })
      return
    }

    logError('agent.request.failed', {
      requestId,
      sessionId: session.id,
      appUserId,
      phase: session.phase,
      stateVersion: session.stateVersion,
      parseConfidenceScore: session.agentState.parseConfidenceScore,
      success: false,
      latencyMs: Date.now() - requestStartedAt,
      ...serializeError(error),
    })

    yield buildErrorChunk({
      error,
      requestId,
    })
  }
}


