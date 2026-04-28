import { createHash } from 'node:crypto'

import { Redis } from '@upstash/redis'

import { logInfo, logWarn } from '@/lib/observability/structured-log'
import type { CVState } from '@/types/cv'

const JOB_TARGETING_START_LOCK_TTL_MS = 10 * 60 * 1000
const JOB_TARGETING_START_LOCK_TTL_SECONDS = Math.ceil(JOB_TARGETING_START_LOCK_TTL_MS / 1000)

type JobTargetingStartLockStatus = 'running' | 'completed' | 'failed'
type JobTargetingStartLockBackend = 'redis' | 'memory_fallback'

type JobTargetingStartLock = {
  idempotencyKey: string
  userId: string
  targetJobHash: string
  resumeHash: string
  status: JobTargetingStartLockStatus
  sessionId?: string
  startedAt: string
  expiresAt: string
}

export type JobTargetingStartLockAcquireResult =
  | {
      acquired: true
      idempotencyKey: string
      idempotencyKeyHash: string
      targetJobHash: string
      resumeHash: string
      backend: JobTargetingStartLockBackend
      expiredLockReclaimed: boolean
    }
  | {
      acquired: false
      status: 'already_running' | 'already_completed'
      idempotencyKey: string
      idempotencyKeyHash: string
      targetJobHash: string
      resumeHash: string
      backend: JobTargetingStartLockBackend
      sessionId?: string
      message: string
    }

export class JobTargetingStartLockBackendError extends Error {
  readonly code = 'job_targeting_start_lock_backend_missing'

  constructor() {
    super('Job targeting start lock requires Redis in production.')
    this.name = 'JobTargetingStartLockBackendError'
  }
}

const locks = new Map<string, JobTargetingStartLock>()
let redisClient: Redis | null = null
let backendSelectionLogged = false

function hashValue(value: unknown): string {
  return createHash('sha256')
    .update(typeof value === 'string' ? value : JSON.stringify(value))
    .digest('hex')
}

function hashForLog(value: string): string {
  return hashValue(value).slice(0, 16)
}

function getLockBackend(): JobTargetingStartLockBackend {
  return process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? 'redis'
    : 'memory_fallback'
}

function logBackendSelection(backend: JobTargetingStartLockBackend): void {
  if (backendSelectionLogged) {
    return
  }

  backendSelectionLogged = true
  logInfo('agent.job_targeting.start_lock_backend_selected', {
    backend,
    environment: process.env.NODE_ENV,
  })

  if (backend === 'memory_fallback' && process.env.NODE_ENV === 'production') {
    logWarn('agent.job_targeting.start_lock_memory_fallback_in_production', {
      backend,
      environment: process.env.NODE_ENV,
      code: 'job_targeting_start_lock_backend_missing',
      success: false,
    })
  }
}

function getRedisClient(): Redis | null {
  const backend = getLockBackend()
  logBackendSelection(backend)

  if (backend === 'memory_fallback') {
    if (process.env.NODE_ENV === 'production') {
      throw new JobTargetingStartLockBackendError()
    }

    return null
  }

  redisClient ??= new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  })

  return redisClient
}

function isExpired(lock: JobTargetingStartLock, now = Date.now()): boolean {
  return Date.parse(lock.expiresAt) <= now
}

export function normalizeJobTargetForLock(input: string): string {
  return input
    .normalize('NFKC')
    .trim()
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .toLocaleLowerCase()
}

function normalizeString(value?: string): string {
  return (value ?? '')
    .normalize('NFKC')
    .trim()
    .replace(/\s+/gu, ' ')
}

export function normalizeCvStateForLock(cvState: CVState) {
  return {
    fullName: normalizeString(cvState.fullName),
    email: normalizeString(cvState.email).toLocaleLowerCase(),
    phone: normalizeString(cvState.phone),
    linkedin: normalizeString(cvState.linkedin).toLocaleLowerCase(),
    location: normalizeString(cvState.location),
    summary: normalizeString(cvState.summary),
    experience: cvState.experience.map((entry) => ({
      title: normalizeString(entry.title),
      company: normalizeString(entry.company),
      location: normalizeString(entry.location),
      startDate: normalizeString(entry.startDate),
      endDate: normalizeString(entry.endDate),
      bullets: entry.bullets.map(normalizeString).filter(Boolean),
    })),
    skills: cvState.skills.map(normalizeString).filter(Boolean).sort((left, right) => left.localeCompare(right)),
    education: cvState.education.map((entry) => ({
      degree: normalizeString(entry.degree),
      institution: normalizeString(entry.institution),
      year: normalizeString(entry.year),
    })).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
    certifications: (cvState.certifications ?? []).map((entry) => ({
      name: normalizeString(entry.name),
      issuer: normalizeString(entry.issuer),
      year: normalizeString(entry.year),
    })).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
  }
}

export function buildJobTargetingStartLockFingerprint(input: {
  userId: string
  cvState: CVState
  targetJobDescription: string
}) {
  const resumeHash = hashValue(normalizeCvStateForLock(input.cvState))
  const targetJobHash = hashValue(normalizeJobTargetForLock(input.targetJobDescription))
  const idempotencyKey = [
    'job-targeting-start',
    input.userId,
    resumeHash.slice(0, 32),
    targetJobHash.slice(0, 32),
  ].join(':')

  return {
    idempotencyKey,
    idempotencyKeyHash: hashForLog(idempotencyKey),
    resumeHash,
    targetJobHash,
  }
}

export function buildJobTargetingStartIdempotencyKey(input: {
  userId: string
  cvState: CVState
  targetJobDescription: string
}): string {
  return buildJobTargetingStartLockFingerprint(input).idempotencyKey
}

function logLockEvent(event: string, input: {
  userId: string
  sessionId?: string
  idempotencyKeyHash: string
  targetJobHash: string
  resumeHash: string
  backend: JobTargetingStartLockBackend
  status: string
  expiredLockReclaimed?: boolean
}): void {
  logInfo(event, input)
}

function buildLock(input: {
  userId: string
  idempotencyKey: string
  targetJobHash: string
  resumeHash: string
  now: Date
}): JobTargetingStartLock {
  return {
    idempotencyKey: input.idempotencyKey,
    userId: input.userId,
    targetJobHash: input.targetJobHash,
    resumeHash: input.resumeHash,
    status: 'running',
    startedAt: input.now.toISOString(),
    expiresAt: new Date(input.now.getTime() + JOB_TARGETING_START_LOCK_TTL_MS).toISOString(),
  }
}

export function tryAcquireJobTargetingStartLock(input: {
  userId: string
  cvState: CVState
  targetJobDescription: string
  now?: Date
}): JobTargetingStartLockAcquireResult {
  const backend: JobTargetingStartLockBackend = 'memory_fallback'
  logBackendSelection(backend)

  const now = input.now ?? new Date()
  const fingerprint = buildJobTargetingStartLockFingerprint(input)
  const existing = locks.get(fingerprint.idempotencyKey)
  const expiredLockReclaimed = Boolean(existing && isExpired(existing, now.getTime()))

  if (existing && !expiredLockReclaimed) {
    if (existing.status === 'running' || existing.status === 'completed') {
      const status = existing.status === 'running' ? 'already_running' : 'already_completed'
      logLockEvent('agent.job_targeting.start_lock_conflict', {
        userId: input.userId,
        sessionId: existing.sessionId,
        idempotencyKeyHash: fingerprint.idempotencyKeyHash,
        targetJobHash: fingerprint.targetJobHash,
        resumeHash: fingerprint.resumeHash,
        backend,
        status,
      })

      return {
        acquired: false,
        status,
        ...fingerprint,
        backend,
        sessionId: existing.sessionId,
        message: status === 'already_running'
          ? 'Essa adaptação já está em andamento.'
          : 'Essa adaptação já foi gerada.',
      }
    }
  }

  if (expiredLockReclaimed) {
    logLockEvent('agent.job_targeting.start_lock_expired_reclaimed', {
      userId: input.userId,
      sessionId: existing?.sessionId,
      idempotencyKeyHash: fingerprint.idempotencyKeyHash,
      targetJobHash: fingerprint.targetJobHash,
      resumeHash: fingerprint.resumeHash,
      backend,
      status: existing?.status ?? 'expired',
    })
  }

  const lock = buildLock({
    userId: input.userId,
    idempotencyKey: fingerprint.idempotencyKey,
    targetJobHash: fingerprint.targetJobHash,
    resumeHash: fingerprint.resumeHash,
    now,
  })
  locks.set(fingerprint.idempotencyKey, lock)
  logLockEvent('agent.job_targeting.start_lock_acquired', {
    userId: input.userId,
    idempotencyKeyHash: fingerprint.idempotencyKeyHash,
    targetJobHash: fingerprint.targetJobHash,
    resumeHash: fingerprint.resumeHash,
    backend,
    status: 'running',
    expiredLockReclaimed,
  })

  return {
    acquired: true,
    ...fingerprint,
    backend,
    expiredLockReclaimed,
  }
}

export async function tryAcquireJobTargetingStartLockDurable(input: {
  userId: string
  cvState: CVState
  targetJobDescription: string
  now?: Date
}): Promise<JobTargetingStartLockAcquireResult> {
  const redis = getRedisClient()
  if (!redis) {
    return tryAcquireJobTargetingStartLock(input)
  }

  const backend: JobTargetingStartLockBackend = 'redis'
  const now = input.now ?? new Date()
  const fingerprint = buildJobTargetingStartLockFingerprint(input)
  const lock = buildLock({
    userId: input.userId,
    idempotencyKey: fingerprint.idempotencyKey,
    targetJobHash: fingerprint.targetJobHash,
    resumeHash: fingerprint.resumeHash,
    now,
  })
  const acquired = await redis.set(fingerprint.idempotencyKey, lock, {
    nx: true,
    ex: JOB_TARGETING_START_LOCK_TTL_SECONDS,
  })

  if (acquired) {
    locks.set(fingerprint.idempotencyKey, lock)
    logLockEvent('agent.job_targeting.start_lock_acquired', {
      userId: input.userId,
      idempotencyKeyHash: fingerprint.idempotencyKeyHash,
      targetJobHash: fingerprint.targetJobHash,
      resumeHash: fingerprint.resumeHash,
      backend,
      status: 'running',
      expiredLockReclaimed: false,
    })
    return {
      acquired: true,
      ...fingerprint,
      backend,
      expiredLockReclaimed: false,
    }
  }

  const existing = await redis.get<JobTargetingStartLock>(fingerprint.idempotencyKey)
  const status = existing?.status === 'completed' ? 'already_completed' : 'already_running'
  logLockEvent('agent.job_targeting.start_lock_conflict', {
    userId: input.userId,
    sessionId: existing?.sessionId,
    idempotencyKeyHash: fingerprint.idempotencyKeyHash,
    targetJobHash: fingerprint.targetJobHash,
    resumeHash: fingerprint.resumeHash,
    backend,
    status,
  })

  return {
    acquired: false,
    status,
    ...fingerprint,
    backend,
    sessionId: existing?.sessionId,
    message: status === 'already_running'
      ? 'Essa adaptação já está em andamento.'
      : 'Essa adaptação já foi gerada.',
  }
}

export function markJobTargetingStartLockCompleted(input: {
  idempotencyKey: string
  sessionId: string
}): void {
  const lock = locks.get(input.idempotencyKey)
  if (!lock) {
    return
  }

  const nextLock = {
    ...lock,
    status: 'completed' as const,
    sessionId: input.sessionId,
  }
  locks.set(input.idempotencyKey, nextLock)
  logLockEvent('agent.job_targeting.start_lock_completed', {
    userId: lock.userId,
    sessionId: input.sessionId,
    idempotencyKeyHash: hashForLog(input.idempotencyKey),
    targetJobHash: lock.targetJobHash,
    resumeHash: lock.resumeHash,
    backend: 'memory_fallback',
    status: 'completed',
  })
}

export async function markJobTargetingStartLockCompletedDurable(input: {
  idempotencyKey: string
  sessionId: string
}): Promise<void> {
  markJobTargetingStartLockCompleted(input)
  const redis = getRedisClient()
  const lock = locks.get(input.idempotencyKey)
  if (!redis || !lock) {
    return
  }

  await redis.set(input.idempotencyKey, lock, {
    ex: JOB_TARGETING_START_LOCK_TTL_SECONDS,
  })
}

export function markJobTargetingStartLockRunningSession(input: {
  idempotencyKey: string
  sessionId: string
}): void {
  const lock = locks.get(input.idempotencyKey)
  if (!lock || lock.status !== 'running') {
    return
  }

  locks.set(input.idempotencyKey, {
    ...lock,
    sessionId: input.sessionId,
  })
}

export async function markJobTargetingStartLockRunningSessionDurable(input: {
  idempotencyKey: string
  sessionId: string
}): Promise<void> {
  markJobTargetingStartLockRunningSession(input)
  const redis = getRedisClient()
  const lock = locks.get(input.idempotencyKey)
  if (!redis || !lock) {
    return
  }

  await redis.set(input.idempotencyKey, lock, {
    ex: JOB_TARGETING_START_LOCK_TTL_SECONDS,
  })
}

export function markJobTargetingStartLockFailed(idempotencyKey: string): void {
  const lock = locks.get(idempotencyKey)
  if (!lock) {
    return
  }

  locks.set(idempotencyKey, {
    ...lock,
    status: 'failed',
    expiresAt: new Date().toISOString(),
  })
  logLockEvent('agent.job_targeting.start_lock_failed', {
    userId: lock.userId,
    sessionId: lock.sessionId,
    idempotencyKeyHash: hashForLog(idempotencyKey),
    targetJobHash: lock.targetJobHash,
    resumeHash: lock.resumeHash,
    backend: 'memory_fallback',
    status: 'failed',
  })
}

export async function markJobTargetingStartLockFailedDurable(idempotencyKey: string): Promise<void> {
  markJobTargetingStartLockFailed(idempotencyKey)
  const redis = getRedisClient()
  if (!redis) {
    return
  }

  await redis.del(idempotencyKey)
}

export function resetJobTargetingStartLocksForTests(): void {
  locks.clear()
  backendSelectionLogged = false
  redisClient = null
}
