import { runJobTargetingPipeline } from '@/lib/agent/job-targeting-pipeline'
import { getSession } from '@/lib/db/sessions'
import { buildSnapshotResultRef } from '@/lib/jobs/source-of-truth'
import type { JobStatusSnapshot } from '@/types/jobs'

import type { JobProcessorOutcome } from './shared'

export async function processJobTargetingJob(
  job: JobStatusSnapshot,
): Promise<JobProcessorOutcome> {
  if (!job.sessionId) {
    return {
      ok: false,
      stage: 'gap_analysis',
      errorRef: {
        kind: 'job_error',
        code: 'SESSION_REQUIRED',
        message: 'Job targeting jobs require a sessionId.',
        retryable: false,
      },
    }
  }

  const session = await getSession(job.sessionId, job.userId)
  if (!session) {
    return {
      ok: false,
      stage: 'gap_analysis',
      errorRef: {
        kind: 'job_error',
        code: 'SESSION_NOT_FOUND',
        message: `Session ${job.sessionId} was not found.`,
        retryable: false,
      },
    }
  }

  const result = await runJobTargetingPipeline(session)
  const stage = session.agentState.atsWorkflowRun?.currentStage ?? 'persist_version'

  if (!result.success || !session.agentState.optimizedCvState) {
    return {
      ok: false,
      stage,
      errorRef: {
        kind: 'job_error',
        code: 'JOB_TARGETING_FAILED',
        message: result.error ?? 'Job targeting failed.',
        retryable: false,
      },
    }
  }

  return {
    ok: true,
    stage,
    resultRef: buildSnapshotResultRef({
      sessionId: session.id,
      snapshotSource: 'optimized',
    }),
  }
}
