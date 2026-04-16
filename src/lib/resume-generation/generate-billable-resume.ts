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

const BILLABLE_CV_VERSION_SOURCES = new Set(['rewrite', 'ats-enhancement', 'job-targeting', 'target-derived'])

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

export async function generateBillableResume(input: {
  userId: string
  sessionId: string
  sourceCvState: GenerateFileInput['cv_state']
  targetId?: string
  idempotencyKey?: string
  templateTargetSource?: Parameters<typeof generateFile>[4]
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
  const latestCompletedGeneration = await getLatestCompletedResumeGenerationForScope({
    userId: input.userId,
    sessionId: input.sessionId,
    resumeTargetId: input.targetId,
    type: generationType,
  })

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
    const existing = await getResumeGenerationByIdempotencyKey(input.userId, input.idempotencyKey)
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
        return buildPendingGenerationInProgressResult(existing)
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

  const pendingGeneration = await createPendingResumeGeneration({
    userId: input.userId,
    sessionId: input.sessionId,
    resumeTargetId: input.targetId,
    type: generationType,
    idempotencyKey: input.idempotencyKey,
    sourceCvSnapshot: input.sourceCvState,
  })
  const resumeGeneration = pendingGeneration.generation

  if (!pendingGeneration.wasCreated) {
    return buildPendingGenerationInProgressResult(resumeGeneration)
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
    await updateResumeGeneration({
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
    await updateResumeGeneration({
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

  const completedGeneration = await updateResumeGeneration({
    id: resumeGeneration.id,
    status: 'completed',
    generatedCvState: input.sourceCvState,
    outputPdfPath: generationResult.generatedOutput?.pdfPath,
    outputDocxPath: generationResult.generatedOutput?.docxPath,
  })

  return {
    ...generationResult,
    output: {
      ...generationResult.output,
      creditsUsed: 1,
      resumeGenerationId: completedGeneration.id,
    },
    resumeGeneration: completedGeneration,
  }
}
