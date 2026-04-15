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

  it('returns 401 before any session or target lookup when unauthenticated', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValue(null)

    const response = await GET(
      new NextRequest('https://example.com/api/session/sess_123'),
      { params: { id: 'sess_123' } },
    )

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(getSession).not.toHaveBeenCalled()
    expect(getResumeTargetsForSession).not.toHaveBeenCalled()
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
    expect(getResumeTargetsForSession).not.toHaveBeenCalled()
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
        workflowMode: 'job_targeting',
        parseStatus: 'parsed',
        parseConfidenceScore: 0.9,
        targetJobDescription: 'AWS role',
        targetFitAssessment: {
          level: 'partial',
          summary: 'O perfil atual parece parcialmente alinhado com a vaga-alvo, com sobreposição relevante, mas ainda com lacunas importantes.',
          reasons: ['Skill ausente ou pouco evidenciada: AWS'],
          assessedAt: '2026-03-27T12:00:00.000Z',
        },
        gapAnalysis: {
          result: {
            matchScore: 70,
            missingSkills: ['AWS'],
            weakAreas: ['summary'],
            improvementSuggestions: ['Add AWS to summary'],
          },
          analyzedAt: '2026-03-27T12:00:00.000Z',
        },
        targetingPlan: {
          targetRole: 'Aws Backend Engineer',
          targetRoleConfidence: 'high',
          focusKeywords: ['aws', 'typescript'],
          mustEmphasize: ['TypeScript'],
          shouldDeemphasize: [],
          missingButCannotInvent: ['AWS'],
          sectionStrategy: {
            summary: ['Align summary'],
            experience: ['Align bullets'],
            skills: ['Reorder skills'],
            education: ['Keep factual'],
            certifications: ['Highlight relevant items'],
          },
        },
        atsAnalysis: {
          result: {
            overallScore: 78,
            structureScore: 80,
            clarityScore: 74,
            impactScore: 72,
            keywordCoverageScore: 79,
            atsReadabilityScore: 83,
            issues: [
              {
                code: 'summary_clarity',
                severity: 'medium',
                message: 'Clarify the summary positioning.',
                section: 'summary',
              },
            ],
            recommendations: ['Clarify summary focus'],
          },
          analyzedAt: '2026-03-27T12:01:00.000Z',
        },
        atsWorkflowRun: {
          status: 'completed',
          currentStage: 'persist_version',
          attemptCount: 2,
          retriedSections: ['experience'],
          compactedSections: ['experience'],
          sectionAttempts: {
            summary: 1,
            experience: 2,
          },
          usageTotals: {
            sectionAttempts: 3,
            retriedSections: 1,
            compactedSections: 1,
          },
          updatedAt: '2026-03-27T12:02:30.000Z',
        },
        rewriteStatus: 'completed',
        optimizedCvState: {
          fullName: 'Ana Silva',
          email: 'ana@example.com',
          phone: '555-0100',
          summary: 'Platform-focused backend engineer with stronger ATS wording.',
          experience: [],
          skills: ['TypeScript', 'AWS'],
          education: [],
        },
        optimizedAt: '2026-03-27T12:02:00.000Z',
        optimizationSummary: {
          changedSections: ['summary', 'skills'],
          notes: ['Strengthened ATS clarity'],
        },
        lastRewriteMode: 'job_targeting',
        rewriteValidation: {
          valid: true,
          issues: [],
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
          workflowMode: 'job_targeting',
          parseStatus: 'parsed',
          parseConfidenceScore: 0.9,
          targetJobDescription: 'AWS role',
          targetFitAssessment: {
            level: 'partial',
            summary: 'O perfil atual parece parcialmente alinhado com a vaga-alvo, com sobreposição relevante, mas ainda com lacunas importantes.',
            reasons: ['Skill ausente ou pouco evidenciada: AWS'],
            assessedAt: '2026-03-27T12:00:00.000Z',
          },
          gapAnalysis: {
            result: {
              matchScore: 70,
              missingSkills: ['AWS'],
              weakAreas: ['summary'],
              improvementSuggestions: ['Add AWS to summary'],
            },
            analyzedAt: '2026-03-27T12:00:00.000Z',
          },
          targetingPlan: {
            targetRole: 'Aws Backend Engineer',
            targetRoleConfidence: 'high',
            focusKeywords: ['aws', 'typescript'],
            mustEmphasize: ['TypeScript'],
            shouldDeemphasize: [],
            missingButCannotInvent: ['AWS'],
            sectionStrategy: {
              summary: ['Align summary'],
              experience: ['Align bullets'],
              skills: ['Reorder skills'],
              education: ['Keep factual'],
              certifications: ['Highlight relevant items'],
            },
          },
          atsAnalysis: {
            result: {
              overallScore: 78,
              structureScore: 80,
              clarityScore: 74,
              impactScore: 72,
              keywordCoverageScore: 79,
              atsReadabilityScore: 83,
              issues: [
                {
                  code: 'summary_clarity',
                  severity: 'medium',
                  message: 'Clarify the summary positioning.',
                  section: 'summary',
                },
              ],
              recommendations: ['Clarify summary focus'],
            },
            analyzedAt: '2026-03-27T12:01:00.000Z',
          },
          atsWorkflowRun: {
            status: 'completed',
            currentStage: 'persist_version',
            attemptCount: 2,
            retriedSections: ['experience'],
            compactedSections: ['experience'],
            sectionAttempts: {
              summary: 1,
              experience: 2,
            },
            usageTotals: {
              sectionAttempts: 3,
              retriedSections: 1,
              compactedSections: 1,
            },
            updatedAt: '2026-03-27T12:02:30.000Z',
          },
          rewriteStatus: 'completed',
          optimizedCvState: {
            fullName: 'Ana Silva',
            email: 'ana@example.com',
            phone: '555-0100',
            summary: 'Platform-focused backend engineer with stronger ATS wording.',
            experience: [],
            skills: ['TypeScript', 'AWS'],
            education: [],
          },
          optimizedAt: '2026-03-27T12:02:00.000Z',
          optimizationSummary: {
            changedSections: ['summary', 'skills'],
            notes: ['Strengthened ATS clarity'],
          },
          lastRewriteMode: 'job_targeting',
          rewriteValidation: {
            valid: true,
            issues: [],
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
