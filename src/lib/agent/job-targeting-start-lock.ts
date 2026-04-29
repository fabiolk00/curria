import type { CVState } from '@/types/cv'

import {
  SmartGenerationStartLockBackendError,
  buildSmartGenerationStartLockFingerprint,
  markSmartGenerationStartLockCompleted,
  markSmartGenerationStartLockCompletedDurable,
  markSmartGenerationStartLockFailed,
  markSmartGenerationStartLockFailedDurable,
  markSmartGenerationStartLockRunningSession,
  markSmartGenerationStartLockRunningSessionDurable,
  resetSmartGenerationStartLocksForTests,
  tryAcquireSmartGenerationStartLock,
  tryAcquireSmartGenerationStartLockDurable,
  type SmartGenerationStartLockAcquireResult,
  type SmartGenerationStartLockBackend,
} from './smart-generation-start-lock'

export {
  SmartGenerationStartLockBackendError,
  buildSmartGenerationStartLockFingerprint,
  markSmartGenerationStartLockCompleted,
  markSmartGenerationStartLockCompletedDurable,
  markSmartGenerationStartLockFailed,
  markSmartGenerationStartLockFailedDurable,
  markSmartGenerationStartLockRunningSession,
  markSmartGenerationStartLockRunningSessionDurable,
  normalizeCvStateForLock,
  normalizeJobTargetForLock,
  resetSmartGenerationStartLocksForTests,
  tryAcquireSmartGenerationStartLock,
  tryAcquireSmartGenerationStartLockDurable,
} from './smart-generation-start-lock'
export type {
  SmartGenerationStartLockAcquireInput,
  SmartGenerationStartLockAcquireResult,
  SmartGenerationStartLockBackend,
  SmartGenerationStartLockMode,
} from './smart-generation-start-lock'

export { SmartGenerationStartLockBackendError as JobTargetingStartLockBackendError }
export type JobTargetingStartLockBackend = SmartGenerationStartLockBackend
export type JobTargetingStartLockAcquireResult = SmartGenerationStartLockAcquireResult & {
  workflowMode: 'job_targeting'
  targetJobHash: string
}

type JobTargetingStartLockInput = {
  userId: string
  cvState: CVState
  targetJobDescription: string
}

type JobTargetingStartLockInputWithNow = JobTargetingStartLockInput & {
  now?: Date
}

export function buildJobTargetingStartLockFingerprint(input: JobTargetingStartLockInput) {
  return buildSmartGenerationStartLockFingerprint({
    workflowMode: 'job_targeting',
    ...input,
  })
}

export function buildJobTargetingStartIdempotencyKey(input: JobTargetingStartLockInput): string {
  return buildJobTargetingStartLockFingerprint(input).idempotencyKey
}

export function tryAcquireJobTargetingStartLock(
  input: JobTargetingStartLockInputWithNow,
): JobTargetingStartLockAcquireResult {
  return tryAcquireSmartGenerationStartLock({
    workflowMode: 'job_targeting',
    ...input,
  }) as JobTargetingStartLockAcquireResult
}

export async function tryAcquireJobTargetingStartLockDurable(
  input: JobTargetingStartLockInputWithNow,
): Promise<JobTargetingStartLockAcquireResult> {
  return tryAcquireSmartGenerationStartLockDurable({
    workflowMode: 'job_targeting',
    ...input,
  }) as Promise<JobTargetingStartLockAcquireResult>
}

export function markJobTargetingStartLockRunningSession(input: {
  idempotencyKey: string
  sessionId: string
  backend?: JobTargetingStartLockBackend
}): void {
  markSmartGenerationStartLockRunningSession(input)
}

export async function markJobTargetingStartLockRunningSessionDurable(input: {
  idempotencyKey: string
  sessionId: string
  backend: JobTargetingStartLockBackend
}): Promise<void> {
  await markSmartGenerationStartLockRunningSessionDurable(input)
}

export function markJobTargetingStartLockCompleted(input: {
  idempotencyKey: string
  sessionId: string
  backend?: JobTargetingStartLockBackend
}): void {
  markSmartGenerationStartLockCompleted(input)
}

export async function markJobTargetingStartLockCompletedDurable(input: {
  idempotencyKey: string
  sessionId: string
  backend: JobTargetingStartLockBackend
}): Promise<void> {
  await markSmartGenerationStartLockCompletedDurable(input)
}

export function markJobTargetingStartLockFailed(input: string | {
  idempotencyKey: string
  backend?: JobTargetingStartLockBackend
}): void {
  markSmartGenerationStartLockFailed(input)
}

export async function markJobTargetingStartLockFailedDurable(input: {
  idempotencyKey: string
  backend: JobTargetingStartLockBackend
}): Promise<void> {
  await markSmartGenerationStartLockFailedDurable(input)
}

export function resetJobTargetingStartLocksForTests(): void {
  resetSmartGenerationStartLocksForTests()
}
