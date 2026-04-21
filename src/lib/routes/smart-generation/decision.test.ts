import { describe, expect, it, vi } from 'vitest'

import { executeSmartGenerationDecision } from './decision'
import { buildGenerationCopy, resolveWorkflowMode } from './decision'
import { bootstrapSmartGenerationSession } from './session-bootstrap'

vi.mock('./readiness', () => ({
  evaluateSmartGenerationReadiness: vi.fn(async () => null),
}))

vi.mock('./generation-validation', () => ({
  evaluateSmartGenerationValidation: vi.fn(() => null),
}))

vi.mock('./session-bootstrap', () => ({
  bootstrapSmartGenerationSession: vi.fn(async () => ({
    session: { id: 'sess_1' },
    patchedSession: {
      id: 'sess_1',
      userId: 'usr_1',
      phase: 'intake',
      stateVersion: 1,
      cvState: {
        fullName: 'Ana',
        email: 'ana@example.com',
        phone: '555-0100',
        summary: 'Resumo base',
        experience: [{ title: 'Analista', company: 'Acme', startDate: '2022', endDate: '2024', bullets: ['Entrega'] }],
        skills: ['SQL'],
        education: [],
      },
      agentState: {
        parseStatus: 'parsed',
        rewriteHistory: {},
      },
      generatedOutput: { status: 'idle' },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  })),
}))

vi.mock('./dispatch', () => ({
  runSmartGenerationPipeline: vi.fn(async () => ({
    success: true,
    optimizedCvState: {
      fullName: 'Ana',
      email: 'ana@example.com',
      phone: '555-0100',
      summary: 'Resumo otimizado',
      experience: [{ title: 'Analista', company: 'Acme', startDate: '2022', endDate: '2024', bullets: ['Entrega'] }],
      skills: ['SQL', 'Power BI'],
      education: [],
    },
  })),
  dispatchSmartGenerationArtifact: vi.fn(),
}))

vi.mock('@/lib/db/cv-versions', () => ({
  getLatestCvVersionForScope: vi.fn(async () => null),
}))

describe('smart-generation helpers', () => {
  it('resolves workflow mode from target job description presence', () => {
    expect(resolveWorkflowMode()).toBe('ats_enhancement')
    expect(resolveWorkflowMode('vaga alvo')).toBe('job_targeting')
  })

  it('builds the current generation copy for ATS mode', () => {
    expect(buildGenerationCopy('ats_enhancement')).toEqual({
      incompleteError: 'Complete seu currículo para gerar uma versão ATS.',
      creditsError: 'Seus créditos acabaram. Recarregue seu saldo para gerar uma versão ATS.',
      pipelineError: 'Não foi possível melhorar sua versão ATS agora.',
      generationType: 'ATS_ENHANCEMENT',
      idempotencyKeyPrefix: 'profile-ats',
    })
  })

  it('fails early when the persisted handoff source is not coherent before generate_file dispatch', async () => {
    const decision = await executeSmartGenerationDecision({
      request: {} as never,
      appUser: { id: 'usr_1' } as never,
      cvState: {
        fullName: 'Ana',
        email: 'ana@example.com',
        phone: '555-0100',
        summary: 'Resumo base',
        experience: [{ title: 'Analista', company: 'Acme', startDate: '2022', endDate: '2024', bullets: ['Entrega'] }],
        skills: ['SQL'],
        education: [],
      },
    })

    expect(decision).toEqual({
      kind: 'validation_error',
      status: 409,
      body: {
        error: 'The optimized resume state is no longer coherent with the export handoff.',
        code: 'PRECONDITION_FAILED',
      },
    })
  })

  it('fails early when the patched session is missing the optimized handoff source', async () => {
    vi.mocked(bootstrapSmartGenerationSession).mockResolvedValueOnce({
      session: { id: 'sess_1' } as never,
      patchedSession: {
        id: 'sess_1',
        userId: 'usr_1',
        phase: 'intake',
        stateVersion: 1,
        cvState: {
          fullName: 'Ana',
          email: 'ana@example.com',
          phone: '555-0100',
          summary: 'Resumo base',
          experience: [{ title: 'Analista', company: 'Acme', startDate: '2022', endDate: '2024', bullets: ['Entrega'] }],
          skills: ['SQL'],
          education: [],
        },
        agentState: {
          parseStatus: 'parsed',
          rewriteHistory: {},
        },
        generatedOutput: { status: 'idle' },
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never,
    })

    const decision = await executeSmartGenerationDecision({
      request: {} as never,
      appUser: { id: 'usr_1' } as never,
      cvState: {
        fullName: 'Ana',
        email: 'ana@example.com',
        phone: '555-0100',
        summary: 'Resumo base',
        experience: [{ title: 'Analista', company: 'Acme', startDate: '2022', endDate: '2024', bullets: ['Entrega'] }],
        skills: ['SQL'],
        education: [],
      },
    })

    expect(decision).toEqual({
      kind: 'validation_error',
      status: 409,
      body: {
        error: 'The optimized resume state is no longer coherent with the export handoff.',
        code: 'PRECONDITION_FAILED',
      },
    })
  })
})
