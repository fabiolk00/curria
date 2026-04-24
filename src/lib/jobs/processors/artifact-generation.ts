import { applyGeneratedOutputPatch, getSession } from '@/lib/db/sessions'
import {
  getResumeTargetForSession,
  updateResumeTargetGeneratedOutput,
} from '@/lib/db/resume-targets'
import {
  buildResumeGenerationResultRef,
} from '@/lib/jobs/source-of-truth'
import { generateBillableResume } from '@/lib/resume-generation/generate-billable-resume'
import type { CVState } from '@/types/cv'
import type { JobStatusSnapshot } from '@/types/jobs'

import type { JobProcessorOutcome } from './shared'

function resolveDispatchSnapshot(
  job: JobStatusSnapshot,
  session: Awaited<ReturnType<typeof getSession>>,
  target: Awaited<ReturnType<typeof getResumeTargetForSession>>,
): CVState | null {
  if (!session) {
    return null
  }

  switch (job.dispatchInputRef.kind) {
    case 'resume_target_cv_state':
      return target?.derivedCvState ?? null
    case 'session_cv_state':
      if (job.dispatchInputRef.snapshotSource === 'optimized') {
        return session.agentState.optimizedCvState ?? null
      }

      return session.cvState
  }
}

export async function processArtifactGenerationJob(
  job: JobStatusSnapshot,
): Promise<JobProcessorOutcome> {
  if (!job.sessionId) {
    return {
      ok: false,
      stage: 'preparing_source',
      errorRef: {
        kind: 'job_error',
        code: 'SESSION_REQUIRED',
        message: 'Artifact generation jobs require a sessionId.',
        retryable: false,
      },
    }
  }

  const session = await getSession(job.sessionId, job.userId)
  if (!session) {
    return {
      ok: false,
      stage: 'preparing_source',
      errorRef: {
        kind: 'job_error',
        code: 'SESSION_NOT_FOUND',
        message: `Session ${job.sessionId} was not found.`,
        retryable: false,
      },
    }
  }

  const targetId = job.resumeTargetId ?? (
    job.dispatchInputRef.kind === 'resume_target_cv_state'
      ? job.dispatchInputRef.resumeTargetId
      : undefined
  )
  const target = targetId
    ? await getResumeTargetForSession(session.id, targetId)
    : null

  if (targetId && !target) {
    return {
      ok: false,
      stage: 'preparing_source',
      errorRef: {
        kind: 'job_error',
        code: 'TARGET_NOT_FOUND',
        message: `Target ${targetId} was not found.`,
        retryable: false,
      },
    }
  }

  const sourceCvState = resolveDispatchSnapshot(job, session, target)
  if (!sourceCvState) {
    return {
      ok: false,
      stage: 'preparing_source',
      errorRef: {
        kind: 'job_error',
        code: 'DISPATCH_INPUT_UNAVAILABLE',
        message: 'The requested resume snapshot is no longer available for generation.',
        retryable: false,
      },
    }
  }

  const result = await generateBillableResume({
    userId: job.userId,
    sessionId: session.id,
    sourceCvState,
    targetId: target?.id,
    idempotencyKey: job.idempotencyKey,
    templateTargetSource: target?.targetJobDescription ?? session.agentState,
    resumePendingGeneration: true,
    historyContext: {
      idempotencyKey: job.idempotencyKey,
      workflowMode: session.agentState.workflowMode,
      lastRewriteMode: session.agentState.lastRewriteMode,
      targetJobDescription: target?.targetJobDescription ?? session.agentState.targetJobDescription,
      targetRole: session.agentState.targetingPlan?.targetRole,
      resumeTargetId: target?.id,
    },
  })

  if (target && result.generatedOutput) {
    await updateResumeTargetGeneratedOutput(session.id, target.id, result.generatedOutput)
  } else if (result.generatedOutput) {
    await applyGeneratedOutputPatch(session, result.generatedOutput)
  }

  if (!result.output.success) {
    if (result.resumeGeneration) {
      return {
        ok: false,
        stage: result.processingStage ?? 'generation_failed',
        errorRef: {
          kind: 'resume_generation_failure',
          resumeGenerationId: result.resumeGeneration.id,
          failureReason: result.resumeGeneration.failureReason ?? result.output.error,
        },
      }
    }

    return {
      ok: false,
      stage: 'generation_failed',
      errorRef: {
        kind: 'job_error',
        code: result.output.code,
        message: result.output.error,
        retryable: result.output.code === 'GENERATION_ERROR',
      },
    }
  }

  return {
    ok: true,
    stage: result.processingStage ?? 'completed',
    resultRef: result.resumeGeneration
      ? buildResumeGenerationResultRef(result.resumeGeneration)
      : undefined,
  }
}
