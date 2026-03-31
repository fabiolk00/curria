import { NextRequest } from 'next/server'
import type OpenAI from 'openai'
import { APIError } from 'openai'
import { z } from 'zod'

import { buildSystemPrompt, trimMessages } from '@/lib/agent/context-builder'
import { TOOL_DEFINITIONS, dispatchTool } from '@/lib/agent/tools'
import { getCurrentAppUser } from '@/lib/auth/app-user'
import {
  getSession,
  createSession,
  getMessages,
  appendMessage,
  checkUserQuota,
  incrementMessageCount,
  updateSession,
} from '@/lib/db/sessions'
import { consumeCredit } from '@/lib/asaas/quota'
import { agentLimiter } from '@/lib/rate-limit'
import { AGENT_CONFIG, MODEL_CONFIG } from '@/lib/agent/config'
import { trackApiUsage } from '@/lib/agent/usage-tracker'
import { extractUrl } from '@/lib/agent/url-extractor'
import { scrapeJobPosting } from '@/lib/agent/scraper'
import { openai } from '@/lib/openai/client'
import { getChatCompletionUsage, createChatCompletionWithRetry } from '@/lib/openai/chat'
import { logError, logInfo, logWarn, serializeError } from '@/lib/observability/structured-log'

/**
 * Calls OpenAI with retry logic and request tracing/logging.
 * Uses the unified retry implementation from openai/chat.ts with additional logging.
 */
async function callOpenAIWithRetry(
  params: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
  maxRetries = 3,
  traceContext?: {
    sessionId?: string
    appUserId?: string
    phase?: string
    stateVersion?: number
  },
): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  try {
    return await createChatCompletionWithRetry(openai, params, maxRetries)
  } catch (error) {
    // Log failures after all retries exhausted
    if (traceContext) {
      logWarn('agent.model.failed', {
        sessionId: traceContext.sessionId,
        appUserId: traceContext.appUserId,
        phase: traceContext.phase,
        stateVersion: traceContext.stateVersion,
        ...serializeError(error),
      })
    }
    throw error
  }
}

const BodySchema = z.object({
  sessionId: z.string().optional(),
  message: z.string().min(1).max(8000),
  file: z.string().optional(),
  fileMime: z.enum([
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/png',
    'image/jpeg',
  ]).optional(),
})

function sanitizeUserInput(input: string): string {
  return input
    .replace(/<\/?user_resume_data>/gi, '')
    .replace(/<\/?system>/gi, '')
    .replace(/<\/?instructions>/gi, '')
    .replace(/<\/?assistant>/gi, '')
    .trim()
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
  return {
    role: 'tool',
    tool_call_id: toolCallId,
    content,
  }
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

export async function POST(req: NextRequest) {
  const requestStartedAt = Date.now()

  const appUser = await getCurrentAppUser()
  if (!appUser) {
    logWarn('agent.request.unauthorized', {
      success: false,
      latencyMs: Date.now() - requestStartedAt,
    })
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }
  const appUserId = appUser.id

  const { success } = await agentLimiter.limit(appUserId)
  if (!success) {
    logWarn('agent.request.rate_limited', {
      appUserId,
      success: false,
      latencyMs: Date.now() - requestStartedAt,
    })
    return new Response(JSON.stringify({ error: 'Too many requests. Please wait a moment.' }), { status: 429 })
  }

  const raw = BodySchema.safeParse(await req.json())
  if (!raw.success) {
    logWarn('agent.request.invalid_body', {
      appUserId,
      success: false,
      latencyMs: Date.now() - requestStartedAt,
    })
    return new Response(JSON.stringify({ error: raw.error.flatten() }), { status: 400 })
  }
  const { sessionId, file, fileMime } = raw.data
  let message = sanitizeUserInput(raw.data.message)

  logInfo('agent.request.received', {
    appUserId,
    requestedSessionId: sessionId,
    messageLength: message.length,
    hasFile: Boolean(file && fileMime),
    fileMime,
    success: true,
  })

  const detectedUrl = extractUrl(message)
  if (detectedUrl) {
    const scrapeResult = await scrapeJobPosting(detectedUrl)
    const detectedUrlHost = (() => {
      try {
        return new URL(detectedUrl).hostname
      } catch {
        return 'invalid-url'
      }
    })()

    if (scrapeResult.success && scrapeResult.text) {
      message = message.replace(
        detectedUrl,
        `[Link da vaga: ${detectedUrl}]\n\n[Conteudo extraido automaticamente]:\n${scrapeResult.text}`,
      )
      logInfo('agent.scrape.completed', {
        appUserId,
        detectedUrlHost,
        scrapeSucceeded: true,
        scrapedTextLength: scrapeResult.text.length,
        success: true,
      })
    } else {
      logWarn('agent.scrape.completed', {
        appUserId,
        detectedUrlHost,
        scrapeSucceeded: false,
        success: false,
      })
      message = `${message}\n\n[Nota do sistema: Tentei acessar o link ${detectedUrl} mas nao consegui extrair o conteudo. Motivo: ${scrapeResult.error}]`
    }
  }

  let session = sessionId
    ? await getSession(sessionId, appUserId)
    : null

  let isNewSession = false

  if (session) {
    logInfo('agent.session.loaded', {
      sessionId: session.id,
      appUserId,
      phase: session.phase,
      stateVersion: session.stateVersion,
      messageCount: session.messageCount,
      isNewSession: false,
      success: true,
    })

    if (session.messageCount >= AGENT_CONFIG.maxMessagesPerSession) {
      logWarn('agent.session.message_cap_reached', {
        sessionId: session.id,
        appUserId,
        phase: session.phase,
        stateVersion: session.stateVersion,
        messageCount: session.messageCount,
        maxMessages: AGENT_CONFIG.maxMessagesPerSession,
        success: false,
      })
      return new Response(JSON.stringify({
        error: 'Esta sessao atingiu o limite de 15 mensagens. Inicie uma nova analise para continuar.',
        action: 'new_session',
        messageCount: session.messageCount,
        maxMessages: AGENT_CONFIG.maxMessagesPerSession,
      }), { status: 429 })
    }
  } else {
    const hasCredits = await checkUserQuota(appUserId)
    if (!hasCredits) {
      logWarn('agent.session.create_blocked_no_credit', {
        appUserId,
        success: false,
        latencyMs: Date.now() - requestStartedAt,
      })
      return new Response(JSON.stringify({
        error: 'Seus creditos acabaram. Faca upgrade do seu plano para continuar.',
        upgradeUrl: '/pricing',
      }), { status: 402 })
    }

    const creditConsumed = await consumeCredit(appUserId)
    if (!creditConsumed) {
      logError('agent.credit.consume_failed', {
        appUserId,
        creditConsumed: 0,
        success: false,
        latencyMs: Date.now() - requestStartedAt,
      })
      return new Response(JSON.stringify({
        error: 'Erro ao processar credito. Tente novamente.',
      }), { status: 500 })
    }

    session = await createSession(appUserId)
    isNewSession = true
    logInfo('agent.session.created', {
      sessionId: session.id,
      appUserId,
      phase: session.phase,
      stateVersion: session.stateVersion,
      isNewSession: true,
      creditConsumed: 1,
      success: true,
      latencyMs: Date.now() - requestStartedAt,
    })
  }

  const messageCountIncremented = await incrementMessageCount(session.id)
  if (!messageCountIncremented) {
    logWarn('agent.session.message_cap_reached', {
      sessionId: session.id,
      appUserId,
      phase: session.phase,
      stateVersion: session.stateVersion,
      messageCount: AGENT_CONFIG.maxMessagesPerSession,
      maxMessages: AGENT_CONFIG.maxMessagesPerSession,
      success: false,
    })
    return new Response(JSON.stringify({
      error: 'Esta sessao atingiu o limite de 15 mensagens. Inicie uma nova analise para continuar.',
      action: 'new_session',
      messageCount: AGENT_CONFIG.maxMessagesPerSession,
      maxMessages: AGENT_CONFIG.maxMessagesPerSession,
    }), { status: 429 })
  }

  await appendMessage(session.id, 'user', message)

  const history = await getMessages(session.id)
  const messages = toOpenAIHistory(
    trimMessages(history.map((m) => ({ role: m.role, content: m.content }))),
  )

  const lastMsg = messages[messages.length - 1]
  if (file && fileMime && lastMsg?.role === 'user' && typeof lastMsg.content === 'string') {
    lastMsg.content += `\n\n[File attached: ${fileMime}]`
    session.agentState = {
      ...session.agentState,
      parseStatus: 'attached',
      parseError: undefined,
      attachedFile: {
        mimeType: fileMime,
        receivedAt: new Date().toISOString(),
      },
    }
    await updateSession(session.id, { agentState: session.agentState })
    logInfo('agent.file.attached', {
      sessionId: session.id,
      appUserId,
      phase: session.phase,
      stateVersion: session.stateVersion,
      fileMime,
      success: true,
    })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (chunk: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`))
      }

      try {
        let continueLoop = true
        let toolIterations = 0

        while (continueLoop) {
          toolIterations++

          if (toolIterations > AGENT_CONFIG.maxToolIterations) {
            logError('agent.tool_loop.exceeded', {
              sessionId: session!.id,
              appUserId,
              phase: session!.phase,
              stateVersion: session!.stateVersion,
              toolIterations,
              maxToolIterations: AGENT_CONFIG.maxToolIterations,
              success: false,
            })
            break
          }

          const response = await callOpenAIWithRetry({
            model: MODEL_CONFIG.agent,
            max_tokens: AGENT_CONFIG.maxTokens,
            messages: [
              { role: 'system', content: buildSystemPrompt(session!) },
              ...messages,
            ],
            tools: TOOL_DEFINITIONS,
          }, 3, {
            sessionId: session!.id,
            appUserId,
            phase: session!.phase,
            stateVersion: session!.stateVersion,
          })

          const usage = getChatCompletionUsage(response)
          trackApiUsage({
            userId: appUserId,
            sessionId: session!.id,
            model: MODEL_CONFIG.agent,
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
            endpoint: 'agent',
          }).catch(() => {})

          const responseMessage = response.choices[0]?.message
          const finishReason = response.choices[0]?.finish_reason
          const assistantText = responseMessage?.content ?? ''

          if (assistantText) {
            for (const word of assistantText.split(' ')) {
              send({ delta: word + ' ' })
            }
            await appendMessage(session!.id, 'assistant', assistantText)
          }

          const toolCalls = responseMessage?.tool_calls ?? []
          continueLoop = finishReason === 'tool_calls' && toolCalls.length > 0

          if (!continueLoop) {
            break
          }

          messages.push(buildAssistantToolCallMessage(responseMessage!))

          for (const toolCall of toolCalls) {
            if (toolCall.type !== 'function') {
              continue
            }

            const toolInput = JSON.parse(toolCall.function.arguments)
            const toolResult = await dispatchTool(
              toolCall.function.name,
              toolInput as Record<string, unknown>,
              session!,
            )

            messages.push(buildToolMessage(toolCall.id, toolResult))
          }
        }

        send({
          done: true,
          sessionId: session!.id,
          phase: session!.phase,
          atsScore: session!.atsScore,
          messageCount: session!.messageCount + 1,
          maxMessages: AGENT_CONFIG.maxMessagesPerSession,
          isNewSession,
        })
        logInfo('agent.request.completed', {
          sessionId: session!.id,
          appUserId,
          phase: session!.phase,
          stateVersion: session!.stateVersion,
          isNewSession,
          messageCount: session!.messageCount + 1,
          toolIterations,
          parseConfidenceScore: session!.agentState.parseConfidenceScore,
          success: true,
          latencyMs: Date.now() - requestStartedAt,
        })
      } catch (err) {
        logError('agent.request.failed', {
          sessionId: session?.id,
          appUserId,
          phase: session?.phase,
          stateVersion: session?.stateVersion,
          parseConfidenceScore: session?.agentState.parseConfidenceScore,
          success: false,
          latencyMs: Date.now() - requestStartedAt,
          ...serializeError(err),
        })

        let errorMessage = 'Algo deu errado. Por favor, tente novamente.'

        if (err instanceof APIError && err.status) {
          const statusMessages: Record<number, string> = {
            400: 'Erro na requisicao. Por favor, tente novamente.',
            401: 'Erro de configuracao da IA. Entre em contato com o suporte.',
            403: 'Acesso negado ao servico de IA. Entre em contato com o suporte.',
            429: 'O servico de IA esta sobrecarregado. Tente novamente em alguns segundos.',
            500: 'O servico de IA esta temporariamente indisponivel. Tente novamente.',
            502: 'O servico de IA esta temporariamente indisponivel. Tente novamente.',
            503: 'O servico de IA esta em manutencao. Tente novamente em alguns minutos.',
          }
          errorMessage = statusMessages[err.status] ?? errorMessage
        } else if (err instanceof Error && err.name === 'AbortError') {
          errorMessage = 'A requisicao demorou muito. Por favor, tente novamente.'
        }

        send({ error: errorMessage })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
