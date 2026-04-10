import { NextRequest } from 'next/server'
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
import { TOOL_ERROR_CODES, type ToolErrorCode } from '@/lib/agent/tool-errors'
import { deriveTargetFitAssessment } from '@/lib/agent/target-fit'
import { agentLimiter } from '@/lib/rate-limit'
import { AGENT_CONFIG } from '@/lib/agent/config'
import { extractUrl } from '@/lib/agent/url-extractor'
import { scrapeJobPosting } from '@/lib/agent/scraper'
import { logInfo, logWarn } from '@/lib/observability/structured-log'
import { getAgentReleaseMetadata, type AgentReleaseMetadata } from '@/lib/runtime/release-metadata'
import type { AgentSessionCreatedChunk, Session } from '@/types/agent'

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

function applyAgentReleaseHeaders(response: Response, metadata: AgentReleaseMetadata): Response {
  response.headers.set('X-Agent-Release', metadata.releaseId)
  response.headers.set('X-Agent-Release-Source', metadata.releaseSource)
  response.headers.set('X-Agent-Resolved-Agent-Model', metadata.resolvedAgentModel)
  response.headers.set('X-Agent-Resolved-Dialog-Model', metadata.resolvedDialogModel)

  if (metadata.commitShortSha) {
    response.headers.set('X-Agent-Commit-Short-Sha', metadata.commitShortSha)
  }

  return response
}

function createAgentJsonResponse(
  body: unknown,
  init: ResponseInit,
  metadata: AgentReleaseMetadata,
): Response {
  const headers = new Headers(init.headers)

  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  return applyAgentReleaseHeaders(
    new Response(JSON.stringify(body), {
      ...init,
      headers,
    }),
    metadata,
  )
}

function buildSessionLimitReachedError(maxMessages: number): string {
  return `Esta sessão atingiu o limite de ${maxMessages} mensagens. Inicie uma nova análise para continuar.`
}

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

function shouldAdvanceDetectedTargetToAnalysis(
  session: Pick<Session, 'phase' | 'cvState' | 'agentState'>,
  detection: TargetJobDetection | undefined,
): boolean {
  return Boolean(
    detection
    && session.phase === 'intake'
    && hasResumeContextForAutoGap(session)
  )
}

function buildDetectedTargetJobAgentState(
  session: Pick<Session, 'agentState'>,
  detection: TargetJobDetection,
): Session['agentState'] {
  return {
    ...session.agentState,
    targetJobDescription: detection.targetJobDescription,
    gapAnalysis: undefined,
    targetFitAssessment: undefined,
  }
}

async function persistTargetJobAgentState(
  session: Pick<Session, 'id' | 'phase' | 'stateVersion'> & { agentState: Session['agentState']; updatedAt: Date },
  agentState: Session['agentState'],
  appUserId: string,
  requestId: string,
): Promise<void> {
  session.agentState = agentState
  session.updatedAt = new Date()

  try {
    await updateSession(session.id, {
      agentState,
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

async function persistDetectedTargetJobDescriptionBase(
  session: Pick<Session, 'id' | 'phase' | 'stateVersion' | 'agentState' | 'updatedAt' | 'cvState' | 'userId'>,
  message: string,
  appUserId: string,
  requestId: string,
): Promise<TargetJobDetection | undefined> {
  const detection = detectTargetJobDescription(message)
  if (!detection) {
    return undefined
  }

  const shouldAdvanceToAnalysis = shouldAdvanceDetectedTargetToAnalysis(session, detection)
  const sameTargetJob = session.agentState.targetJobDescription?.trim() === detection.targetJobDescription

  if (sameTargetJob && !shouldAdvanceToAnalysis) {
    return detection
  }

  const nextAgentState = sameTargetJob
    ? session.agentState
    : buildDetectedTargetJobAgentState(session, detection)

  if (shouldAdvanceToAnalysis) {
    session.phase = 'analysis'
  }
  session.agentState = nextAgentState
  session.updatedAt = new Date()

  try {
    await updateSession(session.id, {
      agentState: nextAgentState,
      phase: shouldAdvanceToAnalysis ? 'analysis' : undefined,
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

  return detection
}

/**
 * Retry wrapper for gap analysis with exponential backoff.
 * Retries up to 3 times with delays: 1s, 2s, 4s
 */
async function analyzeGapWithRetry(
  cvState: Parameters<typeof analyzeGap>[0],
  targetJobDescription: Parameters<typeof analyzeGap>[1],
  userId: Parameters<typeof analyzeGap>[2],
  sessionId: Parameters<typeof analyzeGap>[3],
  maxAttempts = 3,
): ReturnType<typeof analyzeGap> {
  let lastError: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await analyzeGap(cvState, targetJobDescription, userId, sessionId)

      // Check if result indicates success
      if ('success' in result.output && result.output.success && result.result) {
        return result
      }

      // Failed result but no exception - will retry unless it's last attempt
      if (attempt === maxAttempts) {
        return result
      }

      // Wait before retry
      const delayMs = Math.pow(2, attempt - 1) * 1000 // 1s, 2s, 4s
      await new Promise(resolve => setTimeout(resolve, delayMs))
    } catch (error) {
      lastError = error

      if (attempt === maxAttempts) {
        throw error
      }

      // Wait before retry
      const delayMs = Math.pow(2, attempt - 1) * 1000 // 1s, 2s, 4s
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }

  throw lastError || new Error('Gap analysis failed after all retries')
}

async function maybeAutoGenerateGapAnalysisForDetectedTarget(
  session: Pick<Session, 'id' | 'phase' | 'stateVersion' | 'agentState' | 'updatedAt' | 'cvState' | 'userId'>,
  detection: TargetJobDetection | undefined,
  appUserId: string,
  requestId: string,
): Promise<void> {
  if (!detection || detection.confidence !== 'high' || !hasResumeContextForAutoGap(session)) {
    return
  }

  if (
    session.agentState.targetJobDescription?.trim() === detection.targetJobDescription
    && session.agentState.gapAnalysis
  ) {
    return
  }

  const analyzedAt = new Date().toISOString()
  const gapAnalysisResult = await analyzeGapWithRetry(
    session.cvState,
    detection.targetJobDescription,
    session.userId,
    session.id,
  )

  if (!('success' in gapAnalysisResult.output) || !gapAnalysisResult.output.success || !gapAnalysisResult.result) {
    logWarn('agent.target_job_detection.auto_gap_failed', {
      requestId,
      sessionId: session.id,
      appUserId,
      phase: session.phase,
      stateVersion: session.stateVersion,
      success: false,
    })
    return
  }

  const nextAgentState: Session['agentState'] = {
    ...buildDetectedTargetJobAgentState(session, detection),
    gapAnalysis: {
      result: gapAnalysisResult.result,
      analyzedAt,
    },
    targetFitAssessment: deriveTargetFitAssessment(gapAnalysisResult.result, analyzedAt),
  }

  await persistTargetJobAgentState(session, nextAgentState, appUserId, requestId)
}

function scheduleAutoGenerateGapAnalysisForDetectedTarget(
  session: Pick<Session, 'id' | 'phase' | 'stateVersion' | 'agentState' | 'updatedAt' | 'cvState' | 'userId'>,
  detection: TargetJobDetection | undefined,
  appUserId: string,
  requestId: string,
): void {
  void maybeAutoGenerateGapAnalysisForDetectedTarget(session, detection, appUserId, requestId).catch((error) => {
    logWarn('agent.target_job_detection.auto_gap_background_failed', {
      requestId,
      sessionId: session.id,
      appUserId,
      phase: session.phase,
      stateVersion: session.stateVersion,
      success: false,
      errorMessage: error instanceof Error ? error.message : String(error),
    })
  })
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
  const releaseMetadata = getAgentReleaseMetadata()

  // ── Auth ────────────────────────────────────────────────────────────
  const appUser = await getCurrentAppUser(req)
  if (!appUser) {
    logWarn('agent.request.unauthorized', {
      ...releaseMetadata,
      requestId,
      requestHost: req.headers.get('host') ?? undefined,
      requestOrigin: req.headers.get('origin') ?? undefined,
      requestReferer: req.headers.get('referer') ?? undefined,
      success: false,
      latencyMs: Date.now() - requestStartedAt,
    })
    return createAgentJsonResponse({ error: 'Unauthorized' }, { status: 401 }, releaseMetadata)
  }
  const appUserId = appUser.id

  // ── Rate limit ──────────────────────────────────────────────────────
  const { success } = await agentLimiter.limit(appUserId)
  if (!success) {
    logWarn('agent.request.rate_limited', {
      ...releaseMetadata,
      requestId,
      appUserId,
      success: false,
      latencyMs: Date.now() - requestStartedAt,
    })
    const response = createAgentJsonResponse(
      { error: 'Too many requests. Please wait a moment.' },
      { status: 429 },
      releaseMetadata,
    )
    response.headers.set('Retry-After', '60')
    return response
  }

  // ── Body validation ─────────────────────────────────────────────────
  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    logWarn('agent.request.invalid_json', {
      ...releaseMetadata,
      requestId,
      appUserId,
      success: false,
      latencyMs: Date.now() - requestStartedAt,
    })
    return createAgentJsonResponse({ error: 'Invalid JSON body.' }, { status: 400 }, releaseMetadata)
  }

  const raw = BodySchema.safeParse(rawBody)
  if (!raw.success) {
    logWarn('agent.request.invalid_body', {
      ...releaseMetadata,
      requestId,
      appUserId,
      success: false,
      latencyMs: Date.now() - requestStartedAt,
    })
    return createAgentJsonResponse({ error: raw.error.flatten() }, { status: 400 }, releaseMetadata)
  }
  const { sessionId, file, fileMime } = raw.data

  // ── Prepare message (scrape URLs, sanitize) ─────────────────────────
  let message = await prepareUserMessage(raw.data.message, appUserId, requestId)

  logInfo('agent.request.received', {
    ...releaseMetadata,
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
      ...releaseMetadata,
      requestId,
      appUserId,
      requestedSessionId: sessionId,
      success: false,
      latencyMs: Date.now() - requestStartedAt,
    })
    return createAgentJsonResponse(
      {
        error: 'Sessão não encontrada. Inicie uma nova análise.',
        action: 'new_session',
      },
      { status: 404 },
      releaseMetadata,
    )
  }

  if (session) {
    logInfo('agent.session.loaded', {
      ...releaseMetadata,
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
        ...releaseMetadata,
        requestId,
        sessionId: session.id,
        appUserId,
        phase: session.phase,
        stateVersion: session.stateVersion,
        messageCount: session.messageCount,
        maxMessages: AGENT_CONFIG.maxMessagesPerSession,
        success: false,
      })
      const response = createAgentJsonResponse(
        {
          error: buildSessionLimitReachedError(AGENT_CONFIG.maxMessagesPerSession),
          action: 'new_session',
          messageCount: session.messageCount,
          maxMessages: AGENT_CONFIG.maxMessagesPerSession,
        },
        { status: 429 },
        releaseMetadata,
      )
      response.headers.set('Retry-After', '0')
      return response
    }
  } else {
    // Atomic: verify credit availability + consume credit + create session in single RPC.
    // If RPC returns null, credits were insufficient.
    const newSession = await createSessionWithCredit(appUserId)
    if (!newSession) {
      logWarn('agent.session.create_blocked_no_credit', {
        ...releaseMetadata,
        requestId,
        appUserId,
        success: false,
        latencyMs: Date.now() - requestStartedAt,
      })
      return createAgentJsonResponse(
        {
          error: 'Seus créditos acabaram. Faça upgrade do seu plano para continuar.',
          upgradeUrl: '/pricing',
        },
        { status: 402 },
        releaseMetadata,
      )
    }

    session = newSession
    isNewSession = true
    logInfo('agent.session.created', {
      ...releaseMetadata,
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
  // For new sessions, we still persist a detected target job immediately,
  // but defer any expensive auto-gap analysis until after sessionCreated.
  const detectedTargetJob = await persistDetectedTargetJobDescriptionBase(
    session!,
    message,
    appUserId,
    requestId,
  )

  if (!isNewSession) {
    try {
      if (file && fileMime) {
        message = await handleFileAttachment(message, file, fileMime, session!, appUserId, requestId, req.signal)
      }

      const messageCountIncremented = await incrementMessageCount(session!.id)
      if (!messageCountIncremented) {
        logWarn('agent.session.message_cap_reached', {
          ...releaseMetadata,
          requestId,
          sessionId: session!.id,
          appUserId,
          phase: session!.phase,
          stateVersion: session!.stateVersion,
          messageCount: AGENT_CONFIG.maxMessagesPerSession,
          maxMessages: AGENT_CONFIG.maxMessagesPerSession,
          success: false,
        })
        const response = createAgentJsonResponse(
          {
            error: buildSessionLimitReachedError(AGENT_CONFIG.maxMessagesPerSession),
            action: 'new_session',
            messageCount: AGENT_CONFIG.maxMessagesPerSession,
            maxMessages: AGENT_CONFIG.maxMessagesPerSession,
          },
          { status: 429 },
          releaseMetadata,
        )
        response.headers.set('Retry-After', '0')
        return response
      }

    } catch (err) {
      const isAbort = (err instanceof Error || err instanceof DOMException) && err.name === 'AbortError'
      const errorMessage = isAbort
        ? 'A requisição demorou muito. Por favor, tente novamente.'
        : 'Algo deu errado. Por favor, tente novamente.'
      return createAgentJsonResponse({ error: errorMessage }, { status: 500 }, releaseMetadata)
    }
  }

  // ── SSE stream ──────────────────────────────────────────────────────
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (chunk: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`))
      }

      function sendStreamError(
        errorMessage: string,
        code: ToolErrorCode,
        heartbeatInterval?: ReturnType<typeof setInterval>,
      ) {
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval)
        }
        send({ type: 'error', error: errorMessage, code, requestId })
        controller.close()
      }

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'))
        } catch {
          clearInterval(heartbeat)
        }
      }, 15_000)

      // For new sessions, emit sessionCreated immediately so the frontend
      // can persist the sessionId (URL + state) before any slow work runs.
      if (isNewSession) {
        const sessionCreatedChunk: AgentSessionCreatedChunk = {
          type: 'sessionCreated',
          sessionId: session!.id,
        }
        send(sessionCreatedChunk)

        try {
          // For brand-new sessions with attachments, avoid consuming the first
          // message count until attachment preprocessing has succeeded.
          if (file && fileMime) {
            message = await handleFileAttachment(message, file, fileMime, session!, appUserId, requestId, req.signal)
          }

          const messageCountIncremented = await incrementMessageCount(session!.id)
          if (!messageCountIncremented) {
            sendStreamError(
              'Erro interno ao registrar mensagem. Tente novamente.',
              TOOL_ERROR_CODES.INTERNAL_ERROR,
              heartbeat,
            )
            return
          }

        } catch (err) {
          const isAbort = (err instanceof Error || err instanceof DOMException) && err.name === 'AbortError'
          const errorMessage = isAbort
            ? 'A requisição demorou muito. Por favor, tente novamente.'
            : 'Algo deu errado. Por favor, tente novamente.'
          sendStreamError(
            errorMessage,
            TOOL_ERROR_CODES.INTERNAL_ERROR,
            heartbeat,
          )
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

      try {
        for await (const event of loop) {
          send(event)
        }
      } finally {
        clearInterval(heartbeat)
        controller.close()
      }
    },
  })

  const headers: Record<string, string> = {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  }

  if (isNewSession && session) {
    headers['X-Session-Id'] = session.id
  }

  return applyAgentReleaseHeaders(new Response(stream, { headers }), releaseMetadata)
}
