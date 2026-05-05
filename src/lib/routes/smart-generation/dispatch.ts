import { runAtsEnhancementPipeline } from '@/lib/agent/ats-enhancement-pipeline'
import { runJobTargetingPipeline } from '@/lib/agent/job-targeting-pipeline'
import { dispatchToolWithContext } from '@/lib/agent/tools'
import { createResumeTarget } from '@/lib/db/resume-targets'

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
  workflowMode: SmartGenerationWorkflowMode
}) {
  const target = input.workflowMode === 'job_targeting'
    ? await createResumeTarget({
        sessionId: input.patchedSession.id,
        userId: input.patchedSession.userId,
        targetJobDescription: input.patchedSession.agentState.targetJobDescription ?? '',
        derivedCvState: input.optimizedCvState,
        gapAnalysis: input.patchedSession.agentState.gapAnalysis?.result,
      })
    : undefined

  return dispatchToolWithContext(
    'generate_file',
    {
      cv_state: input.optimizedCvState,
      target_id: target?.id,
      source_scope: input.workflowMode === 'job_targeting' ? 'job-targeting' : 'ats-enhancement',
      idempotency_key: input.idempotencyKey,
    },
    input.patchedSession,
  )
}
