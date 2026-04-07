import { NextRequest } from 'next/server'
import { APIError } from 'openai'
import { z } from 'zod'

import { runAgentLoop } from '@/lib/agent/agent-loop'
import { getCurrentAppUser } from '@/lib/auth/app-user'
import {
  getSession,
  createSessionWithCredit,
  incrementMessageCount,
  updateSession,
} from '@/lib/db/sessions'
import { dispatchTool } from '@/lib/agent/tools'
import { analyzeGap } from '@/lib/agent/tools/gap-analysis'
import { deriveTargetFitAssessment } from '@/lib/agent/target-fit'
import { agentLimiter } from '@/lib/rate-limit'
import { AGENT_CONFIG } from '@/lib/agent/config'
import { extractUrl } from '@/lib/agent/url-extractor'
import { scrapeJobPosting } from '@/lib/agent/scraper'
import { logInfo, logWarn } from '@/lib/observability/structured-log'
import type { Session } from '@/types/agent'

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

function normalizeForJobDescriptionDetection(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

type TargetJobDetection = {
  targetJobDescription: string
  confidence: 'medium' | 'high'
}

function detectTargetJobDescription(message: string): TargetJobDetection | undefined {
  const trimmed = message.trim()
  if (trimmed.length < 140) {
    return undefined
  }

  if (trimmed.includes('[Link da vaga:') || trimmed.includes('[Conteúdo extraído automaticamente]')) {
    return {
      targetJobDescription: trimmed,
      confidence: 'high',
    }
  }

  const normalized = normalizeForJobDescriptionDetection(trimmed)
  const sectionSignals = [
    'responsabilidades',
    'responsibility',
    'responsibilities',
    'requisitos',
    'requirements',
    'qualificacoes',
    'qualifications',
    'diferenciais',
    'nice to have',
    'o que procuramos',
    'we are looking for',
    'sobre a vaga',
    'about the role',
    'atribuicoes',
    'atividades',
    'job description',
  ]
  const sectionHits = sectionSignals.filter((signal) => normalized.includes(signal)).length
  const roleHit = /\b(analista|engenheiro|developer|desenvolvedor|cientista|gerente|coordenador|consultor|product|designer|arquiteto|devops|sre|qa|bi|dados|data)\b/.test(normalized)
  const hiringIntentHit = /\b(vaga|cargo|posicao|position|role|opportunity|buscamos|contratando)\b/.test(normalized)
  const lines = trimmed.split(/\n+/).map((line) => line.trim()).filter(Boolean)
  const hasStructuredLayout = lines.length >= 5 || /(^|\n)\s*[-*•]/.test(trimmed) || trimmed.includes(':')
  let score = 0

  score += Math.min(sectionHits, 4) * 2
  if (roleHit) score += 2
  if (hiringIntentHit) score += 2
  if (hasStructuredLayout) score += 2
  if (trimmed.length >= 260) score += 1

  if (sectionHits >= 2 && hasStructuredLayout) {
    return {
      targetJobDescription: trimmed,
      confidence: sectionHits >= 3 ? 'high' : 'medium',
    }
  }

  if (sectionHits >= 3) {
    return {
      targetJobDescription: trimmed,
      confidence: 'high',
    }
  }

  if (hiringIntentHit && roleHit && trimmed.length >= 220 && hasStructuredLayout) {
    return {
      targetJobDescription: trimmed,
      confidence: score >= 7 ? 'high' : 'medium',
    }
  }

  if (score >= 8) {
    return {
      targetJobDescription: trimmed,
      confidence: 'medium',
    }
  }

  return undefined
}

function hasResumeContextForAutoGap(session: Pick<Session, 'cvState' | 'agentState'>): boolean {
  return Boolean(
    session.agentState.sourceResumeText?.trim()
    || session.cvState.summary.trim()
    || session.cvState.skills.length > 0
    || session.cvState.experience.length > 0
    || session.cvState.education.length > 0
    || (session.cvState.certifications?.length ?? 0) > 0
  )
}

async function persistDetectedTargetJobDescription(
  session: Pick<Session, 'id' | 'phase' | 'stateVersion' | 'agentState' | 'updatedAt' | 'cvState' | 'userId'>,
  message: string,
  appUserId: string,
  requestId: string,
): Promise<void> {
  const detection = detectTargetJobDescription(message)
  if (!detection) {
    return
  }

  if (session.agentState.targetJobDescription?.trim() === detection.targetJobDescription) {
    return
  }

  const nextAgentState: Session['agentState'] = {
    ...session.agentState,
    targetJobDescription: detection.targetJobDescription,
    gapAnalysis: undefined,
    targetFitAssessment: undefined,
  }

  if (detection.confidence === 'high' && hasResumeContextForAutoGap(session)) {
    const analyzedAt = new Date().toISOString()
    const gapAnalysisResult = await analyzeGap(
      session.cvState,
      detection.targetJobDescription,
      session.userId,
      session.id,
    )

    if ('success' in gapAnalysisResult.output && gapAnalysisResult.output.success && gapAnalysisResult.result) {
      nextAgentState.gapAnalysis = {
        result: gapAnalysisResult.result,
        analyzedAt,
      }
      nextAgentState.targetFitAssessment = deriveTargetFitAssessment(gapAnalysisResult.result, analyzedAt)
    } else {
      logWarn('agent.target_job_detection.auto_gap_failed', {
        requestId,
        sessionId: session.id,
        appUserId,
        phase: session.phase,
        stateVersion: session.stateVersion,
        success: false,
      })
    }
  }

  session.agentState = nextAgentState
  session.updatedAt = new Date()

  try {
    await updateSession(session.id, {
      agentState: nextAgentState,
    })
  } catch (error) {
    logWarn('agent.target_job_detection.persist_failed', {
      requestId,
      sessionId: session.id,
      appUserId,
      phase: session.phase,
      stateVersion: session.stateVersion,
      success: false,
      errorMessage: error instanceof Error ? error.message : String(error),
    })
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
    const response = new Response(JSON.stringify({ error: 'Too many requests. Please wait a moment.' }), { status: 429 })
    response.headers.set('Retry-After', '60')
    return response
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
      const response = new Response(JSON.stringify({
        error: 'Esta sessão atingiu o limite de 15 mensagens. Inicie uma nova análise para continuar.',
        action: 'new_session',
        messageCount: session.messageCount,
        maxMessages: AGENT_CONFIG.maxMessagesPerSession,
      }), { status: 429 })
      response.headers.set('Retry-After', '0')
      return response
    }
  } else {
    // Atomic: verify credit availability + consume credit + create session in single RPC.
    // If RPC returns null, credits were insufficient.
    const newSession = await createSessionWithCredit(appUserId)
    if (!newSession) {
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
    await persistDetectedTargetJobDescription(session!, message, appUserId, requestId)
  }

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
        const response = new Response(JSON.stringify({
          error: 'Esta sessão atingiu o limite de 15 mensagens. Inicie uma nova análise para continuar.',
          action: 'new_session',
          messageCount: AGENT_CONFIG.maxMessagesPerSession,
          maxMessages: AGENT_CONFIG.maxMessagesPerSession,
        }), { status: 429 })
        response.headers.set('Retry-After', '0')
        return response
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

          // After sessionId is safe, detect target job and run gap analysis
          // (this may be expensive, but sessionId is already persisted)
          await persistDetectedTargetJobDescription(session!, message, appUserId, requestId)
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
