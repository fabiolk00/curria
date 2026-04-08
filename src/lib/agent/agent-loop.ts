import type OpenAI from 'openai'

import { buildSystemPrompt, trimMessages } from '@/lib/agent/context-builder'
import { TOOL_ERROR_CODES, toolFailure } from '@/lib/agent/tool-errors'
import { TOOL_DEFINITIONS, dispatchTool } from '@/lib/agent/tools'
import { getMessages, appendMessage } from '@/lib/db/sessions'
import { AGENT_CONFIG, MODEL_CONFIG } from '@/lib/agent/config'
import { trackApiUsage } from '@/lib/agent/usage-tracker'
import { openai } from '@/lib/openai/client'
import { getChatCompletionUsage, createChatCompletionWithRetry } from '@/lib/openai/chat'
import { logError, logInfo, logWarn, serializeError } from '@/lib/observability/structured-log'
import type { Session } from '@/types/agent'

const EMPTY_ASSISTANT_RESPONSE_FALLBACK = 'Analisei sua mensagem, mas não consegui concluir a resposta desta vez. Tente enviar novamente e eu continuo a partir do contexto já salvo.'
const EMPTY_ASSISTANT_RECOVERY_PROMPT = 'The previous completion returned no visible assistant text. Respond to the user now with a direct, helpful plain-text answer. Do not call tools. Do not leave the content empty.'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AgentLoopEvent =
  | { type: 'delta'; text: string }
  | {
      type: 'done'
      sessionId: string
      phase: string
      atsScore: unknown
      messageCount: number
      maxMessages: number
      isNewSession: boolean
      requestId: string
      toolIterations: number
    }
  | { type: 'error'; error: Error }

export type AgentLoopParams = {
  session: Session
  userMessage: string
  appUserId: string
  requestId: string
  isNewSession: boolean
  requestStartedAt: number
  /** Signal from the incoming request — fires when the client disconnects. */
  signal?: AbortSignal
}

// ---------------------------------------------------------------------------
// Helpers (moved from route.ts)
// ---------------------------------------------------------------------------

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

function buildAssistantToolCallMessage(
  message: OpenAI.Chat.Completions.ChatCompletionMessage,
): OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam {
  return {
    role: 'assistant',
    content: message.content ?? '',
    tool_calls: message.tool_calls,
  }
}

async function recoverEmptyAssistantResponse(params: {
  cachedSystemPrompt: string
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
  requestId: string
  sessionId: string
  appUserId: string
  phase: string
  stateVersion: number
  signal?: AbortSignal
}): Promise<string> {
  const response = await callOpenAIWithRetry(
    {
      model: MODEL_CONFIG.agent,
      max_completion_tokens: Math.min(AGENT_CONFIG.maxTokens, 900),
      tool_choice: 'none',
      messages: [
        { role: 'system', content: params.cachedSystemPrompt },
        ...params.messages,
        { role: 'system', content: EMPTY_ASSISTANT_RECOVERY_PROMPT },
      ],
    },
    2,
    {
      requestId: params.requestId,
      sessionId: params.sessionId,
      appUserId: params.appUserId,
      phase: params.phase,
      stateVersion: params.stateVersion,
    },
    params.signal,
  )

  const usage = getChatCompletionUsage(response)
  trackApiUsage({
    userId: params.appUserId,
    sessionId: params.sessionId,
    model: MODEL_CONFIG.agent,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    endpoint: 'agent',
  }).catch(() => {})

  return response.choices[0]?.message?.content?.trim() ?? ''
}

async function callOpenAIWithRetry(
  params: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
  maxRetries: number,
  traceContext: {
    requestId: string
    sessionId: string
    appUserId: string
    phase: string
    stateVersion: number
  },
  externalSignal?: AbortSignal,
): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  try {
    return await createChatCompletionWithRetry(openai, params, maxRetries, AGENT_CONFIG.timeout, externalSignal)
  } catch (error) {
    logWarn('agent.model.failed', {
      requestId: traceContext.requestId,
      sessionId: traceContext.sessionId,
      appUserId: traceContext.appUserId,
      phase: traceContext.phase,
      stateVersion: traceContext.stateVersion,
      ...serializeError(error),
    })
    throw error
  }
}

// ---------------------------------------------------------------------------
// Core loop
// ---------------------------------------------------------------------------

/**
 * Runs the agent tool loop. Yields `AgentLoopEvent` objects that the route
 * can encode directly into SSE chunks.
 *
 * The caller is responsible for:
 * - Persisting the user message (appendMessage) before calling this
 * - Encoding yielded events into the SSE format
 * - Handling errors (the generator catches internally and yields an error event)
 */
export async function* runAgentLoop(
  params: AgentLoopParams,
): AsyncGenerator<AgentLoopEvent> {
  const { session, userMessage, appUserId, requestId, isNewSession, requestStartedAt, signal } = params

  await appendMessage(session.id, 'user', userMessage)

  const history = await getMessages(session.id)
  const messages = toOpenAIHistory(
    trimMessages(history.map((m) => ({ role: m.role, content: m.content }))),
  )

  try {
    let continueLoop = true
    let toolIterations = 0
    let assistantResponded = false

    // Cache the system prompt; only rebuild when session state changes (4.3)
    let cachedSystemPrompt = buildSystemPrompt(session)
    let systemPromptDirty = false

    while (continueLoop) {
      // Check if the client disconnected before starting a new iteration
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
        break
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
        break
      }

      // Rebuild system prompt only if a tool patch changed session state
      if (systemPromptDirty) {
        cachedSystemPrompt = buildSystemPrompt(session)
        systemPromptDirty = false
      }

      const response = await callOpenAIWithRetry(
        {
          model: MODEL_CONFIG.agent,
          max_completion_tokens: AGENT_CONFIG.maxTokens,
          messages: [
            { role: 'system', content: cachedSystemPrompt },
            ...messages,
          ],
          tools: TOOL_DEFINITIONS,
        },
        3,
        {
          requestId,
          sessionId: session.id,
          appUserId,
          phase: session.phase,
          stateVersion: session.stateVersion,
        },
        signal,
      )

      const usage = getChatCompletionUsage(response)
      trackApiUsage({
        userId: appUserId,
        sessionId: session.id,
        model: MODEL_CONFIG.agent,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        endpoint: 'agent',
      }).catch(() => {})

      const responseMessage = response.choices[0]?.message
      const finishReason = response.choices[0]?.finish_reason
      const assistantText = responseMessage?.content?.trim() ?? ''

      if (assistantText) {
        assistantResponded = true
        for (const word of assistantText.split(' ')) {
          yield { type: 'delta', text: word + ' ' }
        }
        await appendMessage(session.id, 'assistant', assistantText)
      }

      const toolCalls = responseMessage?.tool_calls ?? []
      continueLoop = finishReason === 'tool_calls' && toolCalls.length > 0

      if (!continueLoop) break

      messages.push(buildAssistantToolCallMessage(responseMessage!))

      for (const toolCall of toolCalls) {
        if (toolCall.type !== 'function') continue

        const toolInput = parseJsonObject(toolCall.function.arguments)
        if (!toolInput) {
          messages.push(
            buildToolMessage(
              toolCall.id,
              JSON.stringify(
                toolFailure(TOOL_ERROR_CODES.VALIDATION_ERROR, 'Malformed tool arguments from model.'),
              ),
            ),
          )
          continue
        }

        const toolResult = await dispatchTool(toolCall.function.name, toolInput, session, signal)
        messages.push(buildToolMessage(toolCall.id, toolResult))
        // Tool dispatch may have mutated session state via applyToolPatchWithVersion
        systemPromptDirty = true
      }
    }

    if (!assistantResponded && !signal?.aborted) {
      const recoveredText = await recoverEmptyAssistantResponse({
        cachedSystemPrompt,
        messages,
        requestId,
        sessionId: session.id,
        appUserId,
        phase: session.phase,
        stateVersion: session.stateVersion,
        signal,
      })

      const finalAssistantText = recoveredText || EMPTY_ASSISTANT_RESPONSE_FALLBACK

      for (const word of finalAssistantText.split(' ')) {
        yield { type: 'delta', text: word + ' ' }
      }
      await appendMessage(session.id, 'assistant', finalAssistantText)
      logWarn(recoveredText ? 'agent.response.empty_recovered' : 'agent.response.empty_fallback', {
        requestId,
        sessionId: session.id,
        appUserId,
        phase: session.phase,
        stateVersion: session.stateVersion,
        toolIterations,
        success: true,
      })
    }

    logInfo('agent.request.completed', {
      requestId,
      sessionId: session.id,
      appUserId,
      phase: session.phase,
      stateVersion: session.stateVersion,
      isNewSession,
      messageCount: session.messageCount + 1,
      toolIterations,
      parseConfidenceScore: session.agentState.parseConfidenceScore,
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
  } catch (err) {
    logError('agent.request.failed', {
      requestId,
      sessionId: session.id,
      appUserId,
      phase: session.phase,
      stateVersion: session.stateVersion,
      parseConfidenceScore: session.agentState.parseConfidenceScore,
      success: false,
      latencyMs: Date.now() - requestStartedAt,
      ...serializeError(err),
    })
    yield { type: 'error', error: err instanceof Error ? err : new Error(String(err)) }
  }
}
