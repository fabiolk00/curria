import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  JobTargetingStartLockBackendError,
  buildJobTargetingStartLockFingerprint,
  markJobTargetingStartLockCompleted,
  markJobTargetingStartLockFailed,
  markJobTargetingStartLockRunningSession,
  normalizeJobTargetForLock,
  resetJobTargetingStartLocksForTests,
  tryAcquireJobTargetingStartLock,
} from './job-targeting-start-lock'
import type { CVState } from '@/types/cv'

vi.mock('@/lib/observability/structured-log', () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
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

describe('job targeting start lock', () => {
  beforeEach(() => {
    resetJobTargetingStartLocksForTests()
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('normalizes trivial target whitespace before hashing', () => {
    const first = buildJobTargetingStartLockFingerprint({
      userId: 'usr_123',
      cvState: buildCvState(),
      targetJobDescription: 'Vaga Java\nRequisitos: SQL   e Power BI',
    })
    const second = buildJobTargetingStartLockFingerprint({
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
    const first = buildJobTargetingStartLockFingerprint({
      userId: 'usr_123',
      cvState: buildCvState(),
      targetJobDescription: 'Requisitos: SQL e Power BI',
    })
    const second = buildJobTargetingStartLockFingerprint({
      userId: 'usr_123',
      cvState: buildCvState(),
      targetJobDescription: 'Requisitos: Java e Spring Boot',
    })

    expect(second.targetJobHash).not.toBe(first.targetJobHash)
  })

  it('normalizes stable cv state fields before hashing', () => {
    const first = buildJobTargetingStartLockFingerprint({
      userId: 'usr_123',
      cvState: buildCvState({ skills: ['SQL', 'Power BI'] }),
      targetJobDescription: 'Requisitos: SQL',
    })
    const second = buildJobTargetingStartLockFingerprint({
      userId: 'usr_123',
      cvState: buildCvState({ skills: [' Power BI ', 'SQL'] }),
      targetJobDescription: 'Requisitos: SQL',
    })

    expect(second.resumeHash).toBe(first.resumeHash)
  })

  it('returns already_running with sessionId for duplicate starts', () => {
    const first = tryAcquireJobTargetingStartLock({
      userId: 'usr_123',
      cvState: buildCvState(),
      targetJobDescription: 'Requisitos: SQL',
    })
    expect(first.acquired).toBe(true)

    if (first.acquired) {
      markJobTargetingStartLockRunningSession({
        idempotencyKey: first.idempotencyKey,
        sessionId: 'sess_existing',
      })
    }

    const second = tryAcquireJobTargetingStartLock({
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
    const first = tryAcquireJobTargetingStartLock({
      userId: 'usr_123',
      cvState: buildCvState(),
      targetJobDescription: 'Requisitos: SQL',
    })
    expect(first.acquired).toBe(true)
    if (!first.acquired) {
      throw new Error('expected first acquire')
    }

    markJobTargetingStartLockCompleted({
      idempotencyKey: first.idempotencyKey,
      sessionId: 'sess_completed',
    })

    expect(tryAcquireJobTargetingStartLock({
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
    const first = tryAcquireJobTargetingStartLock({
      userId: 'usr_123',
      cvState: buildCvState(),
      targetJobDescription: 'Requisitos: SQL',
      now: new Date('2026-04-28T00:00:00.000Z'),
    })
    expect(first.acquired).toBe(true)
    if (!first.acquired) {
      throw new Error('expected first acquire')
    }

    markJobTargetingStartLockFailed(first.idempotencyKey)
    expect(tryAcquireJobTargetingStartLock({
      userId: 'usr_123',
      cvState: buildCvState(),
      targetJobDescription: 'Requisitos: SQL',
    })).toEqual(expect.objectContaining({
      acquired: true,
    }))

    resetJobTargetingStartLocksForTests()
    const running = tryAcquireJobTargetingStartLock({
      userId: 'usr_123',
      cvState: buildCvState(),
      targetJobDescription: 'Requisitos: SQL',
      now: new Date('2026-04-28T00:00:00.000Z'),
    })
    expect(running.acquired).toBe(true)
    expect(tryAcquireJobTargetingStartLock({
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

    await expect(import('./job-targeting-start-lock').then((module) => (
      module.tryAcquireJobTargetingStartLockDurable({
        userId: 'usr_123',
        cvState: buildCvState(),
        targetJobDescription: 'Requisitos: SQL',
      })
    ))).rejects.toBeInstanceOf(JobTargetingStartLockBackendError)
  })
})
