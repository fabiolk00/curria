import { beforeEach, describe, expect, it, vi } from 'vitest'

import { decideSessionComparison } from './decision'

const { mockLogInfo } = vi.hoisted(() => ({
  mockLogInfo: vi.fn(),
}))

vi.mock('@/lib/observability/structured-log', () => ({
  logInfo: mockLogInfo,
}))

describe('session-comparison decision', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns a conflict decision when no optimized resume is available', async () => {
    const decision = await decideSessionComparison({
      request: new Request('https://example.com/api/session/sess_1/comparison') as never,
      params: { id: 'sess_1' },
      appUser: { id: 'usr_1' } as never,
      session: {
        id: 'sess_1',
        userId: 'usr_1',
        cvState: {
          fullName: 'Ana',
          email: 'ana@example.com',
          phone: '1',
          summary: 'base summary',
          experience: [],
          skills: [],
          education: [],
        },
        agentState: {
          workflowMode: 'ats_enhancement',
          lastRewriteMode: 'ats_enhancement',
        },
        generatedOutput: {
          status: 'idle',
        },
      } as never,
    })

    expect(decision).toEqual({
      kind: 'no_optimized_resume',
      status: 409,
      body: { error: 'No optimized resume found for this session.' },
    })
  })

  it('preserves preview-lock sanitization for ATS enhancement flows', async () => {
    const decision = await decideSessionComparison({
      request: new Request('https://example.com/api/session/sess_1/comparison') as never,
      params: { id: 'sess_1' },
      appUser: { id: 'usr_1' } as never,
      session: {
        id: 'sess_1',
        userId: 'usr_1',
        cvState: {
          fullName: 'Ana',
          email: 'ana@example.com',
          phone: '1',
          summary: 'Resumo original com foco em SQL e BI para analytics.',
          experience: [{
            title: 'Analista',
            company: 'Acme',
            startDate: '2022',
            endDate: 'present',
            bullets: ['Criei dashboards e reduzi o tempo de reporte em 20%.'],
          }],
          skills: ['SQL', 'Power BI', 'ETL'],
          education: [{
            degree: 'Sistemas',
            institution: 'USP',
            year: '2020',
          }],
        },
        agentState: {
          workflowMode: 'ats_enhancement',
          lastRewriteMode: 'ats_enhancement',
          highlightState: {
            source: 'rewritten_cv_state',
            version: 2,
            highlightSource: 'ats_enhancement',
            highlightGeneratedAt: '2026-04-22T12:00:00.000Z',
            generatedAt: '2026-04-22T12:00:00.000Z',
            resolvedHighlights: [{
              itemId: 'summary_0',
              section: 'summary',
              ranges: [{ start: 0, end: 6, reason: 'ats_strength' }],
            }],
          },
          rewriteValidation: {
            valid: true,
            issues: [],
          },
          optimizationSummary: {
            changedSections: ['summary', 'experience', 'skills'],
            notes: ['Resumo e experiência reforçados para ATS.'],
            keywordCoverageImprovement: ['SQL'],
          },
          optimizedCvState: {
            fullName: 'Ana',
            email: 'ana@example.com',
            phone: '1',
            summary: 'Resumo real que não deve vazar.',
            experience: [{
              title: 'Analista',
              company: 'Acme',
              startDate: '2022',
              endDate: 'present',
              bullets: ['Estruturei dashboards executivos e reduzi o tempo de reporte em 25%.'],
            }],
            skills: ['SQL', 'Power BI', 'ETL', 'Dashboards'],
            education: [{
              degree: 'Sistemas',
              institution: 'USP',
              year: '2020',
            }],
          },
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
            message: 'locked',
          },
        },
      } as never,
    })

    expect(decision.kind).toBe('success')
    if (decision.kind !== 'success') {
      throw new Error('expected success decision')
    }

    expect(decision.body.optimizedCvState).toMatchObject({
      fullName: 'Preview bloqueado',
    })
    expect(decision.body.previewLock).toMatchObject({
      locked: true,
      reason: 'free_trial_locked',
    })
    expect(decision.body.highlightState).toBeUndefined()
    expect(decision.body).not.toHaveProperty('originalScore')
    expect(decision.body).not.toHaveProperty('optimizedScore')
    expect(decision.body).not.toHaveProperty('atsReadiness')
    expect(mockLogInfo).toHaveBeenCalledWith('agent.highlight_state.response_evaluated', expect.objectContaining({
      surface: 'session_comparison',
      previewLocked: true,
      highlightStateResponseKind: 'omitted_preview_locked',
      highlightStateAvailable: true,
      highlightStateReturned: false,
      highlightStateOmittedReason: 'preview_locked',
      highlightStateResolvedRangeCount: 1,
    }))
  })

  it('keeps job-targeting comparison flows scoreless', async () => {
    const decision = await decideSessionComparison({
      request: new Request('https://example.com/api/session/sess_1/comparison') as never,
      params: { id: 'sess_1' },
      appUser: { id: 'usr_1' } as never,
      session: {
        id: 'sess_1',
        userId: 'usr_1',
        cvState: {
          fullName: 'Ana',
          email: 'ana@example.com',
          phone: '1',
          summary: 'base summary',
          experience: [],
          skills: ['SQL'],
          education: [],
        },
        agentState: {
          workflowMode: 'job_targeting',
          lastRewriteMode: 'job_targeting',
          targetJobDescription: 'Data role',
          optimizedCvState: {
            fullName: 'Ana',
            email: 'ana@example.com',
            phone: '1',
            summary: 'optimized summary',
            experience: [],
            skills: ['SQL', 'Python'],
            education: [],
          },
        },
        generatedOutput: {
          status: 'ready',
        },
      } as never,
    })

    expect(decision.kind).toBe('success')
    if (decision.kind !== 'success') {
      throw new Error('expected success decision')
    }

    expect(decision.body.generationType).toBe('JOB_TARGETING')
    expect(decision.body).not.toHaveProperty('originalScore')
    expect(decision.body).not.toHaveProperty('optimizedScore')
    expect(decision.body).not.toHaveProperty('atsReadiness')
    expect(mockLogInfo).toHaveBeenCalledWith('agent.highlight_state.response_evaluated', expect.objectContaining({
      surface: 'session_comparison',
      previewLocked: false,
      highlightStateResponseKind: 'omitted_artifact_missing',
      highlightStateAvailable: false,
      highlightStateReturned: false,
      highlightStateOmittedReason: 'artifact_missing',
    }))
  })

  it('backfills job-targeting score breakdown for existing generated sessions', async () => {
    const decision = await decideSessionComparison({
      request: new Request('https://example.com/api/session/sess_legacy_target/comparison') as never,
      params: { id: 'sess_legacy_target' },
      appUser: { id: 'usr_1' } as never,
      session: {
        id: 'sess_legacy_target',
        userId: 'usr_1',
        cvState: {
          fullName: 'Ana',
          email: 'ana@example.com',
          phone: '1',
          summary: 'base summary',
          experience: [{
            title: 'Analista de BI',
            company: 'Acme',
            startDate: '2022',
            endDate: 'present',
            bullets: ['Construí dashboards executivos em Power BI.'],
          }],
          skills: ['SQL', 'Power BI'],
          education: [{
            degree: 'Sistemas de Informação',
            institution: 'USP',
            year: '2020',
          }],
        },
        agentState: {
          workflowMode: 'job_targeting',
          lastRewriteMode: 'job_targeting',
          targetJobDescription: 'Data role',
          targetingPlan: {
            targetRole: 'Analista de BI',
            targetRoleConfidence: 'high',
            targetRoleSource: 'heuristic',
            focusKeywords: ['Power BI'],
            mustEmphasize: ['Power BI'],
            shouldDeemphasize: [],
            missingButCannotInvent: ['Gestão financeira de contas'],
            targetEvidence: [{
              jobSignal: 'Power BI',
              canonicalSignal: 'power bi',
              evidenceLevel: 'explicit',
              rewritePermission: 'can_claim_directly',
              matchedResumeTerms: ['Power BI'],
              supportingResumeSpans: ['Power BI'],
              rationale: 'Supported by skills.',
              confidence: 0.95,
              allowedRewriteForms: ['Power BI'],
              forbiddenRewriteForms: [],
              validationSeverityIfViolated: 'none',
            }],
            coreRequirementCoverage: {
              requirements: [
                {
                  signal: 'Power BI',
                  importance: 'core',
                  requirementKind: 'required',
                  evidenceLevel: 'explicit',
                  rewritePermission: 'can_claim_directly',
                },
                {
                  signal: 'Gestão financeira de contas',
                  importance: 'core',
                  requirementKind: 'required',
                  evidenceLevel: 'unsupported_gap',
                  rewritePermission: 'must_not_claim',
                },
              ],
              total: 2,
              supported: 1,
              unsupported: 1,
              unsupportedSignals: ['Gestão financeira de contas'],
              topUnsupportedSignalsForDisplay: ['Gestão financeira de contas'],
            },
            sectionStrategy: {
              summary: [],
              experience: [],
              skills: [],
              education: [],
              certifications: [],
            },
          },
          jobTargetingExplanation: {
            targetRole: 'Analista de BI',
            targetRoleConfidence: 'high',
            targetRecommendations: [],
            generatedAt: '2026-04-29T12:00:00.000Z',
            source: 'job_targeting',
            version: 1,
          },
          optimizedCvState: {
            fullName: 'Ana',
            email: 'ana@example.com',
            phone: '1',
            summary: 'optimized summary',
            experience: [],
            skills: ['SQL', 'Power BI'],
            education: [],
          },
        },
        generatedOutput: {
          status: 'ready',
        },
      } as never,
    })

    expect(decision.kind).toBe('success')
    if (decision.kind !== 'success') {
      throw new Error('expected success decision')
    }

    expect(decision.body.jobTargetingExplanation?.scoreBreakdown).toMatchObject({
      maxTotal: 100,
      items: expect.arrayContaining([
        expect.objectContaining({ id: 'skills', max: 100 }),
        expect.objectContaining({ id: 'experience', max: 100 }),
        expect.objectContaining({ id: 'education', max: 100 }),
      ]),
      criticalGaps: ['Gestão financeira de contas'],
    })
  })

  it('returns renderable highlightState for ATS enhancement flows', async () => {
    const highlightState = {
      source: 'rewritten_cv_state',
      version: 2,
      highlightSource: 'ats_enhancement',
      highlightGeneratedAt: '2026-04-22T12:00:00.000Z',
      generatedAt: '2026-04-22T12:00:00.000Z',
      resolvedHighlights: [{
        itemId: 'summary_0',
        section: 'summary',
        ranges: [{ start: 0, end: 9, reason: 'ats_strength' }],
      }],
    }

    const decision = await decideSessionComparison({
      request: new Request('https://example.com/api/session/sess_visible/comparison') as never,
      params: { id: 'sess_visible' },
      appUser: { id: 'usr_1' } as never,
      session: {
        id: 'sess_visible',
        userId: 'usr_1',
        cvState: {
          fullName: 'Ana',
          email: 'ana@example.com',
          phone: '1',
          summary: 'base summary',
          experience: [],
          skills: [],
          education: [],
        },
        agentState: {
          workflowMode: 'ats_enhancement',
          lastRewriteMode: 'ats_enhancement',
          highlightState,
          optimizedCvState: {
            fullName: 'Ana',
            email: 'ana@example.com',
            phone: '1',
            summary: 'optimized summary',
            experience: [],
            skills: [],
            education: [],
          },
        },
        generatedOutput: {
          status: 'ready',
        },
      } as never,
    })

    expect(decision.kind).toBe('success')
    if (decision.kind !== 'success') {
      throw new Error('expected success decision')
    }

    expect(decision.body.highlightState).toEqual(highlightState)
    expect(mockLogInfo).toHaveBeenCalledWith('agent.highlight_state.response_evaluated', expect.objectContaining({
      surface: 'session_comparison',
      highlightStateResponseKind: 'present_non_empty',
      highlightStateReturned: true,
      highlightStateOmittedReason: 'not_applicable',
      highlightStateResolvedRangeCount: 1,
      highlightStateVisibleRangeCount: 1,
      highlightStateRendererMismatch: false,
    }))
  })

  it('returns renderable highlightState for job_targeting flows', async () => {
    const highlightState = {
      source: 'rewritten_cv_state',
      version: 2,
      highlightSource: 'job_targeting',
      highlightGeneratedAt: '2026-04-22T12:00:00.000Z',
      generatedAt: '2026-04-22T12:00:00.000Z',
      resolvedHighlights: [{
        itemId: 'summary_0',
        section: 'summary',
        ranges: [{ start: 0, end: 9, reason: 'ats_strength' }],
      }],
    }

    const decision = await decideSessionComparison({
      request: new Request('https://example.com/api/session/sess_job_highlight/comparison') as never,
      params: { id: 'sess_job_highlight' },
      appUser: { id: 'usr_1' } as never,
      session: {
        id: 'sess_job_highlight',
        userId: 'usr_1',
        cvState: {
          fullName: 'Ana',
          email: 'ana@example.com',
          phone: '1',
          summary: 'base summary',
          experience: [],
          skills: ['SQL'],
          education: [],
        },
        agentState: {
          workflowMode: 'job_targeting',
          lastRewriteMode: 'job_targeting',
          targetJobDescription: 'Data role',
          highlightState,
          optimizedCvState: {
            fullName: 'Ana',
            email: 'ana@example.com',
            phone: '1',
            summary: 'optimized summary',
            experience: [],
            skills: ['SQL', 'Python'],
            education: [],
          },
        },
        generatedOutput: {
          status: 'ready',
        },
      } as never,
    })

    expect(decision.kind).toBe('success')
    if (decision.kind !== 'success') {
      throw new Error('expected success decision')
    }

    expect(decision.body.generationType).toBe('JOB_TARGETING')
    expect(decision.body.highlightState).toEqual(highlightState)
    expect(mockLogInfo).toHaveBeenCalledWith('agent.highlight_state.response_evaluated', expect.objectContaining({
      surface: 'session_comparison',
      previewLocked: false,
      highlightStateResponseKind: 'present_non_empty',
      highlightStateReturned: true,
      highlightStateVisibleRangeCount: 1,
      highlightStateRendererMismatch: false,
    }))
  })

  it('flags non-renderable comparison highlights when the artifact is present but resolves to zero visible spans', async () => {
    const decision = await decideSessionComparison({
      request: new Request('https://example.com/api/session/sess_mismatch/comparison') as never,
      params: { id: 'sess_mismatch' },
      appUser: { id: 'usr_1' } as never,
      session: {
        id: 'sess_mismatch',
        userId: 'usr_1',
        cvState: {
          fullName: 'Ana',
          email: 'ana@example.com',
          phone: '1',
          summary: 'base summary',
          experience: [],
          skills: [],
          education: [],
        },
        agentState: {
          workflowMode: 'ats_enhancement',
          lastRewriteMode: 'ats_enhancement',
          highlightState: {
            source: 'rewritten_cv_state',
            version: 2,
            highlightSource: 'ats_enhancement',
            highlightGeneratedAt: '2026-04-22T12:00:00.000Z',
            generatedAt: '2026-04-22T12:00:00.000Z',
            resolvedHighlights: [{
              itemId: 'missing_item',
              section: 'summary',
              ranges: [{ start: 0, end: 9, reason: 'ats_strength' }],
            }],
          },
          optimizedCvState: {
            fullName: 'Ana',
            email: 'ana@example.com',
            phone: '1',
            summary: 'optimized summary',
            experience: [],
            skills: [],
            education: [],
          },
        },
        generatedOutput: {
          status: 'ready',
        },
      } as never,
    })

    expect(decision.kind).toBe('success')
    if (decision.kind !== 'success') {
      throw new Error('expected success decision')
    }

    expect(decision.body.highlightState).toBeDefined()
    expect(mockLogInfo).toHaveBeenCalledWith('agent.highlight_state.response_evaluated', expect.objectContaining({
      surface: 'session_comparison',
      highlightStateResponseKind: 'present_non_renderable',
      highlightStateReturned: true,
      highlightStateResolvedRangeCount: 1,
      highlightStateVisibleRangeCount: 0,
      highlightStateRendererMismatch: true,
    }))
  })
})
