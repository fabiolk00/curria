import { validateGenerationCvState } from '@/lib/agent/tools/generate-file'
import { assessTargetJobDescriptionPreflight } from '@/lib/job-targeting/target-job-description-preflight'
import { logWarn } from '@/lib/observability/structured-log'

import type { SmartGenerationContext, SmartGenerationDecision } from './types'
import { buildGenerationCopy, resolveWorkflowMode } from './workflow-mode'

export function evaluateSmartGenerationValidation(
  context: SmartGenerationContext,
): Extract<SmartGenerationDecision, { kind: 'validation_error' }> | null {
  const copy = buildGenerationCopy(resolveWorkflowMode(context.targetJobDescription))
  const generationValidation = validateGenerationCvState(context.cvState)
  if (!generationValidation.success) {
    return {
      kind: 'validation_error',
      status: 400,
      body: {
        error: copy.incompleteError,
        reasons: [generationValidation.errorMessage],
        missingItems: [generationValidation.errorMessage],
      },
    }
  }

  if (context.targetJobDescription?.trim()) {
    const targetJobPreflight = assessTargetJobDescriptionPreflight(context.targetJobDescription)

    if (!targetJobPreflight.ok) {
      logWarn('agent.smart_generation.target_job_description_preflight_failed', {
        appUserId: context.appUser.id,
        reason: targetJobPreflight.reason,
        ...targetJobPreflight.diagnostics,
      })

      return {
        kind: 'validation_error',
        status: 422,
        body: {
          error: targetJobPreflight.message,
          code: 'INVALID_TARGET_JOB_DESCRIPTION',
          workflowMode: 'job_targeting',
          reasons: [targetJobPreflight.message],
        },
      }
    }
  }

  return null
}
