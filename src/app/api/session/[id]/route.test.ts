import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getCurrentAppUser } from '@/lib/auth/app-user'
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

describe('session workspace route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects non-owners', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValue(buildAppUser('usr_other'))
    vi.mocked(getSession).mockResolvedValue(null)

    const response = await GET(
      new NextRequest('https://example.com/api/session/sess_123'),
      { params: { id: 'sess_123' } },
    )

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Not found' })
  })

  it('returns the owned workspace read model', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValue(buildAppUser('usr_123'))
    vi.mocked(getSession).mockResolvedValue({
      id: 'sess_123',
      userId: 'usr_123',
      phase: 'dialog',
      stateVersion: 1,
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
        parseConfidenceScore: 0.9,
        targetJobDescription: 'AWS role',
        gapAnalysis: {
          result: {
            matchScore: 70,
            missingSkills: ['AWS'],
            weakAreas: ['summary'],
            improvementSuggestions: ['Add AWS to summary'],
          },
          analyzedAt: '2026-03-27T12:00:00.000Z',
        },
        rewriteHistory: {},
      },
      generatedOutput: { status: 'idle' },
      atsScore: {
        total: 80,
        breakdown: { format: 16, structure: 17, keywords: 20, contact: 10, impact: 17 },
        issues: [],
        suggestions: [],
      },
      creditsUsed: 1,
      messageCount: 2,
      creditConsumed: true,
      createdAt: new Date('2026-03-27T12:00:00.000Z'),
      updatedAt: new Date('2026-03-27T12:05:00.000Z'),
    })
    vi.mocked(getResumeTargetsForSession).mockResolvedValue([])

    const response = await GET(
      new NextRequest('https://example.com/api/session/sess_123'),
      { params: { id: 'sess_123' } },
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      session: {
        id: 'sess_123',
        phase: 'dialog',
        stateVersion: 1,
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
          parseError: undefined,
          parseConfidenceScore: 0.9,
          targetJobDescription: 'AWS role',
          gapAnalysis: {
            result: {
              matchScore: 70,
              missingSkills: ['AWS'],
              weakAreas: ['summary'],
              improvementSuggestions: ['Add AWS to summary'],
            },
            analyzedAt: '2026-03-27T12:00:00.000Z',
          },
        },
        generatedOutput: { status: 'idle' },
        atsScore: {
          total: 80,
          breakdown: { format: 16, structure: 17, keywords: 20, contact: 10, impact: 17 },
          issues: [],
          suggestions: [],
        },
        messageCount: 2,
        creditConsumed: true,
        createdAt: '2026-03-27T12:00:00.000Z',
        updatedAt: '2026-03-27T12:05:00.000Z',
      },
      targets: [],
    })
  })
})
