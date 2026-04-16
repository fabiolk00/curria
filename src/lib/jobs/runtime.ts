import {
  claimJob,
  completeJob,
  failJob,
} from '@/lib/jobs/repository'
import { logError, logInfo, logWarn } from '@/lib/observability/structured-log'
import type {
  JobErrorRef,
  JobStatusSnapshot,
  JobType,
} from '@/types/jobs'

import { processAtsEnhancementJob } from './processors/ats-enhancement'
import { processArtifactGenerationJob } from './processors/artifact-generation'
import { processJobTargetingJob } from './processors/job-targeting'
import type { ClaimedJobProcessor } from './processors/shared'

const JOB_PROCESSORS: Record<JobType, ClaimedJobProcessor> = {
  ats_enhancement: processAtsEnhancementJob,
  job_targeting: processJobTargetingJob,
  artifact_generation: processArtifactGenerationJob,
}

function buildUnexpectedProcessorErrorRef(
  error: unknown,
): Extract<JobErrorRef, { kind: 'job_error' }> {
  return {
    kind: 'job_error',
    code: 'UNEXPECTED_PROCESSOR_ERROR',
    message: error instanceof Error ? error.message : String(error),
    retryable: true,
  }
}

async function persistProcessorFailure(
  job: JobStatusSnapshot,
  errorRef: JobErrorRef,
  stage?: string,
): Promise<void> {
  if (!job.claimedAt) {
    logError('jobs.runtime.failure_without_claim', {
      jobId: job.jobId,
      userId: job.userId,
      type: job.type,
      stage,
      errorCode: errorRef.kind === 'job_error' ? errorRef.code : 'resume_generation_failure',
      errorMessage: errorRef.kind === 'job_error' ? errorRef.message : errorRef.failureReason,
    })
    return
  }

  await failJob({
    jobId: job.jobId,
    userId: job.userId,
    ownerClaimedAt: job.claimedAt,
    stage,
    errorRef,
  })
}

async function processClaimedJob(job: JobStatusSnapshot): Promise<void> {
  const processor = JOB_PROCESSORS[job.type]
  if (!processor) {
    await persistProcessorFailure(job, {
      kind: 'job_error',
      code: 'UNSUPPORTED_JOB_TYPE',
      message: `Unsupported job type: ${job.type}`,
      retryable: false,
    })
    return
  }

  logInfo('jobs.runtime.processing_started', {
    jobId: job.jobId,
    userId: job.userId,
    sessionId: job.sessionId,
    resumeTargetId: job.resumeTargetId,
    type: job.type,
    stage: job.stage,
  })

  try {
    const outcome = await processor(job)

    if (!job.claimedAt) {
      throw new Error(`Claimed job ${job.jobId} is missing claimedAt.`)
    }

    if (outcome.ok) {
      await completeJob({
        jobId: job.jobId,
        userId: job.userId,
        ownerClaimedAt: job.claimedAt,
        stage: outcome.stage,
        progress: outcome.progress,
        resultRef: outcome.resultRef,
      })

      logInfo('jobs.runtime.processing_completed', {
        jobId: job.jobId,
        userId: job.userId,
        sessionId: job.sessionId,
        resumeTargetId: job.resumeTargetId,
        type: job.type,
        stage: outcome.stage,
      })
      return
    }

    await persistProcessorFailure(job, outcome.errorRef, outcome.stage)

    logWarn('jobs.runtime.processing_failed', {
      jobId: job.jobId,
      userId: job.userId,
      sessionId: job.sessionId,
      resumeTargetId: job.resumeTargetId,
      type: job.type,
      stage: outcome.stage,
      errorCode: outcome.errorRef.kind === 'job_error'
        ? outcome.errorRef.code
        : 'resume_generation_failure',
      errorMessage: outcome.errorRef.kind === 'job_error'
        ? outcome.errorRef.message
        : outcome.errorRef.failureReason,
    })
  } catch (error) {
    const errorRef = buildUnexpectedProcessorErrorRef(error)

    logError('jobs.runtime.processing_threw', {
      jobId: job.jobId,
      userId: job.userId,
      sessionId: job.sessionId,
      resumeTargetId: job.resumeTargetId,
      type: job.type,
      errorCode: errorRef.code,
      errorMessage: errorRef.message,
    })

    try {
      await persistProcessorFailure(job, errorRef, job.stage)
    } catch (persistError) {
      logError('jobs.runtime.processing_failure_persist_failed', {
        jobId: job.jobId,
        userId: job.userId,
        sessionId: job.sessionId,
        resumeTargetId: job.resumeTargetId,
        type: job.type,
        errorMessage: persistError instanceof Error ? persistError.message : String(persistError),
      })
    }
  }
}

export async function startDurableJobProcessing(input: {
  jobId: string
  userId: string
}): Promise<JobStatusSnapshot | null> {
  const claimed = await claimJob({
    jobId: input.jobId,
    userId: input.userId,
    stage: 'processing',
  })

  if (!claimed) {
    return null
  }

  if (claimed.status !== 'running') {
    return claimed
  }

  queueMicrotask(() => {
    void processClaimedJob(claimed)
  })

  return claimed
}
