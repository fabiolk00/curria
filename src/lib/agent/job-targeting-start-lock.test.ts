import { readFileSync } from 'node:fs'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  JobTargetingStartLockBackendError,
  buildJobTargetingStartIdempotencyKey,
  buildJobTargetingStartLockFingerprint,
  markJobTargetingStartLockCompleted,
  resetJobTargetingStartLocksForTests,
  tryAcquireJobTargetingStartLock,
} from './job-targeting-start-lock'
import {
  SmartGenerationStartLockBackendError,
  buildSmartGenerationStartLockFingerprint,
  resetSmartGenerationStartLocksForTests,
  tryAcquireSmartGenerationStartLock,
} from './smart-generation-start-lock'
import type { CVState } from '@/types/cv'

function buildCvState(overrides: Partial<CVState> = {}): CVState {
  return {
    fullName: 'Ana Silva',
    email: 'ana@example.com',
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

describe('job targeting start lock compatibility wrapper', () => {
  beforeEach(() => {
    resetSmartGenerationStartLocksForTests()
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('delegates old fingerprint and idempotency key helpers to the canonical job-targeting mode', () => {
    const input = {
      userId: 'usr_123',
      cvState: buildCvState(),
      targetJobDescription: '  Vaga Java \r\nRequisitos: SQL   e Power BI  ',
    }

    const legacy = buildJobTargetingStartLockFingerprint(input)
    const canonical = buildSmartGenerationStartLockFingerprint({
      workflowMode: 'job_targeting',
      ...input,
    })

    expect(legacy).toEqual(canonical)
    expect(buildJobTargetingStartIdempotencyKey(input)).toBe(canonical.idempotencyKey)
    expect(legacy.idempotencyKey).toMatch(/^job-targeting-start:/)
  })

  it('keeps the old acquire, complete, and reset names compatible with canonical state', () => {
    const first = tryAcquireJobTargetingStartLock({
      userId: 'usr_123',
      cvState: buildCvState(),
      targetJobDescription: 'Requisitos: SQL',
    })
    expect(first.acquired).toBe(true)
    if (!first.acquired) {
      throw new Error('expected legacy acquire')
    }

    markJobTargetingStartLockCompleted({
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

    resetJobTargetingStartLocksForTests()
    expect(tryAcquireSmartGenerationStartLock({
      workflowMode: 'job_targeting',
      userId: 'usr_123',
      cvState: buildCvState(),
      targetJobDescription: 'Requisitos: SQL',
    })).toEqual(expect.objectContaining({
      acquired: true,
    }))
  })

  it('aliases the backend error class for existing imports', () => {
    expect(JobTargetingStartLockBackendError).toBe(SmartGenerationStartLockBackendError)
  })

  it('does not contain lock state, Redis, hashing, or logger implementation details', () => {
    const source = readFileSync(new URL('./job-targeting-start-lock.ts', import.meta.url), 'utf8')

    expect(source).not.toContain('node:crypto')
    expect(source).not.toContain('@upstash/redis')
    expect(source).not.toContain('@/lib/observability/structured-log')
    expect(source).not.toContain('new Map')
    expect(source).not.toMatch(/\blog(?:Info|Warn|Error)\b/)
  })
})
