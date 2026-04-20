import { TOOL_ERROR_CODES, toolFailure } from '@/lib/agent/tool-errors'
import {
  createSignedResumeArtifactUrlsBestEffort,
  generateFile,
  validateGenerationCvState,
  type GenerateFileExecutionResult,
} from '@/lib/agent/tools/generate-file'
import { checkUserQuota, consumeCreditForGeneration } from '@/lib/asaas/quota'
import { getLatestCvVersionForScope } from '@/lib/db/cv-versions'
import {
  createPendingResumeGeneration,
  getLatestCompletedResumeGenerationForScope,
  getResumeGenerationByIdempotencyKey,
  updateResumeGeneration,
} from '@/lib/db/resume-generations'
import { logWarn, serializeError } from '@/lib/observability/structured-log'
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
}

type ResumeGenerationPersistenceResult = {
  resumeGeneration?: ResumeGeneration
  resumeGenerationId?: string
}

const BILLABLE_CV_VERSION_SOURCES = new Set(['rewrite', 'ats-enhancement', 'job-targeting', 'target-derived'])

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

function buildExistingGenerationSuccessResult(existing: ResumeGeneration): BillableGenerationResult | null {
  if (existing.status !== 'completed' || !existing.outputPdfPath) {
    return null
  }

  return {
    output: {
      success: true,
      pdfUrl: '',
      docxUrl: null,
      creditsUsed: 0,
      resumeGenerationId: existing.id,
    },
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
    resumeGeneration: existing,
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
  event: 'resume_generation.render_failed' | 'resume_generation.billing_failed'
  userId: string
  sessionId: string
  targetId?: string
  resumeGenerationId?: string
  type: ResumeGenerationType
  error?: string
  code?: string
}): void {
  logWarn(input.event, {
    userId: input.userId,
    sessionId: input.sessionId,
    targetId: input.targetId,
    resumeGenerationId: input.resumeGenerationId,
    generationType: input.type,
    stage: input.event === 'resume_generation.render_failed' ? 'render' : 'billing',
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
  templateTargetSource?: Parameters<typeof generateFile>[4]
}): Promise<BillableGenerationResult> {
  const scope: ArtifactScope = input.targetId
    ? { type: 'target', targetId: input.targetId }
    : { type: 'session' }
  const legacyGenerationId = input.targetId
    ? `legacy:${input.sessionId}:${input.targetId}`
    : `legacy:${input.sessionId}:base`

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
    }
  }

  return {
    ...generationResult,
    output: {
      ...generationResult.output,
      creditsUsed: 1,
    },
  }
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
    }
  }

  const scope: ArtifactScope = input.targetId
    ? { type: 'target', targetId: input.targetId }
    : { type: 'session' }
  const generationType = resolveGenerationType(scope)
  let resumeGeneration: ResumeGeneration | undefined
  let latestCompletedGeneration: ResumeGeneration | null = null

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

      return generateWithoutResumeGenerationPersistence({
        userId: input.userId,
        sessionId: input.sessionId,
        sourceCvState: input.sourceCvState,
        targetId: input.targetId,
        generationType,
        templateTargetSource: input.templateTargetSource,
      })
    }

    throw error
  }

  if (
    latestCompletedGeneration
    && areCvStatesEqual(input.sourceCvState, latestCompletedGeneration.generatedCvState ?? latestCompletedGeneration.sourceCvSnapshot)
  ) {
      const existingSuccess = buildExistingGenerationSuccessResult(latestCompletedGeneration)
    if (existingSuccess) {
      const signedUrls = await createSignedResumeArtifactUrlsBestEffort(
        latestCompletedGeneration.outputDocxPath,
        latestCompletedGeneration.outputPdfPath!,
        {
          userId: input.userId,
          sessionId: input.sessionId,
          targetId: input.targetId,
          pdfPath: latestCompletedGeneration.outputPdfPath!,
          source: 'existing_generation',
        },
      )

      return {
        ...existingSuccess,
        output: {
          success: true,
          pdfUrl: signedUrls.pdfUrl,
          docxUrl: signedUrls.docxUrl ?? null,
          creditsUsed: 0,
          resumeGenerationId: latestCompletedGeneration.id,
        },
      }
    }
  }

  if (input.idempotencyKey) {
    let existing: ResumeGeneration | null

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

        return generateWithoutResumeGenerationPersistence({
          userId: input.userId,
          sessionId: input.sessionId,
          sourceCvState: input.sourceCvState,
          targetId: input.targetId,
          generationType,
          templateTargetSource: input.templateTargetSource,
        })
      }

      throw error
    }

    if (existing) {
      const existingSuccess = buildExistingGenerationSuccessResult(existing)
      if (existingSuccess) {
        const signedUrls = await createSignedResumeArtifactUrlsBestEffort(
          existing.outputDocxPath,
          existing.outputPdfPath!,
          {
            userId: input.userId,
            sessionId: input.sessionId,
            targetId: input.targetId,
            pdfPath: existing.outputPdfPath!,
            source: 'idempotent_generation',
          },
        )
        return {
          ...existingSuccess,
          output: {
            success: true,
            pdfUrl: signedUrls.pdfUrl,
            docxUrl: signedUrls.docxUrl ?? null,
            creditsUsed: 0,
            resumeGenerationId: existing.id,
          },
        }
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
    }
  }

  const hasCredits = await checkUserQuota(input.userId)
  if (!hasCredits) {
    return {
      output: toolFailure(
        TOOL_ERROR_CODES.INSUFFICIENT_CREDITS,
        'Seus créditos acabaram. Gere um novo currículo quando houver saldo disponível.',
      ),
    }
  }

  if (!resumeGeneration) {
    let pendingGeneration: Awaited<ReturnType<typeof createPendingResumeGeneration>>

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

        return generateWithoutResumeGenerationPersistence({
          userId: input.userId,
          sessionId: input.sessionId,
          sourceCvState: input.sourceCvState,
          targetId: input.targetId,
          generationType,
          templateTargetSource: input.templateTargetSource,
        })
      }

      throw error
    }

    resumeGeneration = pendingGeneration.generation

    if (!pendingGeneration.wasCreated && !input.resumePendingGeneration) {
      return buildPendingGenerationInProgressResult(resumeGeneration)
    }
  }

  const generationResult: GenerateFileExecutionResult = await generateFile(
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
    logGenerationStageWarning({
      event: 'resume_generation.render_failed',
      userId: input.userId,
      sessionId: input.sessionId,
      targetId: input.targetId,
      resumeGenerationId: resumeGeneration.id,
      type: generationType,
      error: generationResult.generatedOutput?.error ?? generationResult.output.error,
      code: generationResult.output.code,
    })

    await safeUpdateResumeGeneration({
      id: resumeGeneration.id,
      status: 'failed',
      failureReason: generationResult.generatedOutput?.error ?? generationResult.output.error,
    })

    return {
      ...generationResult,
      resumeGeneration,
    }
  }

  const creditConsumed = await consumeCreditForGeneration(
    input.userId,
    resumeGeneration.id,
    generationType,
  )

  if (!creditConsumed) {
    logGenerationStageWarning({
      event: 'resume_generation.billing_failed',
      userId: input.userId,
      sessionId: input.sessionId,
      targetId: input.targetId,
      resumeGenerationId: resumeGeneration.id,
      type: generationType,
      error: 'No credits available to finalize this generation.',
      code: TOOL_ERROR_CODES.INSUFFICIENT_CREDITS,
    })

    await safeUpdateResumeGeneration({
      id: resumeGeneration.id,
      status: 'failed',
      generatedCvState: input.sourceCvState,
      failureReason: 'No credits available to finalize this generation.',
    })

    return {
      output: toolFailure(
        TOOL_ERROR_CODES.INSUFFICIENT_CREDITS,
        'Seus créditos acabaram antes de concluir esta geração. Tente novamente após recarregar seu saldo.',
      ),
      generatedOutput: {
        status: 'failed',
        error: 'No credits available to finalize this generation.',
      },
      resumeGeneration,
    }
  }

  const persistence = await completeResumeGenerationBestEffort({
    resumeGeneration,
    sourceCvState: input.sourceCvState,
    generationResult,
  })

  return {
    ...generationResult,
    output: {
      ...generationResult.output,
      creditsUsed: 1,
      resumeGenerationId: persistence.resumeGenerationId,
    },
    resumeGeneration: persistence.resumeGeneration,
  }
}
