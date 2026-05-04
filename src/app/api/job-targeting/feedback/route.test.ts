import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { buildCompatibilityAssessmentFixture } from '@/lib/agent/job-targeting/__tests__/assessment-fixture'
import { getCurrentAppUser } from '@/lib/auth/app-user'
import { createJobCompatibilityFeedback } from '@/lib/db/job-compatibility-feedback'
import { getSession } from '@/lib/db/sessions'
import { validateTrustedMutationRequest } from '@/lib/security/request-trust'
import type { Session } from '@/types/agent'

import { POST } from './route'

vi.mock('@/lib/auth/app-user', () => ({
  getCurrentAppUser: vi.fn(),
}))

vi.mock('@/lib/db/sessions', () => ({
  getSession: vi.fn(),
}))

vi.mock('@/lib/db/job-compatibility-feedback', () => ({
  createJobCompatibilityFeedback: vi.fn(),
}))

vi.mock('@/lib/security/request-trust', () => ({
  validateTrustedMutationRequest: vi.fn(),
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
      id: `credits_${id}`,
      userId: id,
      creditsRemaining: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  }
}

function buildSession(userId = 'usr_123'): Session {
  return {
    id: 'sess_123',
    userId,
    stateVersion: 1,
    phase: 'dialog',
    cvState: {
      fullName: 'Ana Silva',
      email: 'ana@example.com',
      phone: '555-0100',
      summary: 'Analyst',
      experience: [],
      skills: [],
      education: [],
      certifications: [],
    },
    agentState: {
      parseStatus: 'parsed',
      rewriteHistory: {},
      jobCompatibilityAssessmentShadow: buildCompatibilityAssessmentFixture(),
    },
    generatedOutput: {
      status: 'idle',
    },
    creditsUsed: 0,
    messageCount: 1,
    creditConsumed: false,
    createdAt: new Date('2026-05-02T12:00:00.000Z'),
    updatedAt: new Date('2026-05-02T12:00:00.000Z'),
  }
}

function request(body: unknown): NextRequest {
  return new NextRequest('https://example.com/api/job-targeting/feedback', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'https://example.com',
    },
    body: JSON.stringify(body),
  })
}

describe('job targeting feedback route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(validateTrustedMutationRequest).mockReturnValue({
      ok: true,
      signal: 'same-origin',
    } as never)
  })

  it('only accepts feedback for sessions owned by the current user', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValue(buildAppUser('usr_123'))
    vi.mocked(getSession).mockResolvedValue(null)

    const response = await POST(request({
      sessionId: 'sess_other',
      feedbackType: 'gap_marked_wrong',
    }))

    expect(response.status).toBe(404)
    expect(createJobCompatibilityFeedback).not.toHaveBeenCalled()
  })

  it('stores assessment, catalog, and score versions without mutating assessment score', async () => {
    const session = buildSession()

    vi.mocked(getCurrentAppUser).mockResolvedValue(buildAppUser('usr_123'))
    vi.mocked(getSession).mockResolvedValue(session)
    vi.mocked(createJobCompatibilityFeedback).mockResolvedValue({
      id: 'feedback_123',
      userId: 'usr_123',
      sessionId: 'sess_123',
      assessmentVersion: 'job-compat-assessment-v1',
      catalogVersion: 'test-catalog@1.0.0',
      scoreVersion: 'job-compat-score-v1',
      feedbackType: 'score_disagreed',
      status: 'new',
      createdAt: '2026-05-02T12:00:00.000Z',
    })

    const originalScore = session.agentState.jobCompatibilityAssessmentShadow?.scoreBreakdown.total
    const response = await POST(request({
      sessionId: 'sess_123',
      feedbackType: 'score_disagreed',
      targetSignal: 'Unsupported signal',
      userComment: 'Tenho essa experiência em outro currículo.',
    }))

    expect(response.status).toBe(201)
    expect(createJobCompatibilityFeedback).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'usr_123',
      sessionId: 'sess_123',
      assessmentVersion: 'job-compat-assessment-v1',
      catalogVersion: 'test-catalog@1.0.0',
      scoreVersion: 'job-compat-score-v1',
      feedbackType: 'score_disagreed',
      targetSignal: 'Unsupported signal',
    }))
    expect(session.agentState.jobCompatibilityAssessmentShadow?.scoreBreakdown.total).toBe(originalScore)
  })
})
