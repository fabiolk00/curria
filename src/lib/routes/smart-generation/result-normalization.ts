import { getHttpStatusForToolError } from '@/lib/agent/tool-errors'
import { sanitizeGeneratedCvStateForClient } from '@/lib/generated-preview/locked-preview'
import { getDisplayableTargetRole } from '@/lib/target-role'

import { assertPreviewAccessConsistency, resolvePersistedGeneratedOutput, resolvePreviewLockSummary } from './preview-access'
import type {
  SmartGenerationContext,
  SmartGenerationDecision,
  SmartGenerationPipelineResult,
  SmartGenerationWorkflowState,
} from './types'
import { buildGenerationCopy } from './workflow-mode'

export function normalizeSmartGenerationSuccess(input: {
  context: SmartGenerationContext
  sessionId: string
  optimizedCvState: import('@/types/cv').CVState
  generationResult: Awaited<ReturnType<typeof import('@/lib/agent/tools').dispatchToolWithContext>>
  workflow: SmartGenerationWorkflowState
}) : SmartGenerationDecision {
  assertPreviewAccessConsistency({ generationResult: input.generationResult })
  const output = input.generationResult.output as {
    creditsUsed?: number
    resumeGenerationId?: string
  }
  const generatedOutput = resolvePersistedGeneratedOutput(input.generationResult)
  const previewLock = resolvePreviewLockSummary(input.generationResult)
  const copy = buildGenerationCopy(input.workflow.workflowMode)
  const warnings = input.workflow.patchedSession.agentState.rewriteValidation?.softWarnings
    .map((issue) => issue.message)
    .filter(Boolean)

  return {
    kind: 'success',
    body: {
      success: true,
      sessionId: input.sessionId,
      creditsUsed: output.creditsUsed ?? 0,
      resumeGenerationId: output.resumeGenerationId,
      generationType: copy.generationType,
      originalCvState: input.context.cvState,
      optimizedCvState: sanitizeGeneratedCvStateForClient(
        input.optimizedCvState,
        generatedOutput,
        input.workflow.workflowMode === 'job_targeting' ? 'target' : 'optimized',
      ),
      previewLock,
      warnings: warnings && warnings.length > 0 ? warnings : undefined,
    },
  }
}

export function normalizeSmartGenerationPipelineFailure(input: {
  pipeline: SmartGenerationPipelineResult
  workflow: SmartGenerationWorkflowState
  sessionId: string
  patchedSession: SmartGenerationWorkflowState['patchedSession']
}): Extract<SmartGenerationDecision, { kind: 'validation_error' }> {
  if (input.pipeline.validation && !input.pipeline.validation.valid) {
    const targetRole = getDisplayableTargetRole(input.patchedSession.agentState.targetingPlan?.targetRole)

    return {
      kind: 'validation_error',
      status: 422,
      body: {
        error: input.pipeline.error ?? input.workflow.copy.pipelineError,
        sessionId: input.sessionId,
        workflowMode: input.workflow.workflowMode,
        rewriteValidation: input.pipeline.validation,
        targetRole: targetRole ?? undefined,
        targetRoleConfidence: input.patchedSession.agentState.targetingPlan?.targetRoleConfidence as
          | string
          | number
          | undefined,
      },
    }
  }

  return {
    kind: 'validation_error',
    status: 500,
    body: {
      error: input.pipeline.error ?? input.workflow.copy.pipelineError,
      reasons: input.pipeline.validation?.issues.map((issue) => issue.message),
    },
  }
}

export function normalizeSmartGenerationDispatchFailure(
  generationResult: Awaited<ReturnType<typeof import('@/lib/agent/tools').dispatchToolWithContext>>,
): Extract<SmartGenerationDecision, { kind: 'validation_error' }> {
  const code = generationResult.outputFailure?.code

  return {
    kind: 'validation_error',
    status: code ? getHttpStatusForToolError(code) : 500,
    body: {
      error: generationResult.outputFailure?.error,
      code,
    },
  }
}
