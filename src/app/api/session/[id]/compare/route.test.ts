import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { CVVersion, ResumeTarget, Session } from '@/types/agent'

import { getCurrentAppUser } from '@/lib/auth/app-user'
import { getCvVersionForSession, toTimelineEntry } from '@/lib/db/cv-versions'
import { getResumeTargetForSession, getResumeTargetsForSession } from '@/lib/db/resume-targets'
import { getSession } from '@/lib/db/sessions'

import { POST } from './route'

vi.mock('@/lib/auth/app-user', () => ({
  getCurrentAppUser: vi.fn(),
}))

vi.mock('@/lib/db/sessions', () => ({
  getSession: vi.fn(),
}))

vi.mock('@/lib/db/cv-versions', () => ({
  getCvVersionForSession: vi.fn(),
  toTimelineEntry: vi.fn(),
}))

vi.mock('@/lib/db/resume-targets', () => ({
  getResumeTargetForSession: vi.fn(),
  getResumeTargetsForSession: vi.fn(),
}))

function buildAppUser(id: string) {
  return {
    id,
    status: 'active' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    authIdentity: {
      id: `identity_${id}`,
      userId: id,
      provider: 'clerk' as const,
      providerSubject: `clerk_${id}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    creditAccount: {
      id: `cred_${id}`,
      userId: id,
      creditsRemaining: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  }
}

function buildSession(): Session {
  return {
    id: 'sess_123',
    userId: 'usr_123',
    stateVersion: 1,
    phase: 'dialog',
    cvState: {
      fullName: 'Ana Silva',
      email: 'ana@example.com',
      phone: '555-0100',
      summary: 'Backend engineer',
      experience: [],
      skills: ['TypeScript'],
      education: [],
    },
    agentState: {
      parseStatus: 'parsed',
      rewriteHistory: {},
    },
    generatedOutput: {
      status: 'idle',
    },
    creditsUsed: 1,
    messageCount: 2,
    creditConsumed: true,
    createdAt: new Date('2026-03-27T12:00:00.000Z'),
    updatedAt: new Date('2026-03-27T12:00:00.000Z'),
  }
}

function buildVersion(): CVVersion {
  return {
    id: 'ver_123',
    sessionId: 'sess_123',
    source: 'rewrite',
    snapshot: {
      fullName: 'Ana Silva',
      email: 'ana@example.com',
      phone: '555-0100',
      summary: 'Platform backend engineer',
      experience: [],
      skills: ['TypeScript', 'Node.js'],
      education: [],
    },
    createdAt: new Date('2026-03-27T12:30:00.000Z'),
  }
}

function buildTarget(): ResumeTarget {
  return {
    id: 'target_123',
    sessionId: 'sess_123',
    targetJobDescription: 'AWS role',
    derivedCvState: {
      fullName: 'Ana Silva',
      email: 'ana@example.com',
      phone: '555-0100',
      summary: 'Backend engineer for AWS roles',
      experience: [],
      skills: ['TypeScript', 'AWS'],
      education: [],
    },
    createdAt: new Date('2026-03-27T13:00:00.000Z'),
    updatedAt: new Date('2026-03-27T13:05:00.000Z'),
  }
}

describe('session compare route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getResumeTargetsForSession).mockResolvedValue([])
  })

  it('rejects non-owners', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValue(buildAppUser('usr_other'))
    vi.mocked(getSession).mockResolvedValue(null)

    const response = await POST(
      new NextRequest('https://example.com/api/session/sess_123/compare', {
        method: 'POST',
        body: JSON.stringify({
          left: { kind: 'base' },
          right: { kind: 'target', id: 'target_123' },
        }),
      }),
      { params: { id: 'sess_123' } },
    )

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Not found' })
  })

  it('compares base and target snapshots without mutating state', async () => {
    const session = buildSession()
    const target = buildTarget()

    vi.mocked(getCurrentAppUser).mockResolvedValue(buildAppUser('usr_123'))
    vi.mocked(getSession).mockResolvedValue(session)
    vi.mocked(getResumeTargetForSession).mockResolvedValue(target)

    const response = await POST(
      new NextRequest('https://example.com/api/session/sess_123/compare', {
        method: 'POST',
        body: JSON.stringify({
          left: { kind: 'base' },
          right: { kind: 'target', id: 'target_123' },
        }),
      }),
      { params: { id: 'sess_123' } },
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      sessionId: 'sess_123',
      left: {
        kind: 'base',
        label: 'Current Base Resume',
        previewLocked: false,
      },
      right: {
        kind: 'target',
        id: 'target_123',
        label: 'Target Resume (target_123)',
        source: 'target',
        timestamp: '2026-03-27T13:05:00.000Z',
        previewLocked: false,
      },
      diff: {
        summary: {
          before: 'Backend engineer',
          after: 'Backend engineer for AWS roles',
          changed: true,
        },
        skills: {
          added: ['AWS'],
          removed: [],
          unchangedCount: 1,
        },
      },
    })
    expect(session.cvState.summary).toBe('Backend engineer')
  })

  it('compares version timeline entries and omits unchanged sections', async () => {
    const session = buildSession()
    const version = buildVersion()

    vi.mocked(getCurrentAppUser).mockResolvedValue(buildAppUser('usr_123'))
    vi.mocked(getSession).mockResolvedValue(session)
    vi.mocked(getCvVersionForSession).mockResolvedValue(version)
    vi.mocked(toTimelineEntry).mockReturnValue({
      ...version,
      label: 'Base Resume Updated',
      scope: 'base',
      timestamp: '2026-03-27T12:30:00.000Z',
    })

    const response = await POST(
      new NextRequest('https://example.com/api/session/sess_123/compare', {
        method: 'POST',
        body: JSON.stringify({
          left: { kind: 'version', id: 'ver_123' },
          right: { kind: 'base' },
        }),
      }),
      { params: { id: 'sess_123' } },
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      sessionId: 'sess_123',
      left: {
        kind: 'version',
        id: 'ver_123',
        label: 'Base Resume Updated',
        source: 'rewrite',
        timestamp: '2026-03-27T12:30:00.000Z',
        previewLocked: false,
      },
      right: {
        kind: 'base',
        label: 'Current Base Resume',
        previewLocked: false,
      },
      diff: {
        summary: {
          before: 'Platform backend engineer',
          after: 'Backend engineer',
          changed: true,
        },
        skills: {
          added: [],
          removed: ['Node.js'],
          unchangedCount: 1,
        },
      },
    })
  })

  it('blocks compare output when a version ref is locked by free-trial preview access', async () => {
    const session = buildSession()
    session.generatedOutput = {
      status: 'ready',
      previewAccess: {
        locked: true,
        blurred: true,
        canViewRealContent: false,
        requiresUpgrade: true,
        requiresRegenerationAfterUnlock: true,
        reason: 'free_trial_locked',
        lockedAt: '2026-04-20T12:00:00.000Z',
        message: 'Seu preview gratuito está bloqueado. Faça upgrade e gere novamente para liberar o currículo real.',
      },
    }
    const version = buildVersion()

    vi.mocked(getCurrentAppUser).mockResolvedValue(buildAppUser('usr_123'))
    vi.mocked(getSession).mockResolvedValue(session)
    vi.mocked(getCvVersionForSession).mockResolvedValue(version)
    vi.mocked(toTimelineEntry).mockReturnValue({
      ...version,
      label: 'ATS Enhancement Created',
      scope: 'base',
      timestamp: '2026-03-27T12:30:00.000Z',
    })

    const response = await POST(
      new NextRequest('https://example.com/api/session/sess_123/compare', {
        method: 'POST',
        body: JSON.stringify({
          left: { kind: 'version', id: 'ver_123' },
          right: { kind: 'base' },
        }),
      }),
      { params: { id: 'sess_123' } },
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      sessionId: 'sess_123',
      locked: true,
      reason: 'preview_locked',
      left: {
        kind: 'version',
        id: 'ver_123',
        label: 'ATS Enhancement Created',
        source: 'rewrite',
        timestamp: '2026-03-27T12:30:00.000Z',
        previewLocked: true,
        previewLock: {
          locked: true,
          blurred: true,
          reason: 'free_trial_locked',
          requiresUpgrade: true,
          requiresPaidRegeneration: true,
          message: 'Seu preview gratuito está bloqueado. Faça upgrade e gere novamente para liberar o currículo real.',
        },
      },
      right: {
        kind: 'base',
        id: undefined,
        label: 'Current Base Resume',
        source: undefined,
        timestamp: undefined,
        previewLocked: false,
        previewLock: undefined,
      },
    })
  })
})
