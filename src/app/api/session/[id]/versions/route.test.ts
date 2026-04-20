import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getCurrentAppUser } from '@/lib/auth/app-user'
import { getCvTimelineForSession } from '@/lib/db/cv-versions'
import { getResumeTargetsForSession } from '@/lib/db/resume-targets'
import { getSession } from '@/lib/db/sessions'

import { GET } from './route'

vi.mock('@/lib/auth/app-user', () => ({
  getCurrentAppUser: vi.fn(),
}))

vi.mock('@/lib/db/sessions', () => ({
  getSession: vi.fn(),
}))

vi.mock('@/lib/db/resume-targets', () => ({
  getResumeTargetsForSession: vi.fn(),
}))

vi.mock('@/lib/db/cv-versions', () => ({
  getCvTimelineForSession: vi.fn(),
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

describe('session versions route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getResumeTargetsForSession).mockResolvedValue([])
  })

  it('rejects non-owners', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValue(buildAppUser('usr_other'))
    vi.mocked(getSession).mockResolvedValue(null)

    const response = await GET(
      new NextRequest('https://example.com/api/session/sess_123/versions'),
      { params: { id: 'sess_123' } },
    )

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Not found' })
    expect(getCvTimelineForSession).not.toHaveBeenCalled()
  })

  it('returns timeline metadata for the owner', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValue(buildAppUser('usr_123'))
    vi.mocked(getSession).mockResolvedValue({
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
        skills: [],
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
    })
    vi.mocked(getCvTimelineForSession).mockResolvedValue([{
      id: 'ver_123',
      sessionId: 'sess_123',
      snapshot: {
        fullName: 'Ana Silva',
        email: 'ana@example.com',
        phone: '555-0100',
        summary: 'Backend engineer',
        experience: [],
        skills: [],
        education: [],
      },
      label: 'Base Resume Imported',
      timestamp: '2026-03-27T12:05:00.000Z',
      scope: 'base',
      source: 'ingestion',
      createdAt: new Date('2026-03-27T12:05:00.000Z'),
    }])

    const response = await GET(
      new NextRequest('https://example.com/api/session/sess_123/versions'),
      { params: { id: 'sess_123' } },
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      sessionId: 'sess_123',
      versions: [{
        id: 'ver_123',
        sessionId: 'sess_123',
        snapshot: {
          fullName: 'Ana Silva',
          email: 'ana@example.com',
          phone: '555-0100',
          summary: 'Backend engineer',
          experience: [],
          skills: [],
          education: [],
        },
        label: 'Base Resume Imported',
        timestamp: '2026-03-27T12:05:00.000Z',
        scope: 'base',
        source: 'ingestion',
        createdAt: '2026-03-27T12:05:00.000Z',
        previewLocked: false,
        blurred: false,
        canViewRealContent: true,
        requiresUpgrade: false,
        requiresRegenerationAfterUnlock: false,
      }],
    })
  })

  it('filters timeline entries by scope', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValue(buildAppUser('usr_123'))
    vi.mocked(getSession).mockResolvedValue({
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
        skills: [],
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
    })
    vi.mocked(getCvTimelineForSession).mockResolvedValue([])

    const response = await GET(
      new NextRequest('https://example.com/api/session/sess_123/versions?scope=target-derived'),
      { params: { id: 'sess_123' } },
    )

    expect(response.status).toBe(200)
    expect(getCvTimelineForSession).toHaveBeenCalledWith('sess_123', 'target-derived')
  })

  it('removes the real snapshot from locked free-trial timeline entries', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValue(buildAppUser('usr_123'))
    vi.mocked(getSession).mockResolvedValue({
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
        skills: [],
        education: [],
      },
      agentState: {
        parseStatus: 'parsed',
        rewriteHistory: {},
      },
      generatedOutput: {
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
      },
      creditsUsed: 1,
      messageCount: 2,
      creditConsumed: true,
      createdAt: new Date('2026-03-27T12:00:00.000Z'),
      updatedAt: new Date('2026-03-27T12:00:00.000Z'),
    })
    vi.mocked(getCvTimelineForSession).mockResolvedValue([{
      id: 'ver_123',
      sessionId: 'sess_123',
      snapshot: {
        fullName: 'Ana Silva',
        email: 'ana@example.com',
        phone: '555-0100',
        summary: 'Resumo real que não deve vazar.',
        experience: [],
        skills: ['TypeScript', 'AWS'],
        education: [],
      },
      label: 'ATS Enhancement Created',
      timestamp: '2026-03-27T12:05:00.000Z',
      scope: 'base',
      source: 'ats-enhancement',
      createdAt: new Date('2026-03-27T12:05:00.000Z'),
    }])

    const response = await GET(
      new NextRequest('https://example.com/api/session/sess_123/versions'),
      { params: { id: 'sess_123' } },
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      sessionId: 'sess_123',
      versions: [{
        id: 'ver_123',
        sessionId: 'sess_123',
        label: 'ATS Enhancement Created',
        timestamp: '2026-03-27T12:05:00.000Z',
        scope: 'base',
        source: 'ats-enhancement',
        createdAt: '2026-03-27T12:05:00.000Z',
        previewLocked: true,
        blurred: true,
        canViewRealContent: false,
        requiresUpgrade: true,
        requiresRegenerationAfterUnlock: true,
        previewLock: {
          locked: true,
          blurred: true,
          reason: 'free_trial_locked',
          requiresUpgrade: true,
          requiresPaidRegeneration: true,
          message: 'Seu preview gratuito está bloqueado. Faça upgrade e gere novamente para liberar o currículo real.',
        },
      }],
    })
  })
})
