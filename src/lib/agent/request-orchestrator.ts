import { NextRequest } from 'next/server'
import { z } from 'zod'

import { runAgentLoop, type AgentLoopParams } from '@/lib/agent/agent-loop'
import { dispatchAsyncAction } from '@/lib/agent/async-dispatch'
import { classifyAgentAction } from '@/lib/agent/action-classification'
import {
  buildDoneChunk,
  persistAsyncAcknowledgement,
} from '@/lib/agent/agent-persistence'
import { prepareUserMessage } from '@/lib/agent/message-preparation'
import {
  hasResumeContextForAutoGap,
  runPreLoopSetup,
  shouldEmitExistingSessionPreparationProgress,
} from '@/lib/agent/pre-loop-setup'
import { TOOL_ERROR_CODES, type ToolErrorCode } from '@/lib/agent/tool-errors'
import { analyzeGap } from '@/lib/agent/tools/gap-analysis'
import { deriveTargetFitAssessment } from '@/lib/agent/target-fit'
import { evaluateCareerFitRisk } from '@/lib/agent/profile-review'
import { getCurrentAppUser } from '@/lib/auth/app-user'
import { getAiChatAccess } from '@/lib/billing/ai-chat-access.server'
import {
  createSession,
  getSession,
  updateSession,
} from '@/lib/db/sessions'
import { AGENT_CONFIG } from '@/lib/agent/config'
import { flushRequestQueryTracking } from '@/lib/observability/request-query-tracking'
import { createRequestTimingTracker } from '@/lib/observability/request-timing'
import { logInfo, logWarn } from '@/lib/observability/structured-log'
import { agentLimiter } from '@/lib/rate-limit'
import { getAgentReleaseMetadata, type AgentReleaseMetadata } from '@/lib/runtime/release-metadata'
import { detectTargetJobDescription, type TargetJobDetection } from '@/lib/agent/vacancy-analysis'
import type { AgentSessionCreatedChunk, Session } from '@/types/agent'
import type { JobType } from '@/types/jobs'

const BodySchema = z.object({
  sessionId: z.string().optional(),
  message: z.string().max(8000).default(''),
  file: z.string().optional(),
  fileMime: z.enum([
    'application/pdf',
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
    careerFitEvaluation: undefined,
    targetingPlan: undefined,
    rewriteStatus: 'pending',
    optimizedCvState: undefined,
    highlightState: undefined,
    optimizedAt: undefined,
    optimizationSummary: undefined,
    rewriteValidation: undefined,
    atsWorkflowRun: undefined,
    lastRewriteMode: session.agentState.lastRewriteMode === 'job_targeting'
      ? undefined
      : session.agentState.lastRewriteMode,
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

      if ('success' in result.output && result.output.success && result.result) {
        return result
      }

      if (attempt === maxAttempts) {
        return result
      }

      const delayMs = Math.pow(2, attempt - 1) * 1000
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    } catch (error) {
      lastError = error

      if (attempt === maxAttempts) {
        throw error
      }

      const delayMs = Math.pow(2, attempt - 1) * 1000
      await new Promise((resolve) => setTimeout(resolve, delayMs))
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

  nextAgentState.careerFitEvaluation = evaluateCareerFitRisk({
    cvState: session.cvState,
    agentState: nextAgentState,
  }) ?? undefined

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

export async function handleAgentPost(req: NextRequest): Promise<Response> {
  const requestStartedAt = Date.now()
  const requestId = crypto.randomUUID()
  const releaseMetadata = getAgentReleaseMetadata()
  const timing = createRequestTimingTracker(requestStartedAt)

  const appUser = await timing.runStage('auth', () => getCurrentAppUser(req))
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

  const aiChatAccess = await timing.runStage('chat_access', () => getAiChatAccess(appUserId))
  if (!aiChatAccess.allowed) {
    logWarn('agent.request.chat_access_denied', {
      ...releaseMetadata,
      requestId,
      appUserId,
      aiChatAccessReason: aiChatAccess.reason,
      aiChatAccessCode: aiChatAccess.code,
      plan: aiChatAccess.plan ?? undefined,
      billingStatus: aiChatAccess.status ?? undefined,
      renewsAt: aiChatAccess.renewsAt ?? undefined,
      success: false,
      latencyMs: Date.now() - requestStartedAt,
    })
    return createAgentJsonResponse(
      {
        error: aiChatAccess.message,
        title: aiChatAccess.title,
        code: aiChatAccess.code,
        upgradeUrl: aiChatAccess.upgradeUrl,
      },
      { status: 403 },
      releaseMetadata,
    )
  }

  const { success } = await timing.runStage('rate_limit', () => agentLimiter.limit(appUserId))
  if (!success) {
    logWarn('agent.request.rate_limited', {
      ...releaseMetadata,
      requestId,
      appUserId,
      success: false,
      ...timing.snapshot(),
    })
    const response = createAgentJsonResponse(
      { error: 'Too many requests. Please wait a moment.' },
      { status: 429 },
      releaseMetadata,
    )
    response.headers.set('Retry-After', '60')
    return response
  }

  let rawBody: unknown
  try {
    rawBody = await timing.runStage('body_parse', () => req.json())
  } catch {
    logWarn('agent.request.invalid_json', {
      ...releaseMetadata,
      requestId,
      appUserId,
      success: false,
      ...timing.snapshot(),
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
      ...timing.snapshot(),
    })
    return createAgentJsonResponse({ error: raw.error.flatten() }, { status: 400 }, releaseMetadata)
  }
  const { sessionId, file, fileMime } = raw.data

  let message = await timing.runStage(
    'prepare_message',
    () => prepareUserMessage(raw.data.message, appUserId, requestId),
  )

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

  let session = await timing.runStage('session_resolution', async () => (
    sessionId
      ? getSession(sessionId, appUserId)
      : Promise.resolve(null)
  ))

  let isNewSession = false

  if (sessionId && !session) {
    logWarn('agent.session.not_found', {
      ...releaseMetadata,
      requestId,
      appUserId,
      requestedSessionId: sessionId,
      success: false,
      ...timing.snapshot(),
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
  } else {
    session = await timing.runStage('session_create', () => createSession(appUserId))
    isNewSession = true
    logInfo('agent.session.created', {
      ...releaseMetadata,
      requestId,
      sessionId: session.id,
      appUserId,
      phase: session.phase,
      stateVersion: session.stateVersion,
      isNewSession: true,
      creditConsumed: 0,
      success: true,
      ...timing.snapshot(),
    })
  }

  const detectedTargetJob = await timing.runStage(
    'target_detection',
    () => persistDetectedTargetJobDescriptionBase(
      session!,
      message,
      appUserId,
      requestId,
    ),
  )

  let classification = classifyAgentAction(session!, message)
  const shouldEmitPreparationProgress = !isNewSession
    && classification.executionMode === 'sync'
    && shouldEmitExistingSessionPreparationProgress(session!, message, Boolean(file && fileMime))

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (chunk: unknown) => {
        timing.markFirstSseChunk()
        if (typeof chunk === 'object' && chunk !== null && 'type' in chunk) {
          if (chunk.type === 'sessionCreated') {
            timing.markFirstStatusChunk()
          }

          if (chunk.type === 'text') {
            timing.markFirstAssistantText()
          }
        }
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

        logWarn('agent.request.stream_failed', {
          ...releaseMetadata,
          requestId,
          appUserId,
          sessionId: session?.id,
          phase: session?.phase,
          isNewSession,
          success: false,
          ...timing.snapshot(),
          errorCode: code,
          errorMessage,
        })
        flushRequestQueryTracking()
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

      if (shouldEmitPreparationProgress) {
        send({ type: 'toolStart', toolName: 'preparo da resposta' })
      }

      if (isNewSession) {
        const sessionCreatedChunk: AgentSessionCreatedChunk = {
          type: 'sessionCreated',
          sessionId: session!.id,
        }
        send(sessionCreatedChunk)
      }

      try {
        message = await runPreLoopSetup({
          session: session!,
          message,
          file,
          fileMime,
          appUserId,
          requestId,
          externalSignal: req.signal,
          timing,
          isNewSession,
        })
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

      classification = classifyAgentAction(session!, message)

      if (classification.executionMode === 'async' && classification.actionType !== 'chat') {
        try {
          const dispatchResult = await timing.runStage('async_dispatch', async () => {
            const result = await dispatchAsyncAction({
              session: session!,
              userId: appUserId,
              actionType: classification.actionType as JobType,
              requestMessage: message,
            })
            await persistAsyncAcknowledgement({
              sessionId: session!.id,
              userMessage: message,
              assistantText: result.acknowledgementText,
            })
            return result
          })

          send({
            type: 'text',
            content: dispatchResult.acknowledgementText,
          })

          const doneChunk = buildDoneChunk({
            requestId,
            session: session!,
            isNewSession,
            toolIterations: 0,
            maxMessages: AGENT_CONFIG.maxMessagesPerSession,
          })
          send(doneChunk)
          clearInterval(heartbeat)

          logInfo('agent.request.stream_completed', {
            ...releaseMetadata,
            requestId,
            appUserId,
            sessionId: session?.id,
            phase: session?.phase,
            asyncActionType: classification.actionType,
            isNewSession,
            detectedTargetJobConfidence: detectedTargetJob?.confidence,
            success: true,
            ...timing.snapshot(),
          })
          flushRequestQueryTracking()
          controller.close()
          return
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

      const loopParams: AgentLoopParams = {
        session: session!,
        userMessage: message,
        appUserId,
        requestId,
        isNewSession,
        requestStartedAt,
        signal: req.signal,
      }
      const loop = runAgentLoop(loopParams)

      try {
        for await (const event of loop) {
          send(event)
        }

        logInfo('agent.request.stream_completed', {
          ...releaseMetadata,
          requestId,
          appUserId,
          sessionId: session?.id,
          phase: session?.phase,
          isNewSession,
          detectedTargetJobConfidence: detectedTargetJob?.confidence,
          actionType: classification.actionType,
          success: true,
          ...timing.snapshot(),
        })
        flushRequestQueryTracking()
        controller.close()
      } catch (error) {
        const isAbort = (error instanceof Error || error instanceof DOMException) && error.name === 'AbortError'
        const errorMessage = isAbort
          ? 'A requisicao demorou muito. Por favor, tente novamente.'
          : 'Algo deu errado. Por favor, tente novamente.'
        sendStreamError(
          errorMessage,
          TOOL_ERROR_CODES.INTERNAL_ERROR,
          heartbeat,
        )
      } finally {
        clearInterval(heartbeat)
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
