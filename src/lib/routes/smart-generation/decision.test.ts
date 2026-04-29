import { beforeEach, describe, expect, it, vi } from 'vitest'

import { executeSmartGenerationDecision } from './decision'
import { buildGenerationCopy, resolveWorkflowMode } from './decision'
import { dispatchSmartGenerationArtifact, runSmartGenerationPipeline } from './dispatch'
import { bootstrapSmartGenerationSession } from './session-bootstrap'
import { resetSmartGenerationStartLocksForTests } from '@/lib/agent/smart-generation-start-lock'

vi.mock('./readiness', () => ({
  evaluateSmartGenerationResumeReadiness: vi.fn(() => null),
  evaluateSmartGenerationQuotaReadiness: vi.fn(async () => null),
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
  beforeEach(() => {
    vi.clearAllMocks()
    resetSmartGenerationStartLocksForTests()
  })

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

  it('returns the recoverable low-fit validation block and never dispatches generate_file automatically', async () => {
    vi.mocked(bootstrapSmartGenerationSession).mockResolvedValueOnce({
      session: { id: 'sess_low_fit' } as never,
      patchedSession: {
        id: 'sess_low_fit',
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
          targetingPlan: {
            targetRole: 'Desenvolvedor Java',
            targetRoleConfidence: 'high',
            targetRoleSource: 'heuristic',
          },
        },
        generatedOutput: { status: 'idle' },
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never,
    })
    vi.mocked(runSmartGenerationPipeline).mockResolvedValueOnce({
      success: false,
      error: 'Job targeting rewrite validation failed.',
      validation: {
        blocked: true,
        valid: false,
        recoverable: true,
        hardIssues: [{
          severity: 'high',
          section: 'summary',
          issueType: 'target_role_overclaim',
          message: 'A vaga de Desenvolvedor Java ficou distante demais do histórico comprovado no currículo original para geração automática segura.',
        }],
        softWarnings: [],
        issues: [{
          severity: 'high',
          section: 'summary',
          issueType: 'target_role_overclaim',
          message: 'A vaga de Desenvolvedor Java ficou distante demais do histórico comprovado no currículo original para geração automática segura.',
        }],
      },
      recoverableBlock: {
        status: 'validation_blocked_recoverable',
        overrideToken: 'override_low_fit',
        expiresAt: '2099-04-27T16:00:00.000Z',
        modal: {
          title: 'Esta vaga parece muito distante do seu currículo atual',
          description: 'Encontramos poucos pontos comprovados no seu currículo para os requisitos principais desta vaga.',
          primaryProblem: 'A vaga pede Java, Spring Boot e CI/CD, mas seu histórico atual sustenta melhor outra trajetória profissional.',
          problemBullets: ['Encontramos alguns pontos próximos, como SQL, mas eles não sustentam uma apresentação direta como Desenvolvedor Java.'],
          reassurance: 'Isso não significa que você não pode se candidatar. Significa apenas que essa versão pode ficar pouco aderente ou parecer forçada.',
          recommendation: 'Você pode gerar mesmo assim e revisar manualmente antes de enviar.',
          actions: {
            secondary: {
              label: 'Fechar',
              action: 'close',
            },
            primary: {
              label: 'Gerar mesmo assim (1 crédito)',
              action: 'override_generate',
              creditCost: 1,
            },
          },
        },
      },
    } as never)

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
      targetJobDescription: 'Cargo: Desenvolvedor Java',
    })

    expect(decision).toEqual(expect.objectContaining({
      kind: 'validation_error',
      status: 422,
      body: expect.objectContaining({
        recoverableValidationBlock: expect.objectContaining({
          overrideToken: 'override_low_fit',
        }),
      }),
    }))
    expect(dispatchSmartGenerationArtifact).not.toHaveBeenCalled()
  })

  it('returns recoverable validation again for the same job-targeting start instead of already_completed', async () => {
    const cvState = {
      fullName: 'Ana',
      email: 'ana@example.com',
      phone: '555-0100',
      summary: 'Resumo base',
      experience: [{ title: 'Analista', company: 'Acme', startDate: '2022', endDate: '2024', bullets: ['Entrega'] }],
      skills: ['SQL'],
      education: [],
    }
    const patchedSession = {
      id: 'sess_recoverable',
      userId: 'usr_1',
      phase: 'intake',
      stateVersion: 1,
      cvState,
      agentState: {
        parseStatus: 'parsed',
        rewriteHistory: {},
        targetingPlan: {
          targetRole: 'Desenvolvedor Java',
          targetRoleConfidence: 'high',
          targetRoleSource: 'heuristic',
        },
      },
      generatedOutput: { status: 'idle' },
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    const recoverablePipelineResult = {
      success: false,
      error: 'Job targeting rewrite validation failed.',
      validation: {
        blocked: true,
        valid: false,
        recoverable: true,
        hardIssues: [{
          severity: 'high',
          section: 'summary',
          issueType: 'target_role_overclaim',
          message: 'The target role is not supported by the original resume.',
        }],
        softWarnings: [],
        issues: [{
          severity: 'high',
          section: 'summary',
          issueType: 'target_role_overclaim',
          message: 'The target role is not supported by the original resume.',
        }],
      },
      recoverableBlock: {
        status: 'validation_blocked_recoverable',
        overrideToken: 'override_retry',
        expiresAt: '2099-04-27T16:00:00.000Z',
        modal: {
          title: 'Review needed',
          description: 'The target is distant from the current resume.',
          primaryProblem: 'The rewrite would overstate the candidate profile.',
          problemBullets: ['The core target requirements are not evidenced.'],
          reassurance: 'The user can still review and override manually.',
          actions: {
            secondary: {
              label: 'Fechar',
              action: 'close',
            },
            primary: {
              label: 'Gerar mesmo assim (1 crédito)',
              action: 'override_generate',
              creditCost: 1,
            },
          },
        },
      },
    }
    vi.mocked(bootstrapSmartGenerationSession)
      .mockResolvedValueOnce({
        session: { id: 'sess_recoverable' } as never,
        patchedSession: patchedSession as never,
      })
      .mockResolvedValueOnce({
        session: { id: 'sess_recoverable_retry' } as never,
        patchedSession: patchedSession as never,
      })
    vi.mocked(runSmartGenerationPipeline)
      .mockResolvedValueOnce(recoverablePipelineResult as never)
      .mockResolvedValueOnce(recoverablePipelineResult as never)

    const context = {
      request: {} as never,
      appUser: { id: 'usr_1' } as never,
      cvState,
      targetJobDescription: 'Cargo: Desenvolvedor Java',
    }

    const firstDecision = await executeSmartGenerationDecision(context)
    const retryDecision = await executeSmartGenerationDecision(context)

    expect(firstDecision).toEqual(expect.objectContaining({
      kind: 'validation_error',
      status: 422,
      body: expect.objectContaining({
        recoverableValidationBlock: expect.objectContaining({
          overrideToken: 'override_retry',
        }),
      }),
    }))
    expect(retryDecision).toEqual(expect.objectContaining({
      kind: 'validation_error',
      status: 422,
      body: expect.objectContaining({
        recoverableValidationBlock: expect.objectContaining({
          overrideToken: 'override_retry',
        }),
      }),
    }))
    expect(retryDecision).not.toEqual(expect.objectContaining({
      kind: 'success',
      body: expect.objectContaining({
        status: 'already_completed',
      }),
    }))
    expect(bootstrapSmartGenerationSession).toHaveBeenCalledTimes(2)
    expect(runSmartGenerationPipeline).toHaveBeenCalledTimes(2)
    expect(dispatchSmartGenerationArtifact).not.toHaveBeenCalled()
  })

  it('marks the start lock failed when session bootstrap throws after acquisition', async () => {
    const context = {
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
      targetJobDescription: 'Cargo: Desenvolvedor Java',
    }

    vi.mocked(bootstrapSmartGenerationSession).mockRejectedValueOnce(new Error('bootstrap failed'))

    await expect(executeSmartGenerationDecision(context)).rejects.toThrow('bootstrap failed')
    const retryDecision = await executeSmartGenerationDecision(context)

    expect(retryDecision).toEqual({
      kind: 'validation_error',
      status: 409,
      body: {
        error: 'The optimized resume state is no longer coherent with the export handoff.',
        code: 'PRECONDITION_FAILED',
      },
    })
    expect(bootstrapSmartGenerationSession).toHaveBeenCalledTimes(2)
  })

  it('marks the start lock failed when the smart-generation pipeline throws after acquisition', async () => {
    const context = {
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
      targetJobDescription: 'Cargo: Desenvolvedor Java',
    }

    vi.mocked(runSmartGenerationPipeline).mockRejectedValueOnce(new Error('pipeline failed'))

    await expect(executeSmartGenerationDecision(context)).rejects.toThrow('pipeline failed')
    const retryDecision = await executeSmartGenerationDecision(context)

    expect(retryDecision).toEqual({
      kind: 'validation_error',
      status: 409,
      body: {
        error: 'The optimized resume state is no longer coherent with the export handoff.',
        code: 'PRECONDITION_FAILED',
      },
    })
    expect(runSmartGenerationPipeline).toHaveBeenCalledTimes(2)
  })
})
