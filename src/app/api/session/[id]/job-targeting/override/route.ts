import { randomUUID } from 'node:crypto'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { buildOverrideReviewHighlightState } from '@/lib/agent/highlight/override-review-highlights'
import { runJobTargetingPipeline } from '@/lib/agent/job-targeting-pipeline'
import {
  hashOverrideToken,
  tryAcquireOverrideProcessingLock,
} from '@/lib/agent/job-targeting/override-processing-lock'
import {
  buildValidationOverrideMetadata,
  isRecoverableValidationBlock,
} from '@/lib/agent/job-targeting/recoverable-validation'
import { TOOL_ERROR_CODES, getHttpStatusForToolError } from '@/lib/agent/tool-errors'
import { runWithApiUsageBuffer } from '@/lib/agent/usage-tracker'
import { getCurrentAppUser } from '@/lib/auth/app-user'
import { createCvVersion } from '@/lib/db/cv-versions'
import { getSession, updateSession } from '@/lib/db/sessions'
import {
  logError,
  logInfo,
  logWarn,
  serializeError,
} from '@/lib/observability/structured-log'
import { getRequestQueryContext } from '@/lib/observability/request-query-context'
import { summarizePatternStats } from '@/lib/observability/query-fingerprint'
import { withRequestQueryTracking } from '@/lib/observability/request-query-tracking'
import { generateBillableResume } from '@/lib/resume-generation/generate-billable-resume'
import { validateTrustedMutationRequest } from '@/lib/security/request-trust'
import type { GeneratedOutput, GenerateFileOutput } from '@/types/agent'

const OverrideBodySchema = z.object({
  overrideToken: z.string().min(1),
  consumeCredit: z.literal(true).optional().default(true),
})

const OVERRIDE_PROCESSING_LOCK_TTL_MS = 5 * 60 * 1000
const JOB_TARGETING_OVERRIDE_GENERATION_SOURCE = 'job_targeting_override'
const DEFAULT_OVERRIDE_QUERY_THRESHOLD = 15

type OverrideStage =
  | 'load_context'
  | 'acquire_lock'
  | 'build_targeting_plan'
  | 'persist_version'
  | 'build_review_card'
  | 'generate_file'
  | 'persist_generated_output'
  | 'persist_validation_override'

function readOverrideQueryThreshold(): number {
  const rawThreshold = process.env.DB_QUERY_WARNING_THRESHOLD?.trim()
  if (!rawThreshold) {
    return DEFAULT_OVERRIDE_QUERY_THRESHOLD
  }

  const parsedThreshold = Number.parseInt(rawThreshold, 10)
  return Number.isFinite(parsedThreshold) && parsedThreshold > 0
    ? parsedThreshold
    : DEFAULT_OVERRIDE_QUERY_THRESHOLD
}

function logOverrideStageTiming(
  stage: OverrideStage,
  startedAt: number,
  fields: Record<string, unknown> = {},
): void {
  logInfo('agent.job_targeting.override.stage_timing', {
    stage,
    latencyMs: Date.now() - startedAt,
    ...fields,
  })
}

async function runOverrideStage<T>(
  stage: OverrideStage,
  fields: Record<string, unknown>,
  run: () => Promise<T>,
): Promise<T> {
  const startedAt = Date.now()
  try {
    return await run()
  } finally {
    logOverrideStageTiming(stage, startedAt, fields)
  }
}

function countSampledQueries(patterns: RegExp[]): number {
  const context = getRequestQueryContext()
  if (!context) {
    return 0
  }

  return context.queries.filter((query) => patterns.some((pattern) => pattern.test(query))).length
}

function countOverrideHighlightRanges(
  agentState: NonNullable<Awaited<ReturnType<typeof getSession>>>['agentState'],
): number {
  return agentState.highlightState?.resolvedHighlights.reduce(
    (total, highlight) => total + highlight.ranges.length,
    0,
  ) ?? 0
}

function logOverrideQueryBudget(params: {
  sessionId: string
  userId: string
  targetRole?: string
  reviewCardCount: number
  highlightRangeCount: number
  creditCharged: boolean
}): void {
  const context = getRequestQueryContext()
  if (!context) {
    return
  }

  const patternSummary = summarizePatternStats(context.patternStats)
  const threshold = readOverrideQueryThreshold()
  const suspectedNPlusOne = context.queryCount > threshold
    && patternSummary.maxRepeatedPatternCount >= 3

  logInfo('agent.job_targeting.override.query_budget', {
    requestId: context.requestId,
    sessionId: params.sessionId,
    userId: params.userId,
    targetRole: params.targetRole,
    queryCount: context.queryCount,
    threshold,
    uniqueQueryPatternCount: patternSummary.uniqueQueryPatternCount,
    repeatedQueryPatternCount: patternSummary.repeatedQueryPatternCount,
    maxRepeatedPatternCount: patternSummary.maxRepeatedPatternCount,
    suspectedNPlusOne,
    sessionReadCount: countSampledQueries([/GET\s+\/rest\/v1\/sessions\?/i, /sessions\?select=/i]),
    sessionWriteCount: countSampledQueries([
      /PATCH\s+\/rest\/v1\/sessions/i,
      /POST\s+\/rest\/v1\/rpc\/apply_session_patch_with_version/i,
    ]),
    generationLookupCount: countSampledQueries([
      /GET\s+\/rest\/v1\/resume_generations\?/i,
      /resume_generations\?select=/i,
      /GET\s+\/rest\/v1\/cv_versions\?/i,
      /cv_versions\?select=/i,
    ]),
    creditReservationLookupCount: countSampledQueries([
      /GET\s+\/rest\/v1\/credit_reservations\?/i,
      /credit_reservations\?select=/i,
    ]),
    reviewCardCount: params.reviewCardCount,
    highlightRangeCount: params.highlightRangeCount,
    creditCharged: params.creditCharged,
  })
}

function buildValidationFromIssues(
  validationIssues: NonNullable<NonNullable<Awaited<ReturnType<typeof getSession>>>['agentState']['blockedTargetedRewriteDraft']>['validationIssues'],
) {
  const hardIssues = validationIssues.filter((issue) => issue.severity === 'high')
  const softWarnings = validationIssues.filter((issue) => issue.severity !== 'high')

  return {
    blocked: true,
    valid: false,
    hardIssues,
    softWarnings,
    issues: validationIssues,
  }
}

async function persistAgentState(
  session: NonNullable<Awaited<ReturnType<typeof getSession>>>,
  agentState: NonNullable<Awaited<ReturnType<typeof getSession>>>['agentState'],
): Promise<void> {
  await updateSession(session.id, { agentState })
  session.agentState = agentState
}

async function persistOverrideCompletion(
  session: NonNullable<Awaited<ReturnType<typeof getSession>>>,
  agentState: NonNullable<Awaited<ReturnType<typeof getSession>>>['agentState'],
  generatedOutput?: GeneratedOutput,
): Promise<void> {
  await updateSession(session.id, {
    agentState,
    generatedOutput,
  })
  session.agentState = agentState
  if (generatedOutput) {
    session.generatedOutput = generatedOutput
  }
}

function getGenerationOutputFailure(
  output: GenerateFileOutput,
): Extract<GenerateFileOutput, { success: false }> | undefined {
  return output.success ? undefined : output
}

function stripOverrideProcessing(
  session: NonNullable<Awaited<ReturnType<typeof getSession>>>,
): typeof session.agentState {
  const blockedDraft = session.agentState.blockedTargetedRewriteDraft
  const recoverableValidationBlock = session.agentState.recoverableValidationBlock

  return {
    ...session.agentState,
    blockedTargetedRewriteDraft: blockedDraft
      ? {
          ...blockedDraft,
          overrideProcessing: undefined,
        }
      : undefined,
    recoverableValidationBlock: recoverableValidationBlock
      ? {
          ...recoverableValidationBlock,
          overrideProcessing: undefined,
        }
      : undefined,
  }
}

function buildProcessingConflictResponse(params?: {
  requestId?: string
  retryAfterMs?: number
}) {
  return NextResponse.json(
    {
      error: 'override_in_progress',
      message: 'Essa geração já está em andamento.',
      requestId: params?.requestId,
      retryAfterMs: params?.retryAfterMs ?? 3000,
    },
    { status: 409 },
  )
}

function buildAlreadyCompletedResponse(params: {
  sessionId: string
  cvVersionId?: string
  resumeGenerationId?: string
}) {
  return NextResponse.json({
    success: true,
    status: 'already_completed',
    sessionId: params.sessionId,
    cvVersionId: params.cvVersionId,
    resumeGenerationId: params.resumeGenerationId,
    generationType: 'JOB_TARGETING' as const,
    generationSource: JOB_TARGETING_OVERRIDE_GENERATION_SOURCE,
  })
}

function buildGenerationSessionFromProcessingState(params: {
  session: NonNullable<Awaited<ReturnType<typeof getSession>>>
  blockedDraft: NonNullable<NonNullable<Awaited<ReturnType<typeof getSession>>>['agentState']['blockedTargetedRewriteDraft']>
  processingAgentState: NonNullable<Awaited<ReturnType<typeof getSession>>>['agentState']
  rewriteValidation: ReturnType<typeof buildValidationFromIssues>
  includeOptimizedCvState: boolean
}) {
  return {
    ...params.session,
    agentState: {
      ...params.processingAgentState,
      workflowMode: 'job_targeting' as const,
      targetJobDescription: params.blockedDraft.targetJobDescription,
      optimizedCvState:
        params.includeOptimizedCvState && params.blockedDraft.optimizedCvState
          ? structuredClone(params.blockedDraft.optimizedCvState)
          : undefined,
      optimizedAt: params.includeOptimizedCvState
        ? new Date().toISOString()
        : params.processingAgentState.optimizedAt,
      optimizationSummary: params.includeOptimizedCvState
        ? params.blockedDraft.optimizationSummary ?? params.session.agentState.optimizationSummary
        : params.processingAgentState.optimizationSummary,
      lastRewriteMode: params.includeOptimizedCvState
        ? ('job_targeting' as const)
        : params.processingAgentState.lastRewriteMode,
      rewriteStatus: params.includeOptimizedCvState ? ('failed' as const) : ('pending' as const),
      rewriteValidation: params.includeOptimizedCvState ? params.rewriteValidation : undefined,
      blockedTargetedRewriteDraft: undefined,
      recoverableValidationBlock: undefined,
    },
  }
}

function buildSuccessWarnings(
  validation: NonNullable<NonNullable<Awaited<ReturnType<typeof getSession>>>['agentState']['rewriteValidation']> | undefined,
): string[] | undefined {
  const warnings = validation?.softWarnings
    .map((issue) => issue.message)
    .filter(Boolean)

  return warnings && warnings.length > 0 ? warnings : undefined
}


function buildEvidenceBoostSuggestions(targetRole?: string): string[] {
  const normalizedTargetRole = targetRole?.toLowerCase() ?? ''

  if (normalizedTargetRole.includes('power bi') || normalizedTargetRole.includes('bi')) {
    return [
      'Informe seu nível de DAX',
      'Descreva uso de Power Query',
      'Cite RLS/drill-through/bookmarks',
    ]
  }

  return [
    'Informe seu nível de DAX',
    'Descreva uso de Power Query',
    'Cite RLS/drill-through/bookmarks',
  ]
}

function buildFailedWithoutChargeLog(params: {
  sessionId: string
  userId: string
  targetRole?: string
  originalBlockKind: 'pre_rewrite_low_fit_block' | 'post_rewrite_validation_block'
  userAcceptedLowFit: boolean
  failureReason: string
  cvVersionId?: string
}) {
  logError('agent.job_targeting.override.failed_without_charge', {
    sessionId: params.sessionId,
    userId: params.userId,
    targetRole: params.targetRole,
    originalBlockKind: params.originalBlockKind,
    userAcceptedLowFit: params.userAcceptedLowFit,
    creditCharged: false,
    success: false,
    failureReason: params.failureReason,
    cvVersionId: params.cvVersionId,
  })
  logError('agent.job_targeting.override.failed', {
    sessionId: params.sessionId,
    userId: params.userId,
    targetRole: params.targetRole,
    originalBlockKind: params.originalBlockKind,
    userAcceptedLowFit: params.userAcceptedLowFit,
    creditCharged: false,
    success: false,
    failureReason: params.failureReason,
    cvVersionId: params.cvVersionId,
  })
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  return withRequestQueryTracking(req, async () => runWithApiUsageBuffer(async () => {
    const loadContextStartedAt = Date.now()
    const appUser = await getCurrentAppUser()
    if (!appUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const trust = validateTrustedMutationRequest(req)
    if (!trust.ok) {
      logWarn('api.session.job_targeting.override.untrusted_request', {
        requestMethod: req.method,
        requestPath: req.nextUrl.pathname,
        requestedSessionId: params.id,
        appUserId: appUser.id,
        trustSignal: trust.signal,
        trustReason: trust.reason,
        success: false,
      })
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const session = await getSession(params.id, appUser.id)
    if (!session) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const body = OverrideBodySchema.safeParse(await req.json())
    if (!body.success) {
      return NextResponse.json({ error: body.error.flatten() }, { status: 400 })
    }
    logOverrideStageTiming('load_context', loadContextStartedAt, {
      sessionId: session.id,
      userId: appUser.id,
    })

    const overrideTokenHash = hashOverrideToken(body.data.overrideToken)
    const existingValidationOverride = session.agentState.validationOverride
    const blockedDraft = session.agentState.blockedTargetedRewriteDraft
    const recoverableValidationBlock = session.agentState.recoverableValidationBlock

    if (
      (!blockedDraft || !recoverableValidationBlock)
      && existingValidationOverride?.enabled
      && existingValidationOverride.overrideTokenHash === overrideTokenHash
    ) {
      logInfo('agent.job_targeting.override.idempotent_success_returned', {
        sessionId: session.id,
        userId: appUser.id,
        targetRole: existingValidationOverride.targetRole,
        acceptedLowFit: existingValidationOverride.acceptedLowFit === true,
        cvVersionId: existingValidationOverride.cvVersionId,
        resumeGenerationId: existingValidationOverride.resumeGenerationId,
        generationSource: JOB_TARGETING_OVERRIDE_GENERATION_SOURCE,
      })
      return buildAlreadyCompletedResponse({
        sessionId: session.id,
        cvVersionId: existingValidationOverride.cvVersionId,
        resumeGenerationId: existingValidationOverride.resumeGenerationId,
      })
    }

    if (!blockedDraft || !recoverableValidationBlock) {
      return NextResponse.json(
        {
          error: 'Não existe uma versão bloqueada pronta para override nesta sessão.',
        },
        { status: 409 },
      )
    }

    const recoverableStatus = (recoverableValidationBlock as { status?: string }).status
    if (recoverableStatus === 'PROBABLE_MATCH_NEEDS_EVIDENCE') {
      return NextResponse.json({
        success: true,
        canProceed: true,
        needsEvidenceBoost: true,
        suggestedComplements: buildEvidenceBoostSuggestions(blockedDraft.targetRole),
        actionOptions: ['proceed_anyway', 'improve_match_first'] as const,
      })
    }

    if (
      blockedDraft.sessionId !== session.id
      || blockedDraft.userId !== appUser.id
      || blockedDraft.token !== body.data.overrideToken
    ) {
      return NextResponse.json(
        {
          error: 'O token de override não corresponde à sessão atual.',
        },
        { status: 403 },
      )
    }

    if (Date.parse(blockedDraft.expiresAt) <= Date.now()) {
      return NextResponse.json(
        {
          error: 'Esta confirmação expirou. Gere uma nova versão para continuar.',
        },
        { status: 410 },
      )
    }

    const rewriteValidation =
      session.agentState.rewriteValidation ?? buildValidationFromIssues(blockedDraft.validationIssues)
    if (!blockedDraft.recoverable || !isRecoverableValidationBlock(rewriteValidation)) {
      return NextResponse.json(
        {
          error: 'Este bloqueio não pode ser liberado com override pago.',
        },
        { status: 409 },
      )
    }

    const requiredCredits = body.data.consumeCredit ? 1 : 0
    const availableCredits = appUser.creditAccount.creditsRemaining
    if (availableCredits < requiredCredits) {
      logWarn('api.session.job_targeting.override.insufficient_credits', {
        requestMethod: req.method,
        requestPath: req.nextUrl.pathname,
        sessionId: session.id,
        appUserId: appUser.id,
        requiredCredits,
        availableCredits,
        success: false,
      })
      return NextResponse.json(
        {
          error: 'insufficient_credits',
          code: TOOL_ERROR_CODES.INSUFFICIENT_CREDITS,
          message: 'Você não tem créditos suficientes para gerar esta versão.',
          requiredCredits,
          availableCredits,
          openPricing: true,
        },
        { status: 402 },
      )
    }

    const blockKind = blockedDraft.kind ?? 'post_rewrite_validation_block'
    const overrideRequestId = randomUUID()
    const overrideIdempotencyKey = `profile-target-override:${session.id}:${blockedDraft.id}`
    const lockResult = await runOverrideStage('acquire_lock', {
      sessionId: session.id,
      userId: appUser.id,
      draftId: blockedDraft.id,
      blockKind,
    }, () => tryAcquireOverrideProcessingLock({
      sessionId: session.id,
      userId: appUser.id,
      initialSession: session,
      draftId: blockedDraft.id,
      overrideToken: body.data.overrideToken,
      requestId: overrideRequestId,
      now: new Date(),
      lockTtlMs: OVERRIDE_PROCESSING_LOCK_TTL_MS,
      idempotencyKey: overrideIdempotencyKey,
    }))

    if (!lockResult.acquired) {
      if (lockResult.reason === 'already_processing') {
        logInfo('agent.job_targeting.override.processing_lock_conflict', {
          sessionId: session.id,
          userId: appUser.id,
          draftId: blockedDraft.id,
          requestId: overrideRequestId,
          existingRequestId: lockResult.existingRequestId,
          processingExpiresAt: lockResult.processingExpiresAt,
          blockKind,
        })
        return buildProcessingConflictResponse({
          requestId: lockResult.existingRequestId,
          retryAfterMs: 3000,
        })
      }

      if (lockResult.reason === 'already_completed') {
        logInfo('agent.job_targeting.override.idempotent_success_returned', {
          sessionId: session.id,
          userId: appUser.id,
          draftId: blockedDraft.id,
          requestId: overrideRequestId,
          cvVersionId: lockResult.completedResult?.cvVersionId,
          resumeGenerationId: lockResult.completedResult?.resumeGenerationId,
          blockKind,
          generationSource: JOB_TARGETING_OVERRIDE_GENERATION_SOURCE,
        })
        return buildAlreadyCompletedResponse({
          sessionId: session.id,
          cvVersionId: lockResult.completedResult?.cvVersionId,
          resumeGenerationId: lockResult.completedResult?.resumeGenerationId,
        })
      }

      if (lockResult.reason === 'token_invalid') {
        return NextResponse.json(
          {
            error: 'O token de override não corresponde à sessão atual.',
          },
          { status: 403 },
        )
      }

      if (lockResult.reason === 'token_expired') {
        return NextResponse.json(
          {
            error: 'Esta confirmação expirou. Gere uma nova versão para continuar.',
          },
          { status: 410 },
        )
      }

      if (lockResult.reason === 'session_missing') {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }

      return NextResponse.json(
        {
          error: 'Não existe uma versão bloqueada pronta para override nesta sessão.',
        },
        { status: 409 },
      )
    }

    const lockedSession = lockResult.session
    const lockedDraft = lockResult.draft
    const processingAgentState = lockedSession.agentState
    const previousAgentState = stripOverrideProcessing(lockedSession)

    logInfo('agent.job_targeting.override.processing_lock_acquired', {
      sessionId: lockedSession.id,
      userId: appUser.id,
      draftId: lockedDraft.id,
      requestId: overrideRequestId,
      blockKind,
      expiresAt: lockResult.processingState.expiresAt,
    })
    if (lockResult.expiredLockReclaimed) {
      logInfo('agent.job_targeting.override.processing_lock_expired_reclaimed', {
        sessionId: lockedSession.id,
        userId: appUser.id,
        draftId: lockedDraft.id,
        previousRequestId: lockResult.previousRequestId,
        newRequestId: overrideRequestId,
        expiredAt: lockResult.previousExpiresAt,
      })
    }

    if (blockKind === 'pre_rewrite_low_fit_block') {
      const generationSession = buildGenerationSessionFromProcessingState({
        session: lockedSession,
        blockedDraft: lockedDraft,
        processingAgentState,
        rewriteValidation,
        includeOptimizedCvState: false,
      })

      logInfo('agent.job_targeting.override.accepted_low_fit_generation_started', {
        sessionId: lockedSession.id,
        userId: appUser.id,
        targetRole: lockedDraft.targetRole,
        originalBlockKind: 'pre_rewrite_low_fit_block',
        userAcceptedLowFit: true,
        skipPreRewriteLowFitBlock: true,
        skipLowFitRecoverableBlocking: true,
        generationSource: JOB_TARGETING_OVERRIDE_GENERATION_SOURCE,
      })

      const pipelineResult = await runOverrideStage('build_targeting_plan', {
        sessionId: lockedSession.id,
        userId: appUser.id,
        targetRole: lockedDraft.targetRole,
        acceptedLowFit: true,
      }, () => runJobTargetingPipeline(generationSession, {
          userAcceptedLowFit: true,
          overrideReason: 'pre_rewrite_low_fit_block',
          skipPreRewriteLowFitBlock: true,
          skipLowFitRecoverableBlocking: true,
          deferSessionPersistence: true,
        }))

      if (!pipelineResult.success || !pipelineResult.optimizedCvState) {
        await persistAgentState(lockedSession, previousAgentState)
        buildFailedWithoutChargeLog({
          sessionId: lockedSession.id,
          userId: appUser.id,
          targetRole: lockedDraft.targetRole,
          originalBlockKind: 'pre_rewrite_low_fit_block',
          userAcceptedLowFit: true,
          failureReason: pipelineResult.error ?? 'accepted_low_fit_generation_failed',
          cvVersionId: pipelineResult.cvVersionId,
        })
        return NextResponse.json(
          {
            error: pipelineResult.error ?? 'Não conseguimos concluir a geração desta versão.',
          },
          { status: 500 },
        )
      }
      const optimizedCvState = pipelineResult.optimizedCvState

      const generationResult = await runOverrideStage('generate_file', {
        sessionId: lockedSession.id,
        userId: appUser.id,
        targetRole: lockedDraft.targetRole,
        generationIntentKey: overrideIdempotencyKey,
      }, () => generateBillableResume({
          userId: appUser.id,
          sessionId: lockedSession.id,
          sourceCvState: optimizedCvState,
          idempotencyKey: overrideIdempotencyKey,
          templateTargetSource: generationSession.agentState,
          latestVersionId: pipelineResult.cvVersionId,
          latestVersionSource: pipelineResult.cvVersionId ? 'job-targeting' : undefined,
          sourceScope: 'optimized',
          skipCreditPrecheck: true,
          historyContext: {
            idempotencyKey: overrideIdempotencyKey,
            workflowMode: generationSession.agentState.workflowMode,
            lastRewriteMode: generationSession.agentState.lastRewriteMode,
            targetJobDescription: generationSession.agentState.targetJobDescription,
            targetRole: lockedDraft.targetRole,
          },
        }))

      const outputFailure = getGenerationOutputFailure(generationResult.output)
      if (outputFailure) {
        await persistAgentState(lockedSession, previousAgentState)
        logWarn('agent.job_targeting.validation_override_failed', {
          sessionId: lockedSession.id,
          userId: appUser.id,
          targetRole: lockedDraft.targetRole,
          issueCount: lockedDraft.validationIssues.length,
          hardIssueCount: lockedDraft.validationIssues.filter((issue) => issue.severity === 'high').length,
          code: outputFailure.code,
          error: outputFailure.error,
          blockKind,
          generationSource: JOB_TARGETING_OVERRIDE_GENERATION_SOURCE,
        })
        buildFailedWithoutChargeLog({
          sessionId: lockedSession.id,
          userId: appUser.id,
          targetRole: lockedDraft.targetRole,
          originalBlockKind: 'pre_rewrite_low_fit_block',
          userAcceptedLowFit: true,
          failureReason: outputFailure.code ?? outputFailure.error,
          cvVersionId: pipelineResult.cvVersionId,
        })
        return NextResponse.json(
          {
            error:
              outputFailure.error
              ?? 'Não conseguimos concluir a geração por um erro técnico. Tente novamente.',
            code: outputFailure.code,
          },
          {
            status: outputFailure.code
              ? getHttpStatusForToolError(outputFailure.code)
              : 500,
          },
        )
      }

      const output = generationResult.output as {
        creditsUsed?: number
        resumeGenerationId?: string
      }
      const validationIssues = pipelineResult.validation?.issues ?? lockedDraft.validationIssues
      let completedAgentState: typeof lockedSession.agentState = {
        ...generationSession.agentState,
        rewriteStatus: 'completed' as const,
        validationOverride: buildValidationOverrideMetadata({
          userId: appUser.id,
          targetRole: lockedDraft.targetRole,
          validationIssues,
          acceptedLowFit: true,
          fallbackUsed: pipelineResult.acceptedLowFitFallbackUsed === true,
          overrideRequestId,
          overrideTokenHash,
          cvVersionId: pipelineResult.cvVersionId,
          resumeGenerationId: output.resumeGenerationId,
        }),
        blockedTargetedRewriteDraft: undefined,
        recoverableValidationBlock: undefined,
      }
      const highlightState = await runOverrideStage('build_review_card', {
        sessionId: lockedSession.id,
        userId: appUser.id,
        targetRole: lockedDraft.targetRole,
      }, async () => buildOverrideReviewHighlightState({
          session: {
            ...generationSession,
            agentState: completedAgentState,
          },
          cvState: generationSession.agentState.optimizedCvState ?? lockedSession.cvState,
        }))
      completedAgentState = {
        ...completedAgentState,
        highlightState,
      }

      await runOverrideStage('persist_validation_override', {
        sessionId: lockedSession.id,
        userId: appUser.id,
        targetRole: lockedDraft.targetRole,
        reviewCardCount: completedAgentState.highlightState?.reviewItems?.length ?? 0,
        highlightRangeCount: countOverrideHighlightRanges(completedAgentState),
      }, () => persistOverrideCompletion(
          lockedSession,
          completedAgentState,
          generationResult.generatedOutput,
        ))

      logInfo('agent.job_targeting.validation_override_succeeded', {
        sessionId: lockedSession.id,
        userId: appUser.id,
        targetRole: lockedDraft.targetRole,
        issueCount: validationIssues.length,
        hardIssueCount: validationIssues.filter((issue) => issue.severity === 'high').length,
        creditCost: 1,
        creditCharged: (output.creditsUsed ?? 0) > 0,
        resumeGenerationId: output.resumeGenerationId,
        validationOverride: true,
        blockKind,
        generationSource: JOB_TARGETING_OVERRIDE_GENERATION_SOURCE,
      })
      logInfo('agent.job_targeting.override.succeeded', {
        sessionId: lockedSession.id,
        userId: appUser.id,
        targetRole: lockedDraft.targetRole,
        originalBlockKind: 'pre_rewrite_low_fit_block',
        userAcceptedLowFit: true,
        validationOverride: true,
        acceptedLowFit: true,
        fallbackUsed: pipelineResult.acceptedLowFitFallbackUsed === true,
        creditCharged: (output.creditsUsed ?? 0) > 0,
        resumeGenerationId: output.resumeGenerationId,
        cvVersionId: pipelineResult.cvVersionId,
        generationSource: JOB_TARGETING_OVERRIDE_GENERATION_SOURCE,
      })
      logOverrideQueryBudget({
        sessionId: lockedSession.id,
        userId: appUser.id,
        targetRole: lockedDraft.targetRole,
        reviewCardCount: completedAgentState.highlightState?.reviewItems?.length ?? 0,
        highlightRangeCount: countOverrideHighlightRanges(completedAgentState),
        creditCharged: (output.creditsUsed ?? 0) > 0,
      })

      return NextResponse.json({
        success: true,
        sessionId: lockedSession.id,
        creditsUsed: output.creditsUsed ?? 0,
        resumeGenerationId: output.resumeGenerationId,
        generationType: 'JOB_TARGETING' as const,
        generationSource: JOB_TARGETING_OVERRIDE_GENERATION_SOURCE,
        warnings: buildSuccessWarnings(completedAgentState.rewriteValidation),
      })
    }

    if (!lockedDraft.optimizedCvState) {
      await persistAgentState(lockedSession, previousAgentState)
      return NextResponse.json(
        {
          error: 'Esta versão bloqueada precisa ser regenerada antes do override.',
        },
        { status: 409 },
      )
    }
    const optimizedCvState = lockedDraft.optimizedCvState

    const generationSession = buildGenerationSessionFromProcessingState({
      session: lockedSession,
      blockedDraft: lockedDraft,
      processingAgentState,
      rewriteValidation,
      includeOptimizedCvState: true,
    })

    let createdCvVersion
    try {
      createdCvVersion = await runOverrideStage('persist_version', {
        sessionId: lockedSession.id,
        userId: appUser.id,
        targetRole: lockedDraft.targetRole,
      }, () => createCvVersion({
        sessionId: lockedSession.id,
        snapshot: optimizedCvState,
        source: 'job-targeting',
      }))
    } catch (error) {
      await persistAgentState(lockedSession, previousAgentState)
      logError('api.session.job_targeting.override.persist_failed', {
        requestMethod: req.method,
        requestPath: req.nextUrl.pathname,
        sessionId: lockedSession.id,
        appUserId: appUser.id,
        success: false,
        ...serializeError(error),
      })
      buildFailedWithoutChargeLog({
        sessionId: lockedSession.id,
        userId: appUser.id,
        targetRole: lockedDraft.targetRole,
        originalBlockKind: 'post_rewrite_validation_block',
        userAcceptedLowFit: false,
        failureReason: error instanceof Error ? error.message : 'cv_version_persist_failed',
      })
      return NextResponse.json(
        {
          error: 'Não conseguimos concluir a geração por um erro técnico. Tente novamente.',
        },
        { status: 500 },
      )
    }

    const generationResult = await runOverrideStage('generate_file', {
      sessionId: lockedSession.id,
      userId: appUser.id,
      targetRole: lockedDraft.targetRole,
      generationIntentKey: overrideIdempotencyKey,
    }, () => generateBillableResume({
        userId: appUser.id,
        sessionId: lockedSession.id,
        sourceCvState: optimizedCvState,
        idempotencyKey: overrideIdempotencyKey,
        templateTargetSource: generationSession.agentState,
        latestVersionId: createdCvVersion.id,
        latestVersionSource: createdCvVersion.source,
        sourceScope: 'optimized',
        skipCreditPrecheck: true,
        historyContext: {
          idempotencyKey: overrideIdempotencyKey,
          workflowMode: generationSession.agentState.workflowMode,
          lastRewriteMode: generationSession.agentState.lastRewriteMode,
          targetJobDescription: generationSession.agentState.targetJobDescription,
          targetRole: lockedDraft.targetRole,
        },
      }))

    const outputFailure = getGenerationOutputFailure(generationResult.output)
    if (outputFailure) {
      await persistAgentState(lockedSession, previousAgentState)
      logWarn('agent.job_targeting.validation_override_failed', {
        sessionId: lockedSession.id,
        userId: appUser.id,
        targetRole: lockedDraft.targetRole,
        issueCount: lockedDraft.validationIssues.length,
        hardIssueCount: lockedDraft.validationIssues.filter((issue) => issue.severity === 'high').length,
        code: outputFailure.code,
        error: outputFailure.error,
        blockKind,
        generationSource: JOB_TARGETING_OVERRIDE_GENERATION_SOURCE,
      })
      buildFailedWithoutChargeLog({
        sessionId: lockedSession.id,
        userId: appUser.id,
        targetRole: lockedDraft.targetRole,
        originalBlockKind: 'post_rewrite_validation_block',
        userAcceptedLowFit: false,
        failureReason: outputFailure.code ?? outputFailure.error,
        cvVersionId: createdCvVersion.id,
      })
      return NextResponse.json(
        {
          error:
            outputFailure.error
            ?? 'Não conseguimos concluir a geração por um erro técnico. Tente novamente.',
          code: outputFailure.code,
        },
        {
          status: outputFailure.code
            ? getHttpStatusForToolError(outputFailure.code)
            : 500,
        },
      )
    }

    const output = generationResult.output as {
      creditsUsed?: number
      resumeGenerationId?: string
    }
    let completedAgentState: typeof lockedSession.agentState = {
      ...generationSession.agentState,
      rewriteStatus: 'completed' as const,
      validationOverride: buildValidationOverrideMetadata({
        userId: appUser.id,
        targetRole: lockedDraft.targetRole,
        validationIssues: lockedDraft.validationIssues,
        overrideRequestId,
        overrideTokenHash,
        cvVersionId: createdCvVersion.id,
        resumeGenerationId: output.resumeGenerationId,
      }),
      blockedTargetedRewriteDraft: undefined,
      recoverableValidationBlock: undefined,
    }
    const highlightState = await runOverrideStage('build_review_card', {
      sessionId: lockedSession.id,
      userId: appUser.id,
      targetRole: lockedDraft.targetRole,
    }, async () => buildOverrideReviewHighlightState({
        session: {
          ...generationSession,
          agentState: completedAgentState,
        },
        cvState: generationSession.agentState.optimizedCvState ?? lockedSession.cvState,
      }))
    completedAgentState = {
      ...completedAgentState,
      highlightState,
    }

    await runOverrideStage('persist_validation_override', {
      sessionId: lockedSession.id,
      userId: appUser.id,
      targetRole: lockedDraft.targetRole,
      reviewCardCount: completedAgentState.highlightState?.reviewItems?.length ?? 0,
      highlightRangeCount: countOverrideHighlightRanges(completedAgentState),
    }, () => persistOverrideCompletion(
        lockedSession,
        completedAgentState,
        generationResult.generatedOutput,
      ))

    logInfo('agent.job_targeting.validation_override_succeeded', {
      sessionId: lockedSession.id,
      userId: appUser.id,
      targetRole: lockedDraft.targetRole,
      issueCount: lockedDraft.validationIssues.length,
      hardIssueCount: lockedDraft.validationIssues.filter((issue) => issue.severity === 'high').length,
      creditCost: 1,
      creditCharged: (output.creditsUsed ?? 0) > 0,
      resumeGenerationId: output.resumeGenerationId,
      validationOverride: true,
      blockKind,
      generationSource: JOB_TARGETING_OVERRIDE_GENERATION_SOURCE,
    })
    logInfo('agent.job_targeting.override.succeeded', {
      sessionId: lockedSession.id,
      userId: appUser.id,
      targetRole: lockedDraft.targetRole,
      originalBlockKind: 'post_rewrite_validation_block',
      userAcceptedLowFit: false,
      validationOverride: true,
      acceptedLowFit: false,
      fallbackUsed: false,
      creditCharged: (output.creditsUsed ?? 0) > 0,
      resumeGenerationId: output.resumeGenerationId,
      cvVersionId: createdCvVersion.id,
      generationSource: JOB_TARGETING_OVERRIDE_GENERATION_SOURCE,
    })
    logOverrideQueryBudget({
      sessionId: lockedSession.id,
      userId: appUser.id,
      targetRole: lockedDraft.targetRole,
      reviewCardCount: completedAgentState.highlightState?.reviewItems?.length ?? 0,
      highlightRangeCount: countOverrideHighlightRanges(completedAgentState),
      creditCharged: (output.creditsUsed ?? 0) > 0,
    })

    return NextResponse.json({
      success: true,
      sessionId: lockedSession.id,
      creditsUsed: output.creditsUsed ?? 0,
      resumeGenerationId: output.resumeGenerationId,
      generationType: 'JOB_TARGETING' as const,
      generationSource: JOB_TARGETING_OVERRIDE_GENERATION_SOURCE,
      warnings: buildSuccessWarnings(completedAgentState.rewriteValidation),
    })
  }))
}
