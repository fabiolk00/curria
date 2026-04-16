export type AgentActionType =
  | 'chat'
  | 'ats_enhancement'
  | 'job_targeting'
  | 'artifact_generation'

export type SyncActionType = 'chat'
export type ExecutionMode = 'sync' | 'async'
export type JobType = 'ats_enhancement' | 'job_targeting' | 'artifact_generation'
export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'

export type JobProgress = {
  percent?: number
  label?: string
}

export type SessionResumeSnapshotSource = 'base' | 'optimized'
export type ResultSnapshotSource = 'base' | 'optimized' | 'target_derived'

export type JobInputRef =
  | {
      kind: 'session_cv_state'
      sessionId: string
      snapshotSource: SessionResumeSnapshotSource
    }
  | {
      kind: 'resume_target_cv_state'
      sessionId: string
      resumeTargetId: string
      snapshotSource: 'target_derived'
    }

export type JobResultRef =
  | {
      kind: 'resume_generation'
      resumeGenerationId: string
      sessionId?: string
      resumeTargetId?: string
      versionNumber: number
      snapshotSource: 'source' | 'generated'
    }
  | {
      kind: 'session_cv_state'
      sessionId: string
      snapshotSource: SessionResumeSnapshotSource
    }
  | {
      kind: 'resume_target_cv_state'
      sessionId: string
      resumeTargetId: string
      snapshotSource: 'target_derived'
    }

export type JobErrorRef =
  | {
      kind: 'job_error'
      code: string
      message: string
      retryable?: boolean
    }
  | {
      kind: 'resume_generation_failure'
      resumeGenerationId: string
      failureReason?: string
    }

export type JobStatusSnapshot = {
  jobId: string
  userId: string
  sessionId?: string
  resumeTargetId?: string
  idempotencyKey: string
  type: JobType
  status: JobStatus
  stage?: string
  progress?: JobProgress
  dispatchInputRef: JobInputRef
  terminalResultRef?: JobResultRef
  terminalErrorRef?: JobErrorRef
  claimedAt?: string
  startedAt?: string
  completedAt?: string
  cancelledAt?: string
  createdAt: string
  updatedAt: string
}

export type DurableJobDispatchPayload = {
  jobId: string
  userId: string
  sessionId?: string
  resumeTargetId?: string
  actionType: JobType
  executionMode: 'async'
  idempotencyKey: string
  requestedAt: string
  inputRef: JobInputRef
  resultRef?: JobResultRef
  errorRef?: JobErrorRef
}

export const AGENT_ACTION_TYPES = [
  'chat',
  'ats_enhancement',
  'job_targeting',
  'artifact_generation',
] as const satisfies readonly AgentActionType[]

export const SYNC_ACTION_TYPES = [
  'chat',
] as const satisfies readonly SyncActionType[]

export const JOB_TYPES = [
  'ats_enhancement',
  'job_targeting',
  'artifact_generation',
] as const satisfies readonly JobType[]

export const JOB_STATUSES = [
  'queued',
  'running',
  'completed',
  'failed',
  'cancelled',
] as const satisfies readonly JobStatus[]

export function isSyncActionType(actionType: AgentActionType): actionType is SyncActionType {
  return actionType === 'chat'
}

export function isJobType(actionType: AgentActionType): actionType is JobType {
  return actionType !== 'chat'
}

export function resolveExecutionMode(actionType: AgentActionType): ExecutionMode {
  return isSyncActionType(actionType) ? 'sync' : 'async'
}
