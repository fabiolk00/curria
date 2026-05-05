import { runAtsEnhancementPipeline } from '@/lib/agent/ats-enhancement-pipeline'
import { TOOL_ERROR_CODES, toolFailure } from '@/lib/agent/tool-errors'
import { runJobTargetingPipeline } from '@/lib/agent/job-targeting-pipeline'
import { dispatchToolWithContext } from '@/lib/agent/tools'

import type { PatchedSmartGenerationSession } from './types'
import type { SmartGenerationWorkflowMode } from './workflow-mode'

export async function runSmartGenerationPipeline(
  patchedSession: PatchedSmartGenerationSession,
  workflowMode: SmartGenerationWorkflowMode,
) {
  return workflowMode === 'job_targeting'
    ? runJobTargetingPipeline(patchedSession)
    : runAtsEnhancementPipeline(patchedSession)
}

export async function dispatchSmartGenerationArtifact(input: {
  workflowMode: SmartGenerationWorkflowMode
  patchedSession: PatchedSmartGenerationSession
  optimizedCvState: import('@/types/cv').CVState
  idempotencyKey: string
  targetId?: string
}) {
  if (input.workflowMode === 'job_targeting' && !input.targetId) {
    const failure = toolFailure(
      TOOL_ERROR_CODES.PRECONDITION_FAILED,
      'Job-targeting artifact generation requires a target_id handoff.',
    )

    return {
      output: failure,
      outputJson: JSON.stringify(failure),
      outputFailure: failure,
    }
  }

  return dispatchToolWithContext(
    'generate_file',
    {
      cv_state: input.optimizedCvState,
      idempotency_key: input.idempotencyKey,
      ...(input.targetId ? { target_id: input.targetId } : {}),
    },
    input.patchedSession,
  )
}
