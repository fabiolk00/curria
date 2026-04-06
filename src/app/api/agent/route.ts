import { NextRequest } from 'next/server'
import { APIError } from 'openai'
import { z } from 'zod'

import { runAgentLoop } from '@/lib/agent/agent-loop'
import { getCurrentAppUser } from '@/lib/auth/app-user'
import {
  getSession,
  createSessionWithCredit,
  checkUserQuota,
  incrementMessageCount,
} from '@/lib/db/sessions'
import { dispatchTool } from '@/lib/agent/tools'
import { agentLimiter } from '@/lib/rate-limit'
import { AGENT_CONFIG } from '@/lib/agent/config'
import { extractUrl } from '@/lib/agent/url-extractor'
import { scrapeJobPosting } from '@/lib/agent/scraper'
import { logError, logInfo, logWarn } from '@/lib/observability/structured-log'

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const BodySchema = z.object({
  sessionId: z.string().optional(),
  message: z.string().max(8000).default(''),
  file: z.string().optional(),
  fileMime: z.enum([
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/png',
    'image/jpeg',
  ]).optional(),
}).superRefine((value, ctx) => {
  if (!value.message.trim() && !value.file) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Message or file is required.',
      path: ['message'],
    })
  }

  if (value.file && !value.fileMime) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'fileMime is required when file is provided.',
      path: ['fileMime'],
    })
  }

  if (value.fileMime && !value.file) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'file is required when fileMime is provided.',
      path: ['file'],
    })
  }
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sanitizeUserInput(input: string): string {
  return input
    .replace(/<\/?user_resume_data>/gi, '')
    .replace(/<\/?user_resume_text>/gi, '')
    .replace(/<\/?target_job_description>/gi, '')
    .replace(/<\/?system>/gi, '')
    .replace(/<\/?instructions>/gi, '')
    .replace(/<\/?assistant>/gi, '')
    .replace(/<\/?tool_call>/gi, '')
    .replace(/<\/?function>/gi, '')
    .trim()
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

/**
 * Prepares the user message by scraping job URLs and sanitizing content.
 */
async function prepareUserMessage(
  rawMessage: string,
  appUserId: string,
  requestId: string,
): Promise<string> {
  let message = sanitizeUserInput(rawMessage)

  const detectedUrl = extractUrl(message)
  if (!detectedUrl) return message

  const scrapeResult = await scrapeJobPosting(detectedUrl)
  const detectedUrlHost = (() => {
    try {
      return new URL(detectedUrl).hostname
    } catch {
      return 'invalid-url'
    }
  })()

  if (scrapeResult.success && scrapeResult.text) {
    const sanitizedScrapedText = sanitizeUserInput(scrapeResult.text)
    message = message.replace(
      detectedUrl,
      `[Link da vaga: ${detectedUrl}]\n\n[Conteúdo extraído automaticamente]:\n${sanitizedScrapedText}`,
    )
    logInfo('agent.scrape.completed', {
      requestId,
      appUserId,
      detectedUrlHost,
      scrapeSucceeded: true,
      scrapedTextLength: scrapeResult.text.length,
      success: true,
    })
  } else {
    logWarn('agent.scrape.completed', {
      requestId,
      appUserId,
      detectedUrlHost,
      scrapeSucceeded: false,
      success: false,
    })
    message = `${message}\n\n[Nota do sistema: Tentei acessar o link ${detectedUrl} mas não consegui extrair o conteúdo. Motivo: ${scrapeResult.error}]`
  }

  return message
}

/**
 * Handles file attachment by dispatching parse_file and returning
 * an augmented user message.
 */
async function handleFileAttachment(
  message: string,
  file: string,
  fileMime: string,
  session: { id: string; phase: string; stateVersion: number },
  appUserId: string,
  requestId: string,
  externalSignal?: AbortSignal,
): Promise<string> {
  const parseResult = parseJsonObject(
    await dispatchTool(
      'parse_file',
      { file_base64: file, mime_type: fileMime },
      session as Parameters<typeof dispatchTool>[2],
      externalSignal,
    ),
  )

  const parseError = typeof parseResult?.error === 'string' ? parseResult.error : undefined

  if (parseError) {
    logWarn('agent.file.parse_failed', {
      requestId,
      sessionId: session.id,
      appUserId,
      phase: session.phase,
      stateVersion: session.stateVersion,
      fileMime,
      success: false,
      errorMessage: parseError,
    })
    return [message, `[Nota do sistema: Não foi possível processar o arquivo anexado. ${parseError}]`]
      .filter(Boolean)
      .join('\n\n')
  }

  logInfo('agent.file.parsed', {
    requestId,
    sessionId: session.id,
    appUserId,
    phase: session.phase,
    stateVersion: session.stateVersion,
    fileMime,
    success: true,
  })

  const base = message.trim()
    ? message
    : 'Analise o currículo anexado e me diga os próximos passos.'

  return [
    base,
    '[Nota do sistema: O currículo anexado já foi processado e o texto extraído está disponível para análise.]',
  ].join('\n\n')
}

// ---------------------------------------------------------------------------
// Route handler — thin HTTP/SSE adapter
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const requestStartedAt = Date.now()
  const requestId = crypto.randomUUID()

  // ── Auth ────────────────────────────────────────────────────────────
  const appUser = await getCurrentAppUser()
  if (!appUser) {
    logWarn('agent.request.unauthorized', {
      requestId,
      success: false,
      latencyMs: Date.now() - requestStartedAt,
    })
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }
  const appUserId = appUser.id

  // ── Rate limit ──────────────────────────────────────────────────────
  const { success } = await agentLimiter.limit(appUserId)
  if (!success) {
    logWarn('agent.request.rate_limited', {
      requestId,
      appUserId,
      success: false,
      latencyMs: Date.now() - requestStartedAt,
    })
    return new Response(JSON.stringify({ error: 'Too many requests. Please wait a moment.' }), { status: 429 })
  }

  // ── Body validation ─────────────────────────────────────────────────
  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    logWarn('agent.request.invalid_json', {
      requestId,
      appUserId,
      success: false,
      latencyMs: Date.now() - requestStartedAt,
    })
    return new Response(JSON.stringify({ error: 'Invalid JSON body.' }), { status: 400 })
  }

  const raw = BodySchema.safeParse(rawBody)
  if (!raw.success) {
    logWarn('agent.request.invalid_body', {
      requestId,
      appUserId,
      success: false,
      latencyMs: Date.now() - requestStartedAt,
    })
    return new Response(JSON.stringify({ error: raw.error.flatten() }), { status: 400 })
  }
  const { sessionId, file, fileMime } = raw.data

  // ── Prepare message (scrape URLs, sanitize) ─────────────────────────
  let message = await prepareUserMessage(raw.data.message, appUserId, requestId)

  logInfo('agent.request.received', {
    requestId,
    appUserId,
    requestedSessionId: sessionId,
    messageLength: message.length,
    hasFile: Boolean(file && fileMime),
    fileMime,
    success: true,
  })

  // ── Session resolution ──────────────────────────────────────────────
  let session = sessionId
    ? await getSession(sessionId, appUserId)
    : null

  let isNewSession = false

  if (sessionId && !session) {
    logWarn('agent.session.not_found', {
      requestId,
      appUserId,
      requestedSessionId: sessionId,
      success: false,
      latencyMs: Date.now() - requestStartedAt,
    })
    return new Response(JSON.stringify({
      error: 'Sessão não encontrada. Inicie uma nova análise.',
      action: 'new_session',
    }), { status: 404 })
  }

  if (session) {
    logInfo('agent.session.loaded', {
      requestId,
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
        requestId,
        sessionId: session.id,
        appUserId,
        phase: session.phase,
        stateVersion: session.stateVersion,
        messageCount: session.messageCount,
        maxMessages: AGENT_CONFIG.maxMessagesPerSession,
        success: false,
      })
      return new Response(JSON.stringify({
        error: 'Esta sessão atingiu o limite de 15 mensagens. Inicie uma nova análise para continuar.',
        action: 'new_session',
        messageCount: session.messageCount,
        maxMessages: AGENT_CONFIG.maxMessagesPerSession,
      }), { status: 429 })
    }
  } else {
    const hasCredits = await checkUserQuota(appUserId)
    if (!hasCredits) {
      logWarn('agent.session.create_blocked_no_credit', {
        requestId,
        appUserId,
        success: false,
        latencyMs: Date.now() - requestStartedAt,
      })
      return new Response(JSON.stringify({
        error: 'Seus créditos acabaram. Faça upgrade do seu plano para continuar.',
        upgradeUrl: '/pricing',
      }), { status: 402 })
    }

    // Atomic: consume credit + create session in a single DB transaction.
    const newSession = await createSessionWithCredit(appUserId)
    if (!newSession) {
      logError('agent.credit.consume_failed', {
        requestId,
        appUserId,
        creditConsumed: 0,
        success: false,
        latencyMs: Date.now() - requestStartedAt,
      })
      return new Response(JSON.stringify({
        error: 'Erro ao processar crédito. Tente novamente.',
      }), { status: 500 })
    }

    session = newSession
    isNewSession = true
    logInfo('agent.session.created', {
      requestId,
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

  // ── Pre-stream work for existing sessions ───────────────────────────
  // For existing sessions, message cap and file attachment run before the
  // stream so failures can return proper HTTP status codes (e.g. 429).
  // For new sessions these run INSIDE the stream, after the early
  // sessionCreated event, so the frontend gets the sessionId as fast as
  // possible and a refresh can never lose it.
  if (!isNewSession) {
    try {
      if (file && fileMime) {
        message = await handleFileAttachment(message, file, fileMime, session!, appUserId, requestId, req.signal)
      }

      const messageCountIncremented = await incrementMessageCount(session!.id)
      if (!messageCountIncremented) {
        logWarn('agent.session.message_cap_reached', {
          requestId,
          sessionId: session!.id,
          appUserId,
          phase: session!.phase,
          stateVersion: session!.stateVersion,
          messageCount: AGENT_CONFIG.maxMessagesPerSession,
          maxMessages: AGENT_CONFIG.maxMessagesPerSession,
          success: false,
        })
        return new Response(JSON.stringify({
          error: 'Esta sessão atingiu o limite de 15 mensagens. Inicie uma nova análise para continuar.',
          action: 'new_session',
          messageCount: AGENT_CONFIG.maxMessagesPerSession,
          maxMessages: AGENT_CONFIG.maxMessagesPerSession,
        }), { status: 429 })
      }
    } catch (err) {
      const isAbort = (err instanceof Error || err instanceof DOMException) && err.name === 'AbortError'
      const errorMessage = isAbort
        ? 'A requisição demorou muito. Por favor, tente novamente.'
        : 'Algo deu errado. Por favor, tente novamente.'
      return new Response(JSON.stringify({ error: errorMessage }), { status: 500 })
    }
  }

  // ── SSE stream ──────────────────────────────────────────────────────
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (chunk: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`))
      }

      function sendStreamError(errorMessage: string) {
        send({ error: errorMessage, requestId })
        controller.close()
      }

      // For new sessions, emit sessionCreated immediately so the frontend
      // can persist the sessionId (URL + state) before any slow work runs.
      if (isNewSession) {
        send({ sessionCreated: true, sessionId: session!.id })

        try {
          // For brand-new sessions with attachments, avoid consuming the first
          // message count until attachment preprocessing has succeeded.
          if (file && fileMime) {
            message = await handleFileAttachment(message, file, fileMime, session!, appUserId, requestId, req.signal)
          }

          const messageCountIncremented = await incrementMessageCount(session!.id)
          if (!messageCountIncremented) {
            sendStreamError('Erro interno ao registrar mensagem. Tente novamente.')
            return
          }
        } catch (err) {
          const isAbort = (err instanceof Error || err instanceof DOMException) && err.name === 'AbortError'
          const errorMessage = isAbort
            ? 'A requisição demorou muito. Por favor, tente novamente.'
            : 'Algo deu errado. Por favor, tente novamente.'
          sendStreamError(errorMessage)
          return
        }
      }

      const loop = runAgentLoop({
        session: session!,
        userMessage: message,
        appUserId,
        requestId,
        isNewSession,
        requestStartedAt,
        signal: req.signal,
      })

      for await (const event of loop) {
        switch (event.type) {
          case 'delta':
            send({ delta: event.text })
            break

          case 'done':
            send({
              done: true,
              requestId: event.requestId,
              sessionId: event.sessionId,
              phase: event.phase,
              atsScore: event.atsScore,
              messageCount: event.messageCount,
              maxMessages: event.maxMessages,
              isNewSession: event.isNewSession,
            })
            break

          case 'error': {
            let errorMessage = 'Algo deu errado. Por favor, tente novamente.'

            if (event.error instanceof APIError && event.error.status) {
              const statusMessages: Record<number, string> = {
                400: 'Erro na requisição. Por favor, tente novamente.',
                401: 'Erro de configuração da IA. Entre em contato com o suporte.',
                403: 'Acesso negado ao serviço de IA. Entre em contato com o suporte.',
                429: 'O serviço de IA está sobrecarregado. Tente novamente em alguns segundos.',
                500: 'O serviço de IA está temporariamente indisponível. Tente novamente.',
                502: 'O serviço de IA está temporariamente indisponível. Tente novamente.',
                503: 'O serviço de IA está em manutenção. Tente novamente em alguns minutos.',
              }
              errorMessage = statusMessages[event.error.status] ?? errorMessage
            } else if (event.error.name === 'AbortError') {
              errorMessage = 'A requisição demorou muito. Por favor, tente novamente.'
            }

            send({ error: errorMessage, requestId })
            break
          }
        }
      }

      controller.close()
    },
  })

  const headers: Record<string, string> = {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  }

  if (isNewSession && session) {
    headers['X-Session-Id'] = session.id
  }

  return new Response(stream, { headers })
}
