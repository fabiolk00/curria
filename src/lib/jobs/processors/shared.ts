import type {
  JobErrorRef,
  JobProgress,
  JobResultRef,
  JobStatusSnapshot,
} from '@/types/jobs'

export type JobProcessorSuccess = {
  ok: true
  stage?: string
  progress?: JobProgress
  resultRef: JobResultRef
}

export type JobProcessorFailure = {
  ok: false
  stage?: string
  progress?: JobProgress
  errorRef: JobErrorRef
}

export type JobProcessorOutcome = JobProcessorSuccess | JobProcessorFailure

export type ClaimedJobProcessor = (
  job: JobStatusSnapshot,
) => Promise<JobProcessorOutcome>
