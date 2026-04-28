import { describe, expect, it } from 'vitest'

import { buildOverrideReviewHighlightState } from './override-review-highlights'
import type { Session } from '@/types/agent'

function buildSession(overrides: Partial<Session['agentState']> = {}): Session {
  return {
    id: 'sess_review',
    userId: 'usr_123',
    phase: 'dialog',
    stateVersion: 1,
    cvState: {
      fullName: 'Ana Silva',
      email: 'ana@example.com',
      phone: '555-0100',
      summary: 'Analista com SQL e Power BI.',
      experience: [{
        title: 'Analista',
        company: 'Acme',
        startDate: '2022',
        endDate: '2024',
        bullets: ['Criei dashboards em Power BI para eventos internos.'],
      }],
      skills: ['SQL', 'Power BI'],
      education: [],
    },
    agentState: {
      workflowMode: 'job_targeting',
      targetingPlan: {
        targetRole: 'Analista de Marketing e Eventos',
        targetRoleConfidence: 'high',
        targetRoleSource: 'llm',
        focusKeywords: [],
        mustEmphasize: [],
        shouldDeemphasize: [],
        missingButCannotInvent: [],
        rewritePermissions: {
          directClaimsAllowed: ['Power BI'],
          normalizedClaimsAllowed: [],
          bridgeClaimsAllowed: [],
          relatedButNotClaimable: [],
          forbiddenClaims: [],
          skillsSurfaceAllowed: [],
        },
        safeTargetingEmphasis: {
          safeDirectEmphasis: ['Power BI'],
          cautiousBridgeEmphasis: [{
            jobSignal: 'eventos',
            safeWording: 'eventos internos',
            supportingTerms: ['eventos internos'],
            forbiddenWording: ['gestao de eventos'],
          }],
          forbiddenDirectClaims: [],
        },
        sectionStrategy: {
          summary: [],
          experience: [],
          skills: [],
          education: [],
          certifications: [],
        },
      },
      validationOverride: {
        enabled: true,
        acceptedAt: '2026-04-28T00:00:00.000Z',
        acceptedByUserId: 'usr_123',
        validationIssueCount: 1,
        hardIssueCount: 1,
        issueTypes: ['low_fit_target_role'],
        issues: [{
          severity: 'high',
          issueType: 'low_fit_target_role',
          message: 'A vaga parece pouco aderente ao historico.',
          offendingText: 'Marketing e Eventos',
        }],
      },
      ...overrides,
    },
    generatedOutput: {
      status: 'ready',
    },
    creditsUsed: 1,
    messageCount: 0,
    creditConsumed: true,
    createdAt: new Date('2026-04-28T00:00:00.000Z'),
    updatedAt: new Date('2026-04-28T00:00:00.000Z'),
  } as Session
}

describe('buildOverrideReviewHighlightState', () => {
  it('creates override review highlights and keeps unmatched issues in the panel', () => {
    const session = buildSession()
    const state = buildOverrideReviewHighlightState({
      session,
      cvState: session.cvState,
      generatedAt: '2026-04-28T00:00:00.000Z',
    })

    expect(state.highlightMode).toBe('override_review')
    expect(state.resolvedHighlights.flatMap((item) => item.ranges.map((range) => range.reason))).toEqual(
      expect.arrayContaining(['supported', 'caution']),
    )
    expect(state.reviewItems).toEqual(expect.arrayContaining([
      expect.objectContaining({
        severity: 'risk',
        issueType: 'low_fit_target_role',
        inline: false,
      }),
    ]))
  })

  it('marks an offendingText found in the generated CV as an inline risk highlight', () => {
    const session = buildSession({
      validationOverride: {
        enabled: true,
        acceptedAt: '2026-04-28T00:00:00.000Z',
        acceptedByUserId: 'usr_123',
        validationIssueCount: 1,
        hardIssueCount: 1,
        issueTypes: ['unsupported_claim'],
        issues: [{
          severity: 'high',
          issueType: 'unsupported_claim',
          message: 'Cargo nao comprovado no historico.',
          offendingText: 'Desenvolvedor Java',
        }],
      },
    })
    const cvState = {
      ...session.cvState,
      summary: 'Desenvolvedor Java com experiencia em eventos internos.',
    }

    const state = buildOverrideReviewHighlightState({
      session,
      cvState,
      generatedAt: '2026-04-28T00:00:00.000Z',
    })

    expect(state.resolvedHighlights).toEqual(expect.arrayContaining([
      expect.objectContaining({
        itemId: 'summary_0',
        ranges: expect.arrayContaining([
          expect.objectContaining({ reason: 'risk' }),
        ]),
      }),
    ]))
    expect(state.reviewItems).toEqual(expect.arrayContaining([
      expect.objectContaining({
        severity: 'risk',
        offendingText: 'Desenvolvedor Java',
        inline: true,
      }),
    ]))
  })

  it('keeps issues without offending text in the review panel without inline risk ranges', () => {
    const session = buildSession({
      validationOverride: {
        enabled: true,
        acceptedAt: '2026-04-28T00:00:00.000Z',
        acceptedByUserId: 'usr_123',
        validationIssueCount: 1,
        hardIssueCount: 1,
        issueTypes: ['low_fit_target_role'],
        issues: [{
          severity: 'high',
          issueType: 'low_fit_target_role',
          message: 'A vaga exige experiencia distante do curriculo.',
        }],
      },
    })

    const state = buildOverrideReviewHighlightState({
      session,
      cvState: session.cvState,
      generatedAt: '2026-04-28T00:00:00.000Z',
    })

    expect(state.reviewItems).toEqual(expect.arrayContaining([
      expect.objectContaining({
        severity: 'risk',
        issueType: 'low_fit_target_role',
        inline: false,
      }),
    ]))
    expect(state.resolvedHighlights.flatMap((item) => item.ranges)).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ reason: 'risk' })]),
    )
  })
})
