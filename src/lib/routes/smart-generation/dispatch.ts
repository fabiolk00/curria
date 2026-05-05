import { runAtsEnhancementPipeline } from '@/lib/agent/ats-enhancement-pipeline'
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
  patchedSession: PatchedSmartGenerationSession
  optimizedCvState: import('@/types/cv').CVState
  idempotencyKey: string
}) {
  return dispatchToolWithContext(
    'generate_file',
    {
      cv_state: input.optimizedCvState,
      idempotency_key: input.idempotencyKey,
    },
    input.patchedSession,
  )
}
