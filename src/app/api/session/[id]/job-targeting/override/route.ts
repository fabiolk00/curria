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
import { dispatchToolWithContext } from '@/lib/agent/tools'
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
import { withRequestQueryTracking } from '@/lib/observability/request-query-tracking'
import { validateTrustedMutationRequest } from '@/lib/security/request-trust'

const OverrideBodySchema = z.object({
  overrideToken: z.string().min(1),
  consumeCredit: z.literal(true).optional().default(true),
})

const OVERRIDE_PROCESSING_LOCK_TTL_MS = 5 * 60 * 1000
const JOB_TARGETING_OVERRIDE_GENERATION_SOURCE = 'job_targeting_override'

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
    const lockResult = await tryAcquireOverrideProcessingLock({
      sessionId: session.id,
      userId: appUser.id,
      draftId: blockedDraft.id,
      overrideToken: body.data.overrideToken,
      requestId: overrideRequestId,
      now: new Date(),
      lockTtlMs: OVERRIDE_PROCESSING_LOCK_TTL_MS,
      idempotencyKey: overrideIdempotencyKey,
    })

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

      const pipelineResult = await runJobTargetingPipeline(generationSession, {
        userAcceptedLowFit: true,
        overrideReason: 'pre_rewrite_low_fit_block',
        skipPreRewriteLowFitBlock: true,
        skipLowFitRecoverableBlocking: true,
        deferSessionPersistence: true,
      })

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

      const generationResult = await dispatchToolWithContext(
        'generate_file',
        {
          cv_state: pipelineResult.optimizedCvState,
          idempotency_key: overrideIdempotencyKey,
        },
        generationSession,
      )

      if (generationResult.outputFailure) {
        await persistAgentState(lockedSession, previousAgentState)
        logWarn('agent.job_targeting.validation_override_failed', {
          sessionId: lockedSession.id,
          userId: appUser.id,
          targetRole: lockedDraft.targetRole,
          issueCount: lockedDraft.validationIssues.length,
          hardIssueCount: lockedDraft.validationIssues.filter((issue) => issue.severity === 'high').length,
          code: generationResult.outputFailure.code,
          error: generationResult.outputFailure.error,
          blockKind,
          generationSource: JOB_TARGETING_OVERRIDE_GENERATION_SOURCE,
        })
        buildFailedWithoutChargeLog({
          sessionId: lockedSession.id,
          userId: appUser.id,
          targetRole: lockedDraft.targetRole,
          originalBlockKind: 'pre_rewrite_low_fit_block',
          userAcceptedLowFit: true,
          failureReason: generationResult.outputFailure.code ?? generationResult.outputFailure.error,
          cvVersionId: pipelineResult.cvVersionId,
        })
        return NextResponse.json(
          {
            error:
              generationResult.outputFailure.error
              ?? 'Não conseguimos concluir a geração por um erro técnico. Tente novamente.',
            code: generationResult.outputFailure.code,
          },
          {
            status: generationResult.outputFailure.code
              ? getHttpStatusForToolError(generationResult.outputFailure.code)
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
      completedAgentState = {
        ...completedAgentState,
        highlightState: buildOverrideReviewHighlightState({
          session: {
            ...generationSession,
            agentState: completedAgentState,
          },
          cvState: generationSession.agentState.optimizedCvState ?? lockedSession.cvState,
        }),
      }

      await persistAgentState(lockedSession, completedAgentState)

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

    const generationSession = buildGenerationSessionFromProcessingState({
      session: lockedSession,
      blockedDraft: lockedDraft,
      processingAgentState,
      rewriteValidation,
      includeOptimizedCvState: true,
    })

    let createdCvVersion
    try {
      createdCvVersion = await createCvVersion({
        sessionId: lockedSession.id,
        snapshot: lockedDraft.optimizedCvState,
        source: 'job-targeting',
      })
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

    const generationResult = await dispatchToolWithContext(
      'generate_file',
      {
        cv_state: lockedDraft.optimizedCvState,
        idempotency_key: overrideIdempotencyKey,
      },
      generationSession,
    )

    if (generationResult.outputFailure) {
      await persistAgentState(lockedSession, previousAgentState)
      logWarn('agent.job_targeting.validation_override_failed', {
        sessionId: lockedSession.id,
        userId: appUser.id,
        targetRole: lockedDraft.targetRole,
        issueCount: lockedDraft.validationIssues.length,
        hardIssueCount: lockedDraft.validationIssues.filter((issue) => issue.severity === 'high').length,
        code: generationResult.outputFailure.code,
        error: generationResult.outputFailure.error,
        blockKind,
        generationSource: JOB_TARGETING_OVERRIDE_GENERATION_SOURCE,
      })
      buildFailedWithoutChargeLog({
        sessionId: lockedSession.id,
        userId: appUser.id,
        targetRole: lockedDraft.targetRole,
        originalBlockKind: 'post_rewrite_validation_block',
        userAcceptedLowFit: false,
        failureReason: generationResult.outputFailure.code ?? generationResult.outputFailure.error,
        cvVersionId: createdCvVersion.id,
      })
      return NextResponse.json(
        {
          error:
            generationResult.outputFailure.error
            ?? 'Não conseguimos concluir a geração por um erro técnico. Tente novamente.',
          code: generationResult.outputFailure.code,
        },
        {
          status: generationResult.outputFailure.code
            ? getHttpStatusForToolError(generationResult.outputFailure.code)
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
    completedAgentState = {
      ...completedAgentState,
      highlightState: buildOverrideReviewHighlightState({
        session: {
          ...generationSession,
          agentState: completedAgentState,
        },
        cvState: generationSession.agentState.optimizedCvState ?? lockedSession.cvState,
      }),
    }

    await persistAgentState(lockedSession, completedAgentState)

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
