import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  SmartGenerationStartLockBackendError,
  buildSmartGenerationStartLockFingerprint,
  markSmartGenerationStartLockCompleted,
  markSmartGenerationStartLockCompletedDurable,
  markSmartGenerationStartLockFailed,
  markSmartGenerationStartLockFailedDurable,
  markSmartGenerationStartLockRunningSession,
  markSmartGenerationStartLockRunningSessionDurable,
  normalizeJobTargetForLock,
  resetSmartGenerationStartLocksForTests,
  tryAcquireSmartGenerationStartLock,
  tryAcquireSmartGenerationStartLockDurable,
} from './smart-generation-start-lock'
import { logError, logInfo, logWarn } from '@/lib/observability/structured-log'
import type { CVState } from '@/types/cv'

const redisMock = vi.hoisted(() => ({
  store: new Map<string, unknown>(),
  set: vi.fn(),
  get: vi.fn(),
  del: vi.fn(),
}))

vi.mock('@upstash/redis', () => ({
  Redis: vi.fn().mockImplementation(() => ({
    set: redisMock.set,
    get: redisMock.get,
    del: redisMock.del,
  })),
}))

vi.mock('@/lib/observability/structured-log', () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}))

function buildCvState(overrides: Partial<CVState> = {}): CVState {
  return {
    fullName: 'Ana Silva',
    email: 'ANA@EXAMPLE.COM ',
    phone: '555-0100',
    summary: 'Analista de dados com SQL.',
    experience: [{
      title: 'Analista',
      company: 'Acme',
      startDate: '2022',
      endDate: '2024',
      bullets: ['Criei dashboards em Power BI.'],
    }],
    skills: ['Power BI', 'SQL'],
    education: [],
    certifications: [],
    ...overrides,
  }
}

describe('smart generation start lock', () => {
  beforeEach(() => {
    resetSmartGenerationStartLocksForTests()
    redisMock.store.clear()
    redisMock.set.mockReset()
    redisMock.get.mockReset()
    redisMock.del.mockReset()
    redisMock.set.mockImplementation(async (key: string, value: unknown, options?: { nx?: boolean }) => {
      if (options?.nx && redisMock.store.has(key)) {
        return null
      }
      redisMock.store.set(key, value)
      return 'OK'
    })
    redisMock.get.mockImplementation(async (key: string) => redisMock.store.get(key) ?? null)
    redisMock.del.mockImplementation(async (key: string) => {
      redisMock.store.delete(key)
      return 1
    })
    vi.mocked(logInfo).mockClear()
    vi.mocked(logWarn).mockClear()
    vi.mocked(logError).mockClear()
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('normalizes trivial target whitespace before hashing', () => {
    const first = buildSmartGenerationStartLockFingerprint({
      workflowMode: 'job_targeting',
      userId: 'usr_123',
      cvState: buildCvState(),
      targetJobDescription: 'Vaga Java\nRequisitos: SQL   e Power BI',
    })
    const second = buildSmartGenerationStartLockFingerprint({
      workflowMode: 'job_targeting',
      userId: 'usr_123',
      cvState: buildCvState(),
      targetJobDescription: '  Vaga Java \r\nRequisitos: SQL e Power BI  ',
    })

    expect(normalizeJobTargetForLock('  Vaga Java \r\nRequisitos: SQL   e Power BI  '))
      .toBe('vaga java\nrequisitos: sql e power bi')
    expect(second.targetJobHash).toBe(first.targetJobHash)
    expect(second.idempotencyKey).toBe(first.idempotencyKey)
  })

  it('changes the target hash when the vacancy meaning changes', () => {
    const first = buildSmartGenerationStartLockFingerprint({
      workflowMode: 'job_targeting',
      userId: 'usr_123',
      cvState: buildCvState(),
      targetJobDescription: 'Requisitos: SQL e Power BI',
    })
    const second = buildSmartGenerationStartLockFingerprint({
      workflowMode: 'job_targeting',
      userId: 'usr_123',
      cvState: buildCvState(),
      targetJobDescription: 'Requisitos: Java e Spring Boot',
    })

    expect(second.targetJobHash).not.toBe(first.targetJobHash)
  })

  it('normalizes stable cv state fields before hashing', () => {
    const first = buildSmartGenerationStartLockFingerprint({
      workflowMode: 'job_targeting',
      userId: 'usr_123',
      cvState: buildCvState({ skills: ['SQL', 'Power BI'] }),
      targetJobDescription: 'Requisitos: SQL',
    })
    const second = buildSmartGenerationStartLockFingerprint({
      workflowMode: 'job_targeting',
      userId: 'usr_123',
      cvState: buildCvState({ skills: [' Power BI ', 'SQL'] }),
      targetJobDescription: 'Requisitos: SQL',
    })

    expect(second.resumeHash).toBe(first.resumeHash)
  })

  it('uses a distinct ATS fingerprint without target job text', () => {
    const ats = buildSmartGenerationStartLockFingerprint({
      workflowMode: 'ats_enhancement',
      userId: 'usr_123',
      cvState: buildCvState(),
    })
    const targeting = buildSmartGenerationStartLockFingerprint({
      workflowMode: 'job_targeting',
      userId: 'usr_123',
      cvState: buildCvState(),
      targetJobDescription: 'Requisitos: SQL',
    })

    expect(ats.idempotencyKey).toMatch(/^ats-enhancement-start:/)
    expect(ats.targetJobHash).toBeUndefined()
    expect(targeting.idempotencyKey).toMatch(/^job-targeting-start:/)
    expect(targeting.targetJobHash).toEqual(expect.any(String))
  })

  it('does not log raw resume or target job sentinel values', () => {
    const cvState = buildCvState({
      fullName: 'SENTINEL RAW NAME',
      phone: 'SENTINEL RAW PHONE',
      experience: [{
        title: 'Analista',
        company: 'SENTINEL RAW COMPANY',
        startDate: '2022',
        endDate: '2024',
        bullets: ['SENTINEL RAW RESUME BULLET'],
      }],
    })
    const targetJobDescription = 'SENTINEL RAW TARGET JOB SENTENCE with strategic requirements'

    const atsAcquire = tryAcquireSmartGenerationStartLock({
      workflowMode: 'ats_enhancement',
      userId: 'usr_ats_privacy',
      cvState,
    })
    expect(atsAcquire.acquired).toBe(true)
    if (!atsAcquire.acquired) {
      throw new Error('expected ATS acquire')
    }
    markSmartGenerationStartLockRunningSession({
      idempotencyKey: atsAcquire.idempotencyKey,
      sessionId: 'sess_ats_privacy',
    })
    markSmartGenerationStartLockCompleted({
      idempotencyKey: atsAcquire.idempotencyKey,
      sessionId: 'sess_ats_privacy',
    })

    const targetingAcquire = tryAcquireSmartGenerationStartLock({
      workflowMode: 'job_targeting',
      userId: 'usr_target_privacy',
      cvState,
      targetJobDescription,
    })
    expect(targetingAcquire.acquired).toBe(true)
    if (!targetingAcquire.acquired) {
      throw new Error('expected job targeting acquire')
    }
    markSmartGenerationStartLockFailed({
      idempotencyKey: targetingAcquire.idempotencyKey,
    })

    const serializedLoggerCalls = JSON.stringify([
      vi.mocked(logInfo).mock.calls,
      vi.mocked(logWarn).mock.calls,
      vi.mocked(logError).mock.calls,
    ])

    for (const rawSentinel of [
      'SENTINEL RAW NAME',
      'SENTINEL RAW PHONE',
      'SENTINEL RAW COMPANY',
      'SENTINEL RAW RESUME BULLET',
      'SENTINEL RAW TARGET JOB SENTENCE',
    ]) {
      expect(serializedLoggerCalls).not.toContain(rawSentinel)
    }
    expect(serializedLoggerCalls).toContain('resumeHash')
    expect(serializedLoggerCalls).toContain('targetJobHash')
    expect(serializedLoggerCalls).toContain('idempotencyKeyHash')
    expect(serializedLoggerCalls).toContain('usr_ats_privacy')
    expect(serializedLoggerCalls).toContain('sess_ats_privacy')
    expect(serializedLoggerCalls).toContain('usr_target_privacy')
  })

  it('returns already_running for duplicate ATS starts with a semantically identical normalized CV', () => {
    const first = tryAcquireSmartGenerationStartLock({
      workflowMode: 'ats_enhancement',
      userId: 'usr_ats',
      cvState: buildCvState({
        email: 'ana@example.com',
        skills: ['SQL', 'Power BI'],
      }),
    })
    expect(first.acquired).toBe(true)
    if (!first.acquired) {
      throw new Error('expected ATS acquire')
    }

    markSmartGenerationStartLockRunningSession({
      idempotencyKey: first.idempotencyKey,
      sessionId: 'sess_ats_running',
    })

    const second = tryAcquireSmartGenerationStartLock({
      workflowMode: 'ats_enhancement',
      userId: 'usr_ats',
      cvState: buildCvState({
        email: ' ANA@EXAMPLE.COM ',
        summary: 'Analista de dados   com SQL.',
        skills: [' Power BI ', 'SQL'],
      }),
    })

    expect(second).toEqual(expect.objectContaining({
      acquired: false,
      status: 'already_running',
      sessionId: 'sess_ats_running',
      workflowMode: 'ats_enhancement',
    }))
  })

  it('returns already_completed with the completed session id for duplicate ATS starts', () => {
    const first = tryAcquireSmartGenerationStartLock({
      workflowMode: 'ats_enhancement',
      userId: 'usr_ats',
      cvState: buildCvState(),
    })
    expect(first.acquired).toBe(true)
    if (!first.acquired) {
      throw new Error('expected ATS acquire')
    }

    markSmartGenerationStartLockCompleted({
      idempotencyKey: first.idempotencyKey,
      sessionId: 'sess_ats_completed',
    })

    expect(tryAcquireSmartGenerationStartLock({
      workflowMode: 'ats_enhancement',
      userId: 'usr_ats',
      cvState: buildCvState(),
    })).toEqual(expect.objectContaining({
      acquired: false,
      status: 'already_completed',
      sessionId: 'sess_ats_completed',
      workflowMode: 'ats_enhancement',
    }))
  })

  it('marks failed ATS starts retryable', () => {
    const first = tryAcquireSmartGenerationStartLock({
      workflowMode: 'ats_enhancement',
      userId: 'usr_ats',
      cvState: buildCvState(),
    })
    expect(first.acquired).toBe(true)
    if (!first.acquired) {
      throw new Error('expected ATS acquire')
    }

    markSmartGenerationStartLockFailed({
      idempotencyKey: first.idempotencyKey,
    })

    expect(tryAcquireSmartGenerationStartLock({
      workflowMode: 'ats_enhancement',
      userId: 'usr_ats',
      cvState: buildCvState(),
    })).toEqual(expect.objectContaining({
      acquired: true,
      workflowMode: 'ats_enhancement',
    }))
  })

  it('uses a distinct ATS lock for the same user and different CV', () => {
    const first = tryAcquireSmartGenerationStartLock({
      workflowMode: 'ats_enhancement',
      userId: 'usr_ats',
      cvState: buildCvState(),
    })
    const second = tryAcquireSmartGenerationStartLock({
      workflowMode: 'ats_enhancement',
      userId: 'usr_ats',
      cvState: buildCvState({ summary: 'Resumo diferente com foco em SQL.' }),
    })

    expect(first.acquired).toBe(true)
    expect(second.acquired).toBe(true)
    expect(second.idempotencyKey).not.toBe(first.idempotencyKey)
  })

  it('uses a distinct ATS lock for different users with the same CV', () => {
    const first = tryAcquireSmartGenerationStartLock({
      workflowMode: 'ats_enhancement',
      userId: 'usr_ats_one',
      cvState: buildCvState(),
    })
    const second = tryAcquireSmartGenerationStartLock({
      workflowMode: 'ats_enhancement',
      userId: 'usr_ats_two',
      cvState: buildCvState(),
    })

    expect(first.acquired).toBe(true)
    expect(second.acquired).toBe(true)
    expect(second.idempotencyKey).not.toBe(first.idempotencyKey)
  })

  it('returns already_running with sessionId for duplicate starts', () => {
    const first = tryAcquireSmartGenerationStartLock({
      workflowMode: 'job_targeting',
      userId: 'usr_123',
      cvState: buildCvState(),
      targetJobDescription: 'Requisitos: SQL',
    })
    expect(first.acquired).toBe(true)

    if (first.acquired) {
      markSmartGenerationStartLockRunningSession({
        idempotencyKey: first.idempotencyKey,
        sessionId: 'sess_existing',
      })
    }

    const second = tryAcquireSmartGenerationStartLock({
      workflowMode: 'job_targeting',
      userId: 'usr_123',
      cvState: buildCvState(),
      targetJobDescription: 'Requisitos: SQL',
    })

    expect(second).toEqual(expect.objectContaining({
      acquired: false,
      status: 'already_running',
      sessionId: 'sess_existing',
    }))
  })

  it('returns already_completed with the completed session id', () => {
    const first = tryAcquireSmartGenerationStartLock({
      workflowMode: 'job_targeting',
      userId: 'usr_123',
      cvState: buildCvState(),
      targetJobDescription: 'Requisitos: SQL',
    })
    expect(first.acquired).toBe(true)
    if (!first.acquired) {
      throw new Error('expected first acquire')
    }

    markSmartGenerationStartLockCompleted({
      idempotencyKey: first.idempotencyKey,
      sessionId: 'sess_completed',
    })

    expect(tryAcquireSmartGenerationStartLock({
      workflowMode: 'job_targeting',
      userId: 'usr_123',
      cvState: buildCvState(),
      targetJobDescription: 'Requisitos: SQL',
    })).toEqual(expect.objectContaining({
      acquired: false,
      status: 'already_completed',
      sessionId: 'sess_completed',
    }))
  })

  it('allows retry after failed or expired locks', () => {
    const first = tryAcquireSmartGenerationStartLock({
      workflowMode: 'job_targeting',
      userId: 'usr_123',
      cvState: buildCvState(),
      targetJobDescription: 'Requisitos: SQL',
      now: new Date('2026-04-28T00:00:00.000Z'),
    })
    expect(first.acquired).toBe(true)
    if (!first.acquired) {
      throw new Error('expected first acquire')
    }

    markSmartGenerationStartLockFailed(first.idempotencyKey)
    expect(tryAcquireSmartGenerationStartLock({
      workflowMode: 'job_targeting',
      userId: 'usr_123',
      cvState: buildCvState(),
      targetJobDescription: 'Requisitos: SQL',
    })).toEqual(expect.objectContaining({
      acquired: true,
    }))

    resetSmartGenerationStartLocksForTests()
    const running = tryAcquireSmartGenerationStartLock({
      workflowMode: 'job_targeting',
      userId: 'usr_123',
      cvState: buildCvState(),
      targetJobDescription: 'Requisitos: SQL',
      now: new Date('2026-04-28T00:00:00.000Z'),
    })
    expect(running.acquired).toBe(true)
    expect(tryAcquireSmartGenerationStartLock({
      workflowMode: 'job_targeting',
      userId: 'usr_123',
      cvState: buildCvState(),
      targetJobDescription: 'Requisitos: SQL',
      now: new Date('2026-04-28T00:11:00.000Z'),
    })).toEqual(expect.objectContaining({
      acquired: true,
      expiredLockReclaimed: true,
    }))
  })

  it('fails closed when production has no durable backend configured', async () => {
    vi.stubEnv('NODE_ENV', 'production')

    await expect(import('./smart-generation-start-lock').then((module) => (
      module.tryAcquireSmartGenerationStartLockDurable({
        workflowMode: 'job_targeting',
        userId: 'usr_123',
        cvState: buildCvState(),
        targetJobDescription: 'Requisitos: SQL',
      })
    ))).rejects.toBeInstanceOf(SmartGenerationStartLockBackendError)
  })

  it('keeps redis backend in running, completed, and failed markers after redis acquire', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://redis.example.test')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'token')

    const completedAcquire = await tryAcquireSmartGenerationStartLockDurable({
      workflowMode: 'job_targeting',
      userId: 'usr_123',
      cvState: buildCvState(),
      targetJobDescription: 'Requisitos: SQL',
    })
    expect(completedAcquire).toEqual(expect.objectContaining({
      acquired: true,
      backend: 'redis',
    }))
    if (!completedAcquire.acquired) {
      throw new Error('expected redis acquire')
    }

    await markSmartGenerationStartLockRunningSessionDurable({
      idempotencyKey: completedAcquire.idempotencyKey,
      sessionId: 'sess_redis',
      backend: completedAcquire.backend,
    })
    await markSmartGenerationStartLockCompletedDurable({
      idempotencyKey: completedAcquire.idempotencyKey,
      sessionId: 'sess_redis',
      backend: completedAcquire.backend,
    })

    const failedAcquire = await tryAcquireSmartGenerationStartLockDurable({
      workflowMode: 'job_targeting',
      userId: 'usr_123',
      cvState: buildCvState({ summary: 'Outro resumo com SQL.' }),
      targetJobDescription: 'Requisitos: SQL',
    })
    if (!failedAcquire.acquired) {
      throw new Error('expected second redis acquire')
    }
    await markSmartGenerationStartLockFailedDurable({
      idempotencyKey: failedAcquire.idempotencyKey,
      backend: failedAcquire.backend,
    })

    expect(logInfo).toHaveBeenCalledWith('agent.smart_generation.start_lock_acquired', expect.objectContaining({
      backend: 'redis',
      workflowMode: 'job_targeting',
    }))
    expect(logInfo).toHaveBeenCalledWith('agent.smart_generation.start_lock_running_session_marked', expect.objectContaining({
      backend: 'redis',
      workflowMode: 'job_targeting',
    }))
    expect(logInfo).toHaveBeenCalledWith('agent.smart_generation.start_lock_completed', expect.objectContaining({
      backend: 'redis',
      workflowMode: 'job_targeting',
    }))
    expect(logInfo).toHaveBeenCalledWith('agent.smart_generation.start_lock_failed', expect.objectContaining({
      backend: 'redis',
      workflowMode: 'job_targeting',
    }))
    expect(logInfo).not.toHaveBeenCalledWith('agent.smart_generation.start_lock_completed', expect.objectContaining({
      backend: 'memory_fallback',
    }))
  })
})
