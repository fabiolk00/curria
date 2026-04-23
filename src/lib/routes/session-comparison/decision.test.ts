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

  it('preserves preview-lock sanitization and ATS Readiness labeling for ATS enhancement flows', async () => {
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
    expect(decision.body.originalScore.label).toBe('ATS Readiness Score')
    expect(decision.body.optimizedScore.label).toBe('ATS Readiness Score')
    expect(decision.body.atsReadiness?.scoreStatus).toBe('final')
    expect(decision.body.atsReadiness?.displayedReadinessScoreAfter ?? 0).toBeGreaterThanOrEqual(
      decision.body.atsReadiness?.displayedReadinessScoreBefore ?? 0,
    )
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

  it('uses job-targeting labels for job-targeting comparison flows', async () => {
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
    expect(decision.body.originalScore.label).toBe('Aderencia a vaga')
    expect(decision.body.optimizedScore.label).toBe('Aderencia a vaga')
    expect(mockLogInfo).toHaveBeenCalledWith('agent.highlight_state.response_evaluated', expect.objectContaining({
      surface: 'session_comparison',
      previewLocked: false,
      highlightStateResponseKind: 'omitted_artifact_missing',
      highlightStateAvailable: false,
      highlightStateReturned: false,
      highlightStateOmittedReason: 'artifact_missing',
    }))
  })

  it('classifies visible comparison highlights as present_non_empty', async () => {
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
          highlightState: {
            source: 'rewritten_cv_state',
            version: 2,
            generatedAt: '2026-04-22T12:00:00.000Z',
            resolvedHighlights: [{
              itemId: 'summary_0',
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
      highlightStateResponseKind: 'present_non_empty',
      highlightStateReturned: true,
      highlightStateOmittedReason: 'not_applicable',
      highlightStateResolvedRangeCount: 1,
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
