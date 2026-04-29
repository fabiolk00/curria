import { createHash } from 'node:crypto'

import { Redis } from '@upstash/redis'

import { logError, logInfo, logWarn } from '@/lib/observability/structured-log'
import type { SmartGenerationWorkflowMode } from '@/lib/routes/smart-generation/workflow-mode'
import type { CVState } from '@/types/cv'

const SMART_GENERATION_START_LOCK_TTL_MS = 10 * 60 * 1000
const SMART_GENERATION_START_LOCK_TTL_SECONDS = Math.ceil(SMART_GENERATION_START_LOCK_TTL_MS / 1000)

type SmartGenerationStartLockStatus = 'running' | 'completed' | 'failed'
export type SmartGenerationStartLockBackend = 'redis' | 'memory_fallback'
export type SmartGenerationStartLockMode = 'ats_enhancement' | 'job_targeting'

type SmartGenerationStartLock = {
  idempotencyKey: string
  workflowMode: SmartGenerationWorkflowMode
  userId: string
  targetJobHash?: string
  resumeHash: string
  status: SmartGenerationStartLockStatus
  sessionId?: string
  startedAt: string
  expiresAt: string
}

type SmartGenerationStartLockFingerprint =
  | {
      idempotencyKey: string
      idempotencyKeyHash: string
      workflowMode: 'ats_enhancement'
      resumeHash: string
      targetJobHash?: undefined
    }
  | {
      idempotencyKey: string
      idempotencyKeyHash: string
      workflowMode: 'job_targeting'
      resumeHash: string
      targetJobHash: string
    }

export type SmartGenerationStartLockAcquireInput =
  | {
      workflowMode: 'ats_enhancement'
      userId: string
      cvState: CVState
      targetJobDescription?: never
    }
  | {
      workflowMode: 'job_targeting'
      userId: string
      cvState: CVState
      targetJobDescription: string
    }

export type SmartGenerationStartLockAcquireResult =
  | {
      acquired: true
      idempotencyKey: string
      idempotencyKeyHash: string
      workflowMode: SmartGenerationWorkflowMode
      targetJobHash?: string
      resumeHash: string
      backend: SmartGenerationStartLockBackend
      expiredLockReclaimed: boolean
    }
  | {
      acquired: false
      status: 'already_running' | 'already_completed'
      idempotencyKey: string
      idempotencyKeyHash: string
      workflowMode: SmartGenerationWorkflowMode
      targetJobHash?: string
      resumeHash: string
      backend: SmartGenerationStartLockBackend
      sessionId?: string
      message: string
    }

export class SmartGenerationStartLockBackendError extends Error {
  readonly code = 'smart_generation_start_lock_backend_missing'

  constructor() {
    super('Smart generation start lock requires Redis in production.')
    this.name = 'SmartGenerationStartLockBackendError'
  }
}

const locks = new Map<string, SmartGenerationStartLock>()
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

function getLockBackend(): SmartGenerationStartLockBackend {
  return process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? 'redis'
    : 'memory_fallback'
}

function logBackendSelection(backend: SmartGenerationStartLockBackend): void {
  if (backendSelectionLogged) {
    return
  }

  backendSelectionLogged = true
  logInfo('agent.smart_generation.start_lock_backend_selected', {
    backend,
    environment: process.env.NODE_ENV,
  })

  if (backend === 'memory_fallback' && process.env.NODE_ENV === 'production') {
    logWarn('agent.smart_generation.start_lock_memory_fallback_in_production', {
      backend,
      environment: process.env.NODE_ENV,
      code: 'smart_generation_start_lock_backend_missing',
      success: false,
    })
  }
}

function getRedisClient(): Redis | null {
  const backend = getLockBackend()
  logBackendSelection(backend)

  if (backend === 'memory_fallback') {
    if (process.env.NODE_ENV === 'production') {
      throw new SmartGenerationStartLockBackendError()
    }

    return null
  }

  redisClient ??= new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  })

  return redisClient
}

function isExpired(lock: SmartGenerationStartLock, now = Date.now()): boolean {
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

export function buildSmartGenerationStartLockFingerprint(
  input: SmartGenerationStartLockAcquireInput,
): SmartGenerationStartLockFingerprint {
  const resumeHash = hashValue(normalizeCvStateForLock(input.cvState))
  const targetJobHash = input.workflowMode === 'job_targeting'
    ? hashValue(normalizeJobTargetForLock(input.targetJobDescription))
    : undefined
  const idempotencyKey = [
    input.workflowMode === 'job_targeting' ? 'job-targeting-start' : 'ats-enhancement-start',
    input.userId,
    resumeHash.slice(0, 32),
    ...(targetJobHash ? [targetJobHash.slice(0, 32)] : []),
  ].join(':')

  if (input.workflowMode === 'job_targeting') {
    return {
      idempotencyKey,
      idempotencyKeyHash: hashForLog(idempotencyKey),
      workflowMode: 'job_targeting',
      resumeHash,
      targetJobHash: targetJobHash!,
    }
  }

  return {
    idempotencyKey,
    idempotencyKeyHash: hashForLog(idempotencyKey),
    workflowMode: 'ats_enhancement',
    resumeHash,
  }
}

function logLockEvent(event: string, input: {
  workflowMode: SmartGenerationWorkflowMode
  userId: string
  sessionId?: string
  idempotencyKeyHash: string
  targetJobHash?: string
  resumeHash: string
  backend: SmartGenerationStartLockBackend
  status: string
  expiredLockReclaimed?: boolean
}): void {
  logInfo(event, input)
}

function buildLock(input: {
  userId: string
  idempotencyKey: string
  workflowMode: SmartGenerationWorkflowMode
  targetJobHash?: string
  resumeHash: string
  now: Date
}): SmartGenerationStartLock {
  return {
    idempotencyKey: input.idempotencyKey,
    workflowMode: input.workflowMode,
    userId: input.userId,
    targetJobHash: input.targetJobHash,
    resumeHash: input.resumeHash,
    status: 'running',
    startedAt: input.now.toISOString(),
    expiresAt: new Date(input.now.getTime() + SMART_GENERATION_START_LOCK_TTL_MS).toISOString(),
  }
}

function buildDuplicateMessage(input: {
  workflowMode: SmartGenerationWorkflowMode
  status: 'already_running' | 'already_completed'
}): string {
  if (input.workflowMode === 'job_targeting') {
    return input.status === 'already_running'
      ? 'Essa adaptaÃ§Ã£o jÃ¡ estÃ¡ em andamento.'
      : 'Essa adaptaÃ§Ã£o jÃ¡ foi gerada.'
  }

  return input.status === 'already_running'
    ? 'Essa versÃ£o ATS jÃ¡ estÃ¡ em andamento.'
    : 'Essa versÃ£o ATS jÃ¡ foi gerada.'
}

export function tryAcquireSmartGenerationStartLock(
  input: SmartGenerationStartLockAcquireInput & { now?: Date },
): SmartGenerationStartLockAcquireResult {
  const backend: SmartGenerationStartLockBackend = 'memory_fallback'
  logBackendSelection(backend)

  const now = input.now ?? new Date()
  const fingerprint = buildSmartGenerationStartLockFingerprint(input)
  const existing = locks.get(fingerprint.idempotencyKey)
  const expiredLockReclaimed = Boolean(existing && isExpired(existing, now.getTime()))

  if (existing && !expiredLockReclaimed) {
    if (existing.status === 'running' || existing.status === 'completed') {
      const status = existing.status === 'running' ? 'already_running' : 'already_completed'
      logLockEvent('agent.smart_generation.start_lock_conflict', {
        workflowMode: input.workflowMode,
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
        message: buildDuplicateMessage({
          workflowMode: input.workflowMode,
          status,
        }),
      }
    }
  }

  if (expiredLockReclaimed) {
    logLockEvent('agent.smart_generation.start_lock_expired_reclaimed', {
      workflowMode: input.workflowMode,
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
    workflowMode: input.workflowMode,
    targetJobHash: fingerprint.targetJobHash,
    resumeHash: fingerprint.resumeHash,
    now,
  })
  locks.set(fingerprint.idempotencyKey, lock)
  logLockEvent('agent.smart_generation.start_lock_acquired', {
    workflowMode: input.workflowMode,
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

export async function tryAcquireSmartGenerationStartLockDurable(
  input: SmartGenerationStartLockAcquireInput & { now?: Date },
): Promise<SmartGenerationStartLockAcquireResult> {
  const redis = getRedisClient()
  if (!redis) {
    return tryAcquireSmartGenerationStartLock(input)
  }

  const backend: SmartGenerationStartLockBackend = 'redis'
  const now = input.now ?? new Date()
  const fingerprint = buildSmartGenerationStartLockFingerprint(input)
  const lock = buildLock({
    userId: input.userId,
    idempotencyKey: fingerprint.idempotencyKey,
    workflowMode: input.workflowMode,
    targetJobHash: fingerprint.targetJobHash,
    resumeHash: fingerprint.resumeHash,
    now,
  })
  const acquired = await redis.set(fingerprint.idempotencyKey, lock, {
    nx: true,
    ex: SMART_GENERATION_START_LOCK_TTL_SECONDS,
  })

  if (acquired) {
    locks.set(fingerprint.idempotencyKey, lock)
    logLockEvent('agent.smart_generation.start_lock_acquired', {
      workflowMode: input.workflowMode,
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

  const existing = await redis.get<SmartGenerationStartLock>(fingerprint.idempotencyKey)
  const status = existing?.status === 'completed' ? 'already_completed' : 'already_running'
  logLockEvent('agent.smart_generation.start_lock_conflict', {
    workflowMode: input.workflowMode,
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
    message: buildDuplicateMessage({
      workflowMode: input.workflowMode,
      status,
    }),
  }
}

export function markSmartGenerationStartLockCompleted(input: {
  idempotencyKey: string
  sessionId: string
  backend?: SmartGenerationStartLockBackend
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
  logLockEvent('agent.smart_generation.start_lock_completed', {
    workflowMode: lock.workflowMode,
    userId: lock.userId,
    sessionId: input.sessionId,
    idempotencyKeyHash: hashForLog(input.idempotencyKey),
    targetJobHash: lock.targetJobHash,
    resumeHash: lock.resumeHash,
    backend: input.backend ?? 'memory_fallback',
    status: 'completed',
  })
}

export async function markSmartGenerationStartLockCompletedDurable(input: {
  idempotencyKey: string
  sessionId: string
  backend: SmartGenerationStartLockBackend
}): Promise<void> {
  markSmartGenerationStartLockCompleted(input)
  const redis = input.backend === 'redis' ? getRedisClient() : null
  const lock = locks.get(input.idempotencyKey)
  if (!redis || !lock) {
    return
  }

  await redis.set(input.idempotencyKey, lock, {
    ex: SMART_GENERATION_START_LOCK_TTL_SECONDS,
  })
}

export function markSmartGenerationStartLockRunningSession(input: {
  idempotencyKey: string
  sessionId: string
  backend?: SmartGenerationStartLockBackend
}): void {
  const lock = locks.get(input.idempotencyKey)
  if (!lock || lock.status !== 'running') {
    return
  }

  const nextLock = {
    ...lock,
    sessionId: input.sessionId,
  }
  locks.set(input.idempotencyKey, nextLock)
  logLockEvent('agent.smart_generation.start_lock_running_session_marked', {
    workflowMode: lock.workflowMode,
    userId: lock.userId,
    sessionId: input.sessionId,
    idempotencyKeyHash: hashForLog(input.idempotencyKey),
    targetJobHash: lock.targetJobHash,
    resumeHash: lock.resumeHash,
    backend: input.backend ?? 'memory_fallback',
    status: 'running',
  })
}

export async function markSmartGenerationStartLockRunningSessionDurable(input: {
  idempotencyKey: string
  sessionId: string
  backend: SmartGenerationStartLockBackend
}): Promise<void> {
  markSmartGenerationStartLockRunningSession(input)
  const redis = input.backend === 'redis' ? getRedisClient() : null
  const lock = locks.get(input.idempotencyKey)
  if (!redis || !lock) {
    return
  }

  await redis.set(input.idempotencyKey, lock, {
    ex: SMART_GENERATION_START_LOCK_TTL_SECONDS,
  })
}

export function markSmartGenerationStartLockFailed(input: string | {
  idempotencyKey: string
  backend?: SmartGenerationStartLockBackend
}): void {
  const idempotencyKey = typeof input === 'string' ? input : input.idempotencyKey
  const backend = typeof input === 'string' ? 'memory_fallback' : input.backend ?? 'memory_fallback'
  const lock = locks.get(idempotencyKey)
  if (!lock) {
    logError('agent.smart_generation.start_lock_failed_missing_lock', {
      idempotencyKeyHash: hashForLog(idempotencyKey),
      backend,
      status: 'missing_lock',
    })
    return
  }

  locks.set(idempotencyKey, {
    ...lock,
    status: 'failed',
    expiresAt: new Date().toISOString(),
  })
  logLockEvent('agent.smart_generation.start_lock_failed', {
    workflowMode: lock.workflowMode,
    userId: lock.userId,
    sessionId: lock.sessionId,
    idempotencyKeyHash: hashForLog(idempotencyKey),
    targetJobHash: lock.targetJobHash,
    resumeHash: lock.resumeHash,
    backend,
    status: 'failed',
  })
}

export async function markSmartGenerationStartLockFailedDurable(input: {
  idempotencyKey: string
  backend: SmartGenerationStartLockBackend
}): Promise<void> {
  markSmartGenerationStartLockFailed(input)
  const redis = input.backend === 'redis' ? getRedisClient() : null
  if (!redis) {
    return
  }

  await redis.del(input.idempotencyKey)
}

export function resetSmartGenerationStartLocksForTests(): void {
  locks.clear()
  backendSelectionLogged = false
  redisClient = null
}
