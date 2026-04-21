import type { JobStatusSnapshot } from '@/types/jobs'

import { hasConfirmedCareerFitOverride, requiresCareerFitWarning } from '@/lib/agent/profile-review'
import { listActiveJobsForUser } from '@/lib/jobs/repository'

import type { SessionGenerateContext, SessionGeneratePolicyDecision } from './types'

function isActiveArtifactJob(job: JobStatusSnapshot): boolean {
  return job.status === 'queued' || job.status === 'running'
}

function isSameArtifactScope(
  context: SessionGenerateContext,
  job: JobStatusSnapshot,
): boolean {
  if (job.sessionId !== context.session.id) {
    return false
  }

  if (context.target?.id) {
    return job.resumeTargetId === context.target.id
  }

  return job.resumeTargetId == null
}

export function isBillingReconciliationPending(job: JobStatusSnapshot): boolean {
  return (
    (job.status === 'failed' || job.status === 'cancelled')
    && (job.stage === 'release_credit' || job.stage === 'needs_reconciliation')
  )
}

export async function evaluateSessionGeneratePolicy(
  context: SessionGenerateContext,
): Promise<SessionGeneratePolicyDecision> {
  if (context.scope === 'target' && requiresCareerFitWarning(context.session) && !hasConfirmedCareerFitOverride(context.session)) {
    return { kind: 'blocked_career_fit_confirmation' }
  }

  const activeArtifactJobs = await listActiveJobsForUser({
    userId: context.appUser.id,
    type: 'artifact_generation',
    limit: 5,
  })

  const conflictingActiveJob = activeArtifactJobs.find((job) => (
    isSameArtifactScope(context, job)
    && job.idempotencyKey !== context.primaryIdempotencyKey
    && isActiveArtifactJob(job)
  ))

  if (conflictingActiveJob) {
    return { kind: 'blocked_active_export', conflictingJob: conflictingActiveJob }
  }

  return { kind: 'allow' }
}
