import { describe, expect, it } from 'vitest'

import { buildOriginalProfileLabel, buildOverrideReviewHighlightState } from './override-review-highlights'
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
      expect.arrayContaining(['caution']),
    )
    expect(state.reviewItems).toEqual(expect.arrayContaining([
      expect.objectContaining({
        severity: 'risk',
        issueType: 'low_fit_target_role',
        title: 'Esta vaga parece distante do seu currículo atual',
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
          message: 'Cargo não comprovado no histórico.',
          offendingText: 'Desenvolvedor Java',
        }],
      },
    })
    const cvState = {
      ...session.cvState,
      summary: 'Desenvolvedor Java com experiência em eventos internos.',
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
          message: 'A vaga exige experiência distante do currículo.',
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

  it('builds specific copy for summary_skill_without_evidence with offending signal', () => {
    const session = buildSession({
      validationOverride: {
        enabled: true,
        acceptedAt: '2026-04-28T00:00:00.000Z',
        acceptedByUserId: 'usr_123',
        validationIssueCount: 1,
        hardIssueCount: 1,
        issueTypes: ['summary_skill_without_evidence'],
        issues: [{
          severity: 'high',
          issueType: 'summary_skill_without_evidence',
          message: 'Skill sem evidência.',
          offendingSignal: 'vendas consultivas',
        }],
      },
    })
    const state = buildOverrideReviewHighlightState({ session, cvState: session.cvState })
    expect(state.reviewItems?.[0]?.explanation).toContain('“vendas consultivas”')
  })

  it('exposes low-fit context with target role and original profile label', () => {
    const session = buildSession({
      validationOverride: {
        enabled: true,
        acceptedAt: '2026-04-28T00:00:00.000Z',
        acceptedByUserId: 'usr_123',
        validationIssueCount: 1,
        hardIssueCount: 1,
        targetRole: 'Vendedora/Vendedor JR',
        issueTypes: ['low_fit_target_role'],
        issues: [{
          severity: 'high',
          issueType: 'low_fit_target_role',
          message: 'A vaga parece distante.',
        }],
      },
      targetingPlan: {
        ...buildSession().agentState.targetingPlan!,
        lowFitWarningGate: {
          triggered: true,
          matchScore: 0.21,
          explicitEvidenceCount: 1,
          unsupportedGapCount: 5,
          unsupportedGapRatio: 0.83,
          explicitEvidenceRatio: 0.17,
          coreRequirementCoverage: {
            total: 6,
            supported: 1,
            unsupported: 5,
            unsupportedSignals: [],
            topUnsupportedSignalsForDisplay: ['metas comerciais', 'relacionamento com clientes'],
          },
        },
      },
    })
    const state = buildOverrideReviewHighlightState({ session, cvState: session.cvState })
    const item = state.reviewItems?.[0]
    expect(item).toEqual(expect.objectContaining({
      title: expect.stringMatching(/vaga.*distante|ader[eê]ncia/i),
      targetRole: 'Vendedora/Vendedor JR',
      provenProfile: expect.any(String),
      unsupportedRequirements: expect.arrayContaining(['metas comerciais']),
      whyItMatters: expect.stringMatching(/histórico original|comprovad|experiência/i),
      suggestedAction: expect.stringMatching(/revise|antes de enviar|transfer[ií]veis/i),
    }))
    expect(item?.unsupportedRequirements).not.toEqual(expect.arrayContaining([
      'Responsabilidades Da Posição',
      'precificando conforme padrão',
      'pendências de produtos da sua área',
    ]))
  })

  it('consolidates low-fit soft warnings into one target mismatch review card', () => {
    const session = buildSession({
      validationOverride: {
        enabled: true,
        acceptedAt: '2026-04-28T00:00:00.000Z',
        acceptedByUserId: 'usr_123',
        validationIssueCount: 2,
        hardIssueCount: 0,
        targetRole: 'Executivo De Vendas',
        acceptedLowFit: true,
        issueTypes: ['summary_skill_without_evidence', 'target_role_overclaim'],
        issues: [
          {
            severity: 'medium',
            section: 'summary',
            issueType: 'summary_skill_without_evidence',
            message: 'O resumo otimizado menciona skill sem evidência no currículo original.',
          },
          {
            severity: 'medium',
            section: 'summary',
            issueType: 'target_role_overclaim',
            message: 'O resumo targetizado passou a se apresentar diretamente como o cargo alvo sem evidência equivalente no currículo original.',
          },
        ],
      },
      targetingPlan: {
        ...buildSession().agentState.targetingPlan!,
        targetRole: 'Executivo De Vendas',
        targetRolePositioning: {
          targetRole: 'Executivo De Vendas',
          permission: 'must_not_claim_target_role',
          reason: 'career_fit_high_risk',
          safeRolePositioning: 'Profissional com SQL e Power BI.',
          forbiddenRoleClaims: ['Executivo De Vendas'],
        },
        lowFitWarningGate: {
          triggered: true,
          matchScore: 14,
          riskLevel: 'high',
          familyDistance: 'distant',
          explicitEvidenceCount: 0,
          unsupportedGapCount: 8,
          unsupportedGapRatio: 1,
          explicitEvidenceRatio: 0,
          coreRequirementCoverage: {
            total: 8,
            supported: 0,
            unsupported: 8,
            unsupportedSignals: [],
            topUnsupportedSignalsForDisplay: [
              'Prospectar novos leads',
              'Negociar e fechar vendas',
              'Formação superior completa',
            ],
          },
        },
      },
    })

    const state = buildOverrideReviewHighlightState({ session, cvState: session.cvState })
    const cards = state.reviewItems ?? []

    expect(cards).toHaveLength(1)
    expect(cards[0]).toEqual(expect.objectContaining({
      kind: 'low_fit_target_mismatch',
      title: expect.stringMatching(/vaga.*distante|ader[eÃª]ncia/i),
      targetRole: 'Executivo De Vendas',
    }))
    expect(cards[0]?.message).not.toMatch(/skill sem evid[êe]ncia|cargo alvo sem evid[êe]ncia/i)
  })
})

describe('buildOriginalProfileLabel', () => {
  it('returns a human profile label from CV fields', () => {
    const label = buildOriginalProfileLabel(buildSession().cvState)
    expect(label).toContain('SQL')
    expect(label.length).toBeGreaterThan(10)
  })
})
