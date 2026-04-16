import { runAtsEnhancementPipeline } from '@/lib/agent/ats-enhancement-pipeline'
import { getSession } from '@/lib/db/sessions'
import { buildSnapshotResultRef } from '@/lib/jobs/source-of-truth'
import type { JobStatusSnapshot } from '@/types/jobs'

import type { JobProcessorOutcome } from './shared'

export async function processAtsEnhancementJob(
  job: JobStatusSnapshot,
): Promise<JobProcessorOutcome> {
  if (!job.sessionId) {
    return {
      ok: false,
      stage: 'analysis',
      errorRef: {
        kind: 'job_error',
        code: 'SESSION_REQUIRED',
        message: 'ATS enhancement jobs require a sessionId.',
        retryable: false,
      },
    }
  }

  const session = await getSession(job.sessionId, job.userId)
  if (!session) {
    return {
      ok: false,
      stage: 'analysis',
      errorRef: {
        kind: 'job_error',
        code: 'SESSION_NOT_FOUND',
        message: `Session ${job.sessionId} was not found.`,
        retryable: false,
      },
    }
  }

  const result = await runAtsEnhancementPipeline(session)
  const stage = session.agentState.atsWorkflowRun?.currentStage ?? 'persist_version'

  if (!result.success || !session.agentState.optimizedCvState) {
    return {
      ok: false,
      stage,
      errorRef: {
        kind: 'job_error',
        code: 'ATS_ENHANCEMENT_FAILED',
        message: result.error ?? 'ATS enhancement failed.',
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
