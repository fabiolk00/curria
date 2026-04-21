import { createHash } from 'crypto'

import { TOOL_ERROR_CODES, toolFailure } from '@/lib/agent/tool-errors'
import {
  createSignedResumeArtifactUrlsBestEffort,
  generateFile,
  validateGenerationCvState,
  type GenerateFileExecutionResult,
} from '@/lib/agent/tools/generate-file'
import {
  checkUserQuota,
  consumeCreditForGeneration,
  finalizeCreditReservation,
  getUserBillingInfo,
  releaseCreditReservation,
  reserveCreditForGenerationIntent,
} from '@/lib/asaas/quota'
import { getLatestCvVersionForScope } from '@/lib/db/cv-versions'
import { markCreditReservationReconciliation } from '@/lib/db/credit-reservations'
import {
  applyPreviewAccessToGeneratedOutput,
  applyPreviewAccessToPatch,
  assertNoRealArtifactForLockedPreview,
  buildLockedPreviewAccess,
  buildLockedPreviewPdfUrl,
  canViewRealPreview,
} from '@/lib/generated-preview/locked-preview'
import { getResumeTargetForSession } from '@/lib/db/resume-targets'
import {
  createPendingResumeGeneration,
  getLatestCompletedResumeGenerationForScope,
  getResumeGenerationByIdempotencyKey,
  updateResumeGeneration,
} from '@/lib/db/resume-generations'
import { getSession } from '@/lib/db/sessions'
import { resolveExportGenerationConfig } from '@/lib/jobs/config'
import { recordMetricCounter } from '@/lib/observability/metric-events'
import { logInfo, logWarn, serializeError } from '@/lib/observability/structured-log'
import { withTimedOperation } from '@/lib/observability/timed-operation'
import type {
  GenerateFileInput,
  GenerateFileOutput,
  GeneratedOutput,
  ResumeGeneration,
  ResumeGenerationType,
  ToolPatch,
} from '@/types/agent'

type ArtifactScope =
  | { type: 'session' }
  | { type: 'target'; targetId: string }

type BillableGenerationResult = {
  output: GenerateFileOutput
  patch?: ToolPatch
  generatedOutput?: GeneratedOutput
  resumeGeneration?: ResumeGeneration
  processingStage?: string
  needsReconciliation?: boolean
}

type ResumeGenerationPersistenceResult = {
  resumeGeneration?: ResumeGeneration
  resumeGenerationId?: string
}

export const BILLABLE_CV_VERSION_SOURCES = new Set(['rewrite', 'ats-enhancement', 'job-targeting', 'target-derived'])

function isMissingResumeGenerationSchemaError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : ''

  return (
    message.includes('does not exist')
    && (
      message.includes('resume_generations')
      || message.includes('credit_consumptions')
      || message.includes('resume_generation_type')
    )
  )
}

function resolveGenerationType(scope: ArtifactScope): ResumeGenerationType {
  return scope.type === 'target' ? 'JOB_TARGETING' : 'ATS_ENHANCEMENT'
}

function buildCompletedGenerationArtifacts(existing: ResumeGeneration): Pick<BillableGenerationResult, 'generatedOutput' | 'patch'> | null {
  if (existing.status !== 'completed' || !existing.outputPdfPath) {
    return null
  }

  return {
    generatedOutput: {
      status: 'ready',
      pdfPath: existing.outputPdfPath,
      docxPath: existing.outputDocxPath,
      generatedAt: existing.updatedAt.toISOString(),
    },
    patch: {
      generatedOutput: {
        status: 'ready',
        pdfPath: existing.outputPdfPath,
        docxPath: existing.outputDocxPath,
        generatedAt: existing.updatedAt.toISOString(),
      },
    },
  }
}

function buildPendingGenerationInProgressResult(existing: ResumeGeneration): BillableGenerationResult {
  return {
    output: {
      success: true,
      pdfUrl: null,
      docxUrl: null,
      creditsUsed: 0,
      resumeGenerationId: existing.id,
      inProgress: true,
    },
    generatedOutput: {
      status: 'generating',
    },
    patch: {
      generatedOutput: {
        status: 'generating',
        error: undefined,
      },
    },
    resumeGeneration: existing,
    processingStage: 'reserve_credit',
  }
}

function areCvStatesEqual(left: GenerateFileInput['cv_state'], right?: GenerateFileInput['cv_state']): boolean {
  return Boolean(right) && JSON.stringify(left) === JSON.stringify(right)
}

async function safeUpdateResumeGeneration(
  input: Parameters<typeof updateResumeGeneration>[0],
): Promise<ResumeGeneration | null> {
  try {
    return await updateResumeGeneration(input)
  } catch (error) {
    logWarn('resume_generation.persistence_failed', {
      resumeGenerationId: input.id,
      status: input.status,
      stage: 'persistence',
      ...serializeError(error),
    })
    return null
  }
}

function logGenerationStageWarning(input: {
  event:
    | 'resume_generation.render_failed'
    | 'resume_generation.billing_failed'
    | 'resume_generation.billing_reconciliation_required'
  userId: string
  sessionId: string
  targetId?: string
  resumeGenerationId?: string
  generationIntentKey?: string
  type: ResumeGenerationType
  error?: string
  code?: string
  stage?: string
}): void {
  logWarn(input.event, {
    userId: input.userId,
    sessionId: input.sessionId,
    targetId: input.targetId,
    resumeGenerationId: input.resumeGenerationId,
    generationIntentKey: input.generationIntentKey,
    generationType: input.type,
    stage: input.stage ?? 'billing',
    errorMessage: input.error,
    errorCode: input.code,
  })
}

async function completeResumeGenerationBestEffort(input: {
  resumeGeneration: ResumeGeneration
  sourceCvState: GenerateFileInput['cv_state']
  generationResult: GenerateFileExecutionResult
}): Promise<ResumeGenerationPersistenceResult> {
  const completedGeneration = await safeUpdateResumeGeneration({
    id: input.resumeGeneration.id,
    status: 'completed',
    generatedCvState: input.sourceCvState,
    outputPdfPath: input.generationResult.generatedOutput?.pdfPath,
    outputDocxPath: input.generationResult.generatedOutput?.docxPath,
  })

  if (!completedGeneration) {
    return {}
  }

  return {
    resumeGeneration: completedGeneration,
    resumeGenerationId: completedGeneration.id,
  }
}

async function generateWithoutResumeGenerationPersistence(input: {
  userId: string
  sessionId: string
  sourceCvState: GenerateFileInput['cv_state']
  targetId?: string
  generationType: ResumeGenerationType
  idempotencyKey?: string
  templateTargetSource?: Parameters<typeof generateFile>[4]
}): Promise<BillableGenerationResult> {
  const scope: ArtifactScope = input.targetId
    ? { type: 'target', targetId: input.targetId }
    : { type: 'session' }
  const fallbackFingerprint = input.idempotencyKey
    ?? createHash('sha256').update(JSON.stringify(input.sourceCvState)).digest('hex')
  const legacyGenerationId = [
    'legacy',
    input.sessionId,
    input.targetId ?? 'base',
    fallbackFingerprint,
  ].join(':')

  const generationResult = await generateFile(
    {
      cv_state: input.sourceCvState,
      target_id: input.targetId,
    },
    input.userId,
    input.sessionId,
    scope,
    input.templateTargetSource,
  )

  if (!generationResult.output.success) {
    return generationResult
  }

  const creditConsumed = await consumeCreditForGeneration(
    input.userId,
    legacyGenerationId,
    input.generationType,
  )

  if (!creditConsumed) {
    return {
      output: toolFailure(
        TOOL_ERROR_CODES.INSUFFICIENT_CREDITS,
        'Seus créditos acabaram antes de concluir esta geração. Tente novamente após recarregar seu saldo.',
      ),
      generatedOutput: {
        status: 'failed',
        error: 'No credits available to finalize this generation.',
      },
      processingStage: 'billing_failed',
    }
  }

  return {
    ...generationResult,
    output: {
      ...generationResult.output,
      creditsUsed: 1,
    },
    processingStage: 'completed',
  }
}

function resolveGenerationIntentKey(input: {
  idempotencyKey?: string
  resumeGeneration: ResumeGeneration
}): string {
  return input.idempotencyKey ?? input.resumeGeneration.id
}

async function resolvePreviewAccessForCompletedGeneration(
  userId: string,
): Promise<GeneratedOutput['previewAccess'] | undefined> {
  const billingInfo = await getUserBillingInfo(userId)

  if (billingInfo?.plan === 'free') {
    return buildLockedPreviewAccess()
  }

  return undefined
}

async function resolvePersistedReplayPreviewAccess(input: {
  userId: string
  sessionId: string
  targetId?: string
}): Promise<GeneratedOutput['previewAccess'] | undefined> {
  if (input.targetId) {
    const target = await getResumeTargetForSession(input.sessionId, input.targetId)
    return target?.generatedOutput?.previewAccess
  }

  const session = await getSession(input.sessionId, input.userId)
  return session?.generatedOutput?.previewAccess
}

async function resolveReplayPreviewAccess(input: {
  userId: string
  sessionId: string
  targetId?: string
}): Promise<GeneratedOutput['previewAccess'] | undefined> {
  // Historical preview locks are the source of truth for replayed artifacts.
  // A later plan upgrade only affects new generations; replay must not reinterpret
  // an older locked artifact as viewable unless a new unlocked generation is created.
  const persistedPreviewAccess = await resolvePersistedReplayPreviewAccess(input)

  if (persistedPreviewAccess) {
    const billingInfo = await getUserBillingInfo(input.userId)
    if (persistedPreviewAccess.locked && billingInfo?.plan && billingInfo.plan !== 'free') {
      recordMetricCounter('architecture.smart_generation.replay_locked_after_upgrade', {
        userId: input.userId,
        sessionId: input.sessionId,
        targetId: input.targetId,
      })
    }

    return persistedPreviewAccess
  }

  return resolvePreviewAccessForCompletedGeneration(input.userId)
}

async function buildReplayResultForViewer(input: {
  existing: ResumeGeneration
  userId: string
  sessionId: string
  targetId?: string
  signedUrlSource: 'existing_generation' | 'idempotent_generation'
}): Promise<BillableGenerationResult | null> {
  const artifacts = buildCompletedGenerationArtifacts(input.existing)
  if (!artifacts) {
    return null
  }

  const previewAccess = await resolveReplayPreviewAccess({
    userId: input.userId,
    sessionId: input.sessionId,
    targetId: input.targetId,
  })
  const generatedOutput = applyPreviewAccessToGeneratedOutput(
    artifacts.generatedOutput,
    previewAccess,
  )
  const patch = applyPreviewAccessToPatch(
    artifacts.patch,
    previewAccess,
  )

  const output: Extract<GenerateFileOutput, { success: true }> = {
    success: true,
    pdfUrl: null,
    docxUrl: null,
    creditsUsed: 0,
    resumeGenerationId: input.existing.id,
  }

  if (canViewRealPreview(generatedOutput)) {
    const signedUrls = await createSignedResumeArtifactUrlsBestEffort(
      input.existing.outputDocxPath,
      input.existing.outputPdfPath!,
      {
        userId: input.userId,
        sessionId: input.sessionId,
        targetId: input.targetId,
        pdfPath: input.existing.outputPdfPath!,
        source: input.signedUrlSource,
      },
    )

    output.pdfUrl = signedUrls.pdfUrl
    output.docxUrl = signedUrls.docxUrl ?? null
  }

  assertNoRealArtifactForLockedPreview({
    output,
    generatedOutput,
    patch,
    sessionId: input.sessionId,
    targetId: input.targetId,
  })

  return {
    output,
    generatedOutput,
    patch,
    resumeGeneration: input.existing,
    processingStage: 'completed',
  }
}

async function generateFileWithTimeout(input: {
  userId: string
  sessionId: string
  scope: ArtifactScope
  sourceCvState: GenerateFileInput['cv_state']
  targetId?: string
  templateTargetSource?: Parameters<typeof generateFile>[4]
  generationIntentKey: string
}): Promise<GenerateFileExecutionResult> {
  const timeoutMs = resolveExportGenerationConfig().timeoutMs

  return withTimedOperation({
    operation: 'generateFile',
    generationIntentKey: input.generationIntentKey,
    appUserId: input.userId,
    run: async () => {
      const generationPromise = generateFile(
        {
          cv_state: input.sourceCvState,
          target_id: input.targetId,
        },
        input.userId,
        input.sessionId,
        input.scope,
        input.templateTargetSource,
      )

      const timeoutPromise = new Promise<GenerateFileExecutionResult>((resolve) => {
        setTimeout(() => {
          resolve({
            output: toolFailure(
              TOOL_ERROR_CODES.GENERATION_ERROR,
              'A geracao do PDF excedeu o tempo limite e foi interrompida.',
            ),
            generatedOutput: {
              status: 'failed',
              error: 'Export generation timed out.',
            },
          })
        }, timeoutMs)
      })

      return Promise.race([generationPromise, timeoutPromise])
    },
    onFailure: () => ({
      errorCategory: 'render_artifact',
    }),
  })
}

export async function generateBillableResume(input: {
  userId: string
  sessionId: string
  sourceCvState: GenerateFileInput['cv_state']
  targetId?: string
  idempotencyKey?: string
  templateTargetSource?: Parameters<typeof generateFile>[4]
  resumePendingGeneration?: boolean
}): Promise<BillableGenerationResult> {
  const validation = validateGenerationCvState(input.sourceCvState)
  if (!validation.success) {
    return {
      output: toolFailure(
        TOOL_ERROR_CODES.VALIDATION_ERROR,
        validation.errorMessage,
      ),
      generatedOutput: {
        status: 'failed',
        error: validation.errorMessage,
      },
      processingStage: 'validation_failed',
    }
  }

  const scope: ArtifactScope = input.targetId
    ? { type: 'target', targetId: input.targetId }
    : { type: 'session' }
  const generationType = resolveGenerationType(scope)
  let resumeGeneration: ResumeGeneration | undefined
  let latestCompletedGeneration: ResumeGeneration | null = null
  let resumeGenerationSchemaUnavailable = false

  try {
    latestCompletedGeneration = await getLatestCompletedResumeGenerationForScope({
      userId: input.userId,
      sessionId: input.sessionId,
      resumeTargetId: input.targetId,
      type: generationType,
    })
  } catch (error) {
    if (isMissingResumeGenerationSchemaError(error)) {
      logWarn('resume_generation.schema_unavailable', {
        userId: input.userId,
        sessionId: input.sessionId,
        targetId: input.targetId,
        stage: 'lookup_latest_completed',
        ...serializeError(error),
      })
      resumeGenerationSchemaUnavailable = true
    } else {
      throw error
    }
  }

  if (
    !resumeGenerationSchemaUnavailable
    && latestCompletedGeneration
    && areCvStatesEqual(input.sourceCvState, latestCompletedGeneration.generatedCvState ?? latestCompletedGeneration.sourceCvSnapshot)
  ) {
    const replayResult = await buildReplayResultForViewer({
      existing: latestCompletedGeneration,
      userId: input.userId,
      sessionId: input.sessionId,
      targetId: input.targetId,
      signedUrlSource: 'existing_generation',
    })
    if (replayResult) {
      return replayResult
    }
  }

  if (input.idempotencyKey && !resumeGenerationSchemaUnavailable) {
    let existing: ResumeGeneration | null = null

    try {
      existing = await getResumeGenerationByIdempotencyKey(input.userId, input.idempotencyKey)
    } catch (error) {
      if (isMissingResumeGenerationSchemaError(error)) {
        logWarn('resume_generation.schema_unavailable', {
          userId: input.userId,
          sessionId: input.sessionId,
          targetId: input.targetId,
          stage: 'lookup_idempotency',
          idempotencyKey: input.idempotencyKey,
          ...serializeError(error),
        })
        resumeGenerationSchemaUnavailable = true
      } else {
        throw error
      }
    }

    if (!resumeGenerationSchemaUnavailable && existing) {
      const replayResult = await buildReplayResultForViewer({
        existing,
        userId: input.userId,
        sessionId: input.sessionId,
        targetId: input.targetId,
        signedUrlSource: 'idempotent_generation',
      })
      if (replayResult) {
        return replayResult
      }

      if (existing.status === 'failed') {
        return {
          output: toolFailure(
            TOOL_ERROR_CODES.GENERATION_ERROR,
            existing.failureReason ?? 'File generation failed.',
          ),
          generatedOutput: {
            status: 'failed',
            error: existing.failureReason,
          },
          resumeGeneration: existing,
          processingStage: 'generation_failed',
        }
      }

      if (existing.status === 'pending') {
        if (!input.resumePendingGeneration) {
          return buildPendingGenerationInProgressResult(existing)
        }
        resumeGeneration = existing
      }
    }
  }

  const latestCvVersion = await getLatestCvVersionForScope(input.sessionId, input.targetId)
  if (!latestCvVersion || !BILLABLE_CV_VERSION_SOURCES.has(latestCvVersion.source)) {
    return {
      output: toolFailure(
        TOOL_ERROR_CODES.VALIDATION_ERROR,
        'Gere uma nova versão otimizada pela IA antes de exportar este currículo.',
      ),
      processingStage: 'validation_failed',
    }
  }

  const hasCredits = await checkUserQuota(input.userId)
  if (!hasCredits) {
    return {
      output: toolFailure(
        TOOL_ERROR_CODES.INSUFFICIENT_CREDITS,
        'Seus créditos acabaram. Gere um novo currículo quando houver saldo disponível.',
      ),
      processingStage: 'reserve_credit',
    }
  }

  if (resumeGenerationSchemaUnavailable) {
    return generateWithoutResumeGenerationPersistence({
      userId: input.userId,
      sessionId: input.sessionId,
      sourceCvState: input.sourceCvState,
      targetId: input.targetId,
      generationType,
      idempotencyKey: input.idempotencyKey,
      templateTargetSource: input.templateTargetSource,
    })
  }

  if (!resumeGeneration) {
    let pendingGeneration: Awaited<ReturnType<typeof createPendingResumeGeneration>> | null = null

    try {
      pendingGeneration = await createPendingResumeGeneration({
        userId: input.userId,
        sessionId: input.sessionId,
        resumeTargetId: input.targetId,
        type: generationType,
        idempotencyKey: input.idempotencyKey,
        sourceCvSnapshot: input.sourceCvState,
      })
    } catch (error) {
      if (isMissingResumeGenerationSchemaError(error)) {
        logWarn('resume_generation.schema_unavailable', {
          userId: input.userId,
          sessionId: input.sessionId,
          targetId: input.targetId,
          stage: 'create_pending',
          idempotencyKey: input.idempotencyKey,
          ...serializeError(error),
        })
        resumeGenerationSchemaUnavailable = true
      } else {
        throw error
      }
    }

    if (resumeGenerationSchemaUnavailable) {
      return generateWithoutResumeGenerationPersistence({
        userId: input.userId,
        sessionId: input.sessionId,
        sourceCvState: input.sourceCvState,
        targetId: input.targetId,
        generationType,
        idempotencyKey: input.idempotencyKey,
        templateTargetSource: input.templateTargetSource,
      })
    }

    if (!pendingGeneration) {
      throw new Error('Pending generation was not created before continuing billable export flow.')
    }

    resumeGeneration = pendingGeneration.generation

    if (!pendingGeneration.wasCreated && !input.resumePendingGeneration) {
      return buildPendingGenerationInProgressResult(resumeGeneration)
    }
  }

  const generationIntentKey = resolveGenerationIntentKey({
    idempotencyKey: input.idempotencyKey,
    resumeGeneration,
  })

  const reservation = await withTimedOperation({
    operation: 'reserveCreditForGenerationIntent',
    generationIntentKey,
    appUserId: input.userId,
    run: () => reserveCreditForGenerationIntent({
      userId: input.userId,
      generationIntentKey,
      generationType,
      sessionId: input.sessionId,
      resumeTargetId: input.targetId,
      resumeGenerationId: resumeGeneration.id,
      metadata: {
        sessionId: input.sessionId,
        targetId: input.targetId ?? null,
        stage: 'reserve_credit',
        resumePendingGeneration: input.resumePendingGeneration ?? false,
      },
    }),
    onFailure: (error) => ({
      errorCategory: 'reserve_credit',
      errorCode: error instanceof Error ? 'reserve_failed' : 'reserve_failed_unknown',
    }),
  })

  logInfo('resume_generation.credit_reserved', {
    userId: input.userId,
    sessionId: input.sessionId,
    targetId: input.targetId,
    resumeGenerationId: resumeGeneration.id,
    generationIntentKey,
    generationType,
    stage: 'reserve_credit',
  })
  recordMetricCounter('billing.reservations.created', {
    appUserId: input.userId,
    generationIntentKey,
    generationType,
  })
  recordMetricCounter('exports.started', {
    appUserId: input.userId,
    generationIntentKey,
    generationType,
  })

  const generationResult = await generateFileWithTimeout({
    userId: input.userId,
    sessionId: input.sessionId,
    scope,
    sourceCvState: input.sourceCvState,
    targetId: input.targetId,
    templateTargetSource: input.templateTargetSource,
    generationIntentKey,
  })

  if (!generationResult.output.success) {
    const generationFailureReason = generationResult.generatedOutput?.error ?? generationResult.output.error

    logGenerationStageWarning({
      event: 'resume_generation.render_failed',
      userId: input.userId,
      sessionId: input.sessionId,
      targetId: input.targetId,
      resumeGenerationId: resumeGeneration.id,
      generationIntentKey,
      type: generationType,
      error: generationFailureReason,
      code: generationResult.output.code,
      stage: 'render_artifact',
    })

    try {
      await withTimedOperation({
        operation: 'releaseCreditReservation',
        generationIntentKey,
        appUserId: input.userId,
        run: () => releaseCreditReservation({
          userId: input.userId,
          generationIntentKey,
          resumeGenerationId: resumeGeneration.id,
          metadata: {
            sessionId: input.sessionId,
            targetId: input.targetId ?? null,
            stage: 'release_credit',
            reason: generationFailureReason,
          },
        }),
        onFailure: () => ({
          errorCategory: 'release_credit',
          errorCode: 'release_failed',
        }),
      })
      logInfo('resume_generation.credit_released', {
        userId: input.userId,
        sessionId: input.sessionId,
        targetId: input.targetId,
        resumeGenerationId: resumeGeneration.id,
        generationIntentKey,
        generationType,
        stage: 'release_credit',
      })
      recordMetricCounter('billing.reservations.released', {
        appUserId: input.userId,
        generationIntentKey,
        generationType,
      })
    } catch (error) {
      try {
        await markCreditReservationReconciliation({
          reservationId: reservation.id,
          status: 'needs_reconciliation',
          reconciliationStatus: 'pending',
          failureReason: error instanceof Error ? error.message : String(error),
          metadata: {
            source: 'render_failure_release',
            generationIntentKey,
          },
        })
        recordMetricCounter('billing.reservations.needs_reconciliation', {
          appUserId: input.userId,
          generationIntentKey,
          generationType,
          source: 'render_failure_release',
        })
      } catch (markerError) {
        logWarn('resume_generation.reconciliation_marker_failed', {
          userId: input.userId,
          sessionId: input.sessionId,
          targetId: input.targetId,
          reservationId: reservation.id,
          resumeGenerationId: resumeGeneration.id,
          generationIntentKey,
          stage: 'release_credit',
          ...serializeError(markerError),
        })
      }
      logGenerationStageWarning({
        event: 'resume_generation.billing_reconciliation_required',
        userId: input.userId,
        sessionId: input.sessionId,
        targetId: input.targetId,
        resumeGenerationId: resumeGeneration.id,
        generationIntentKey,
        type: generationType,
        error: error instanceof Error ? error.message : String(error),
        code: generationResult.output.code,
        stage: 'release_credit',
      })
    }

    await safeUpdateResumeGeneration({
      id: resumeGeneration.id,
      status: 'failed',
      failureReason: generationFailureReason,
    })
    recordMetricCounter('exports.failed', {
      appUserId: input.userId,
      generationIntentKey,
      generationType,
      stage: 'render_artifact',
    })

    return {
      ...generationResult,
      resumeGeneration,
      processingStage: 'release_credit',
    }
  }

  const previewAccess = await resolvePreviewAccessForCompletedGeneration(input.userId)
  const generatedOutput = applyPreviewAccessToGeneratedOutput(
    generationResult.generatedOutput,
    previewAccess,
  )
  const patch = applyPreviewAccessToPatch(
    generationResult.patch,
    previewAccess,
  )

  let needsReconciliation = false
  try {
    await withTimedOperation({
      operation: 'finalizeCreditReservation',
      generationIntentKey,
      appUserId: input.userId,
      run: () => finalizeCreditReservation({
        userId: input.userId,
        generationIntentKey,
        resumeGenerationId: resumeGeneration.id,
        metadata: {
          sessionId: input.sessionId,
          targetId: input.targetId ?? null,
          stage: 'finalize_credit',
        },
      }),
      onFailure: () => ({
        errorCategory: 'finalize_credit',
        errorCode: 'finalize_failed',
      }),
    })
    logInfo('resume_generation.credit_finalized', {
      userId: input.userId,
      sessionId: input.sessionId,
      targetId: input.targetId,
      resumeGenerationId: resumeGeneration.id,
      generationIntentKey,
      generationType,
      stage: 'finalize_credit',
    })
    recordMetricCounter('billing.reservations.finalized', {
      appUserId: input.userId,
      generationIntentKey,
      generationType,
    })
  } catch (error) {
    needsReconciliation = true
    try {
      await markCreditReservationReconciliation({
        reservationId: reservation.id,
        status: 'needs_reconciliation',
        reconciliationStatus: 'pending',
        failureReason: error instanceof Error ? error.message : String(error),
        metadata: {
          source: 'artifact_success_finalize',
          generationIntentKey,
        },
      })
      recordMetricCounter('billing.reservations.needs_reconciliation', {
        appUserId: input.userId,
        generationIntentKey,
        generationType,
        source: 'artifact_success_finalize',
      })
    } catch (markerError) {
      logWarn('resume_generation.reconciliation_marker_failed', {
        userId: input.userId,
        sessionId: input.sessionId,
        targetId: input.targetId,
        reservationId: reservation.id,
        resumeGenerationId: resumeGeneration.id,
        generationIntentKey,
        stage: 'finalize_credit',
        ...serializeError(markerError),
      })
    }
    logGenerationStageWarning({
      event: 'resume_generation.billing_reconciliation_required',
      userId: input.userId,
      sessionId: input.sessionId,
      targetId: input.targetId,
      resumeGenerationId: resumeGeneration.id,
      generationIntentKey,
      type: generationType,
      error: error instanceof Error ? error.message : String(error),
      code: TOOL_ERROR_CODES.INTERNAL_ERROR,
      stage: 'finalize_credit',
    })
  }

  const persistence = await completeResumeGenerationBestEffort({
    resumeGeneration,
    sourceCvState: input.sourceCvState,
    generationResult,
  })

  recordMetricCounter('exports.completed', {
    appUserId: input.userId,
    generationIntentKey,
    generationType,
    needsReconciliation,
  })

  const output: Extract<GenerateFileOutput, { success: true }> = {
    ...generationResult.output,
    pdfUrl: previewAccess
      ? buildLockedPreviewPdfUrl(input.sessionId, input.targetId)
      : generationResult.output.pdfUrl,
    docxUrl: previewAccess ? null : generationResult.output.docxUrl ?? null,
    creditsUsed: 1,
    resumeGenerationId: persistence.resumeGenerationId,
  }

  assertNoRealArtifactForLockedPreview({
    output,
    generatedOutput,
    patch,
    sessionId: input.sessionId,
    targetId: input.targetId,
  })

  return {
    ...generationResult,
    patch,
    output,
    generatedOutput,
    resumeGeneration: persistence.resumeGeneration,
    processingStage: needsReconciliation ? 'needs_reconciliation' : 'finalize_credit',
    needsReconciliation,
  }
}
