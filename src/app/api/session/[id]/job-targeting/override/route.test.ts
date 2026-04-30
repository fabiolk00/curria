import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { POST } from './route'
import { tryAcquireOverrideProcessingLock } from '@/lib/agent/job-targeting/override-processing-lock'
import { runJobTargetingPipeline } from '@/lib/agent/job-targeting-pipeline'
import { getCurrentAppUser } from '@/lib/auth/app-user'
import { createCvVersion } from '@/lib/db/cv-versions'
import { getSession, updateSession } from '@/lib/db/sessions'
import { generateBillableResume } from '@/lib/resume-generation/generate-billable-resume'

vi.mock('@/lib/auth/app-user', () => ({
  getCurrentAppUser: vi.fn(),
}))

vi.mock('@/lib/db/sessions', () => ({
  getSession: vi.fn(),
  updateSession: vi.fn(),
}))

vi.mock('@/lib/db/cv-versions', () => ({
  createCvVersion: vi.fn(),
}))

vi.mock('@/lib/resume-generation/generate-billable-resume', () => ({
  generateBillableResume: vi.fn(),
}))

vi.mock('@/lib/agent/job-targeting-pipeline', () => ({
  runJobTargetingPipeline: vi.fn(),
}))

vi.mock('@/lib/agent/job-targeting/override-processing-lock', () => ({
  hashOverrideToken: vi.fn((token: string) => `hash:${token}`),
  tryAcquireOverrideProcessingLock: vi.fn(),
}))

function buildCvState() {
  return {
    fullName: 'Ana Silva',
    email: 'ana@example.com',
    phone: '555-0100',
    linkedin: 'https://linkedin.com/in/ana',
    location: 'Sao Paulo',
    summary: 'Profissional de BI e dados com foco em automacao.',
    experience: [{
      title: 'Analista de Dados',
      company: 'Acme',
      startDate: '2022',
      endDate: '2024',
      bullets: ['Automatizei dashboards e integrações.'],
    }],
    skills: ['SQL', 'Power BI', 'Power Automate'],
    education: [],
    certifications: [],
  }
}

function buildSession(): any {
  const optimizedCvState = {
    ...buildCvState(),
    summary: 'Profissional de BI e dados com experiência em dashboards, automação e integração de dados.',
  }

  return {
    id: 'sess_123',
    userId: 'usr_123',
    stateVersion: 1,
    phase: 'intake',
    cvState: buildCvState(),
    agentState: {
      parseStatus: 'parsed',
      rewriteHistory: {},
      workflowMode: 'job_targeting',
      targetJobDescription: 'Vaga para Analista de Sistemas de RH',
      rewriteStatus: 'failed',
      rewriteValidation: {
        blocked: true,
        valid: false,
        hardIssues: [{
          severity: 'high' as const,
          section: 'summary',
          issueType: 'target_role_overclaim' as const,
          message: 'O resumo assumiu o cargo alvo diretamente.',
        }],
        softWarnings: [],
        issues: [{
          severity: 'high' as const,
          section: 'summary',
          issueType: 'target_role_overclaim' as const,
          message: 'O resumo assumiu o cargo alvo diretamente.',
        }],
      },
      blockedTargetedRewriteDraft: {
        id: 'draft_123',
        token: 'override_token_123',
        sessionId: 'sess_123',
        userId: 'usr_123',
        optimizedCvState,
        originalCvState: buildCvState(),
        optimizationSummary: {
          changedSections: ['summary'],
          notes: ['Resumo reescrito para a vaga alvo.'],
        },
        targetJobDescription: 'Vaga para Analista de Sistemas de RH',
        targetRole: 'Analista de Sistemas de RH',
        validationIssues: [{
          severity: 'high' as const,
          section: 'summary',
          issueType: 'target_role_overclaim' as const,
          message: 'O resumo assumiu o cargo alvo diretamente.',
        }],
        recoverable: true,
        createdAt: '2026-04-27T15:00:00.000Z',
        expiresAt: '2099-04-27T15:20:00.000Z',
      },
      recoverableValidationBlock: {
        status: 'validation_blocked_recoverable' as const,
        overrideToken: 'override_token_123',
        expiresAt: '2099-04-27T15:20:00.000Z',
        modal: {
          title: 'Encontramos pontos que podem exagerar sua experiência',
          description: 'A adaptação ficou mais agressiva do que o seu currículo original comprova.',
          primaryProblem: 'O resumo tentou assumir diretamente o cargo alvo.',
          problemBullets: ['People Analytics apareceu como experiência direta.'],
          reassurance: 'Você ainda pode gerar o currículo, mas recomendamos revisar.',
          actions: {
            secondary: {
              label: 'Fechar' as const,
              action: 'close' as const,
            },
            primary: {
              label: 'Gerar mesmo assim (1 crédito)' as const,
              action: 'override_generate' as const,
              creditCost: 1,
            },
          },
        },
      },
    },
    generatedOutput: { status: 'idle' as const },
    creditsUsed: 0,
    messageCount: 0,
    creditConsumed: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

function buildPreRewriteLowFitSession(): any {
  const session = buildSession()

  return {
    ...session,
    agentState: {
      ...session.agentState,
      rewriteValidation: {
        blocked: true,
        valid: false,
        hardIssues: [{
          severity: 'high' as const,
          section: 'summary',
          issueType: 'low_fit_target_role' as const,
          message: 'Esta vaga parece muito distante do seu currículo atual.',
        }],
        softWarnings: [],
        issues: [{
          severity: 'high' as const,
          section: 'summary',
          issueType: 'low_fit_target_role' as const,
          message: 'Esta vaga parece muito distante do seu currículo atual.',
        }],
      },
      blockedTargetedRewriteDraft: {
        ...session.agentState.blockedTargetedRewriteDraft,
        kind: 'pre_rewrite_low_fit_block' as const,
        optimizedCvState: undefined,
      },
      recoverableValidationBlock: {
        ...session.agentState.recoverableValidationBlock,
        kind: 'pre_rewrite_low_fit_block' as const,
      },
    },
  }
}

function buildProcessingState() {
  return {
    status: 'processing' as const,
    startedAt: '2026-04-27T15:00:00.000Z',
    expiresAt: '2026-04-27T15:05:00.000Z',
    requestId: 'req_lock_123',
    idempotencyKey: 'profile-target-override:sess_123:draft_123',
    overrideTokenHash: 'hash:override_token_123',
  }
}

function buildLockAcquiredResult(session = buildSession()) {
  const draft = session.agentState.blockedTargetedRewriteDraft

  if (!draft || !session.agentState.recoverableValidationBlock) {
    throw new Error('Expected recoverable draft fixture.')
  }

  const processingState = buildProcessingState()

  return {
    acquired: true as const,
    session: {
      ...session,
      agentState: {
        ...session.agentState,
        blockedTargetedRewriteDraft: {
          ...draft,
          overrideProcessing: processingState,
        },
        recoverableValidationBlock: {
          ...session.agentState.recoverableValidationBlock,
          overrideProcessing: processingState,
        },
      },
    },
    draft: {
      ...draft,
      overrideProcessing: processingState,
    },
    processingState,
    expiredLockReclaimed: false,
  }
}

function buildRequest(body: Record<string, unknown>) {
  return new NextRequest('https://example.com/api/session/sess_123/job-targeting/override', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'https://example.com',
    },
    body: JSON.stringify(body),
  })
}

describe('POST /api/session/[id]/job-targeting/override', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentAppUser).mockResolvedValue({
      id: 'usr_123',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      authIdentity: {
        id: 'identity_123',
        userId: 'usr_123',
        provider: 'clerk',
        providerSubject: 'clerk_123',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      creditAccount: {
        id: 'cred_123',
        userId: 'usr_123',
        creditsRemaining: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    } as never)
    vi.mocked(getSession).mockResolvedValue(buildSession() as never)
    vi.mocked(updateSession).mockResolvedValue(undefined)
    vi.mocked(tryAcquireOverrideProcessingLock).mockResolvedValue(buildLockAcquiredResult() as never)
    vi.mocked(runJobTargetingPipeline).mockResolvedValue({
      success: true,
      optimizedCvState: buildCvState(),
      validation: {
        blocked: false,
        valid: true,
        hardIssues: [],
        softWarnings: [],
        issues: [],
      },
    } as never)
    vi.mocked(createCvVersion).mockResolvedValue({
      id: 'ver_123',
      sessionId: 'sess_123',
      snapshot: buildCvState(),
      source: 'job-targeting',
      createdAt: new Date(),
    } as never)
  })

  it('persists the blocked rewrite and generates the override through the billable path', async () => {
    vi.mocked(generateBillableResume).mockResolvedValue({
      output: {
        success: true,
        creditsUsed: 1,
        resumeGenerationId: 'gen_123',
      },
      generatedOutput: {
        status: 'ready',
        pdfPath: 'usr_123/sess_123/resume.pdf',
        docxPath: null,
        generatedAt: '2026-04-27T15:01:00.000Z',
      },
    } as never)

    const response = await POST(buildRequest({
      overrideToken: 'override_token_123',
      consumeCredit: true,
    }), {
      params: { id: 'sess_123' },
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      success: true,
      sessionId: 'sess_123',
      creditsUsed: 1,
      resumeGenerationId: 'gen_123',
      generationType: 'JOB_TARGETING',
      generationSource: 'job_targeting_override',
    })
    expect(tryAcquireOverrideProcessingLock).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: 'sess_123',
      userId: 'usr_123',
      initialSession: expect.objectContaining({
        id: 'sess_123',
        stateVersion: 1,
      }),
      draftId: 'draft_123',
      overrideToken: 'override_token_123',
    }))
    expect(getSession).toHaveBeenCalledTimes(1)
    expect(createCvVersion).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: 'sess_123',
      source: 'job-targeting',
    }))
    expect(generateBillableResume).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'usr_123',
        sessionId: 'sess_123',
        idempotencyKey: 'profile-target-override:sess_123:draft_123',
        latestVersionId: 'ver_123',
        latestVersionSource: 'job-targeting',
        skipCreditPrecheck: true,
      }),
    )
    expect(updateSession).toHaveBeenLastCalledWith('sess_123', expect.objectContaining({
      agentState: expect.objectContaining({
        rewriteStatus: 'completed',
        validationOverride: expect.objectContaining({
          enabled: true,
          targetRole: 'Analista de Sistemas de RH',
          overrideTokenHash: 'hash:override_token_123',
          cvVersionId: 'ver_123',
          resumeGenerationId: 'gen_123',
        }),
        blockedTargetedRewriteDraft: undefined,
        recoverableValidationBlock: undefined,
      }),
    }))
  })

  it('runs the targeted pipeline only after confirmation for pre-rewrite low-fit blocks', async () => {
    const lowFitSession = buildPreRewriteLowFitSession()
    vi.mocked(getSession).mockResolvedValue(lowFitSession as never)
    vi.mocked(tryAcquireOverrideProcessingLock).mockResolvedValue(buildLockAcquiredResult(lowFitSession) as never)
    vi.mocked(runJobTargetingPipeline).mockResolvedValue({
      success: true,
      optimizedCvState: {
        ...buildCvState(),
        summary: 'Versão gerada após confirmação explícita de low-fit.',
      },
      acceptedLowFitFallbackUsed: true,
      validation: {
        blocked: false,
        valid: true,
        hardIssues: [],
        softWarnings: [],
        issues: [],
      },
    } as never)
    vi.mocked(generateBillableResume).mockResolvedValue({
      output: {
        success: true,
        creditsUsed: 1,
        resumeGenerationId: 'gen_low_fit_123',
      },
      generatedOutput: {
        status: 'ready',
        pdfPath: 'usr_123/sess_123/resume.pdf',
        docxPath: null,
        generatedAt: '2026-04-27T15:01:00.000Z',
      },
    } as never)

    const response = await POST(buildRequest({
      overrideToken: 'override_token_123',
      consumeCredit: true,
    }), {
      params: { id: 'sess_123' },
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      success: true,
      sessionId: 'sess_123',
      creditsUsed: 1,
      resumeGenerationId: 'gen_low_fit_123',
      generationType: 'JOB_TARGETING',
      generationSource: 'job_targeting_override',
    })
    expect(runJobTargetingPipeline).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'sess_123',
      }),
      expect.objectContaining({
        userAcceptedLowFit: true,
        overrideReason: 'pre_rewrite_low_fit_block',
        skipPreRewriteLowFitBlock: true,
        skipLowFitRecoverableBlocking: true,
        deferSessionPersistence: true,
      }),
    )
    expect(getSession).toHaveBeenCalledTimes(1)
    expect(createCvVersion).not.toHaveBeenCalled()
    expect(generateBillableResume).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'usr_123',
        sessionId: 'sess_123',
        idempotencyKey: 'profile-target-override:sess_123:draft_123',
        latestVersionId: undefined,
        latestVersionSource: undefined,
        skipCreditPrecheck: true,
      }),
    )
    expect(updateSession).toHaveBeenLastCalledWith('sess_123', expect.objectContaining({
      agentState: expect.objectContaining({
        validationOverride: expect.objectContaining({
          enabled: true,
          acceptedLowFit: true,
          fallbackUsed: true,
          overrideTokenHash: 'hash:override_token_123',
          resumeGenerationId: 'gen_low_fit_123',
        }),
      }),
    }))
  })

  it('rejects override tokens that do not belong to the blocked draft', async () => {
    const response = await POST(buildRequest({
      overrideToken: 'wrong_token',
      consumeCredit: true,
    }), {
      params: { id: 'sess_123' },
    })

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({
      error: 'O token de override não corresponde à sessão atual.',
    })
    expect(tryAcquireOverrideProcessingLock).not.toHaveBeenCalled()
    expect(createCvVersion).not.toHaveBeenCalled()
    expect(generateBillableResume).not.toHaveBeenCalled()
  })

  it('returns insufficient_credits without consuming draft state or creating a version', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValue({
      id: 'usr_123',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      authIdentity: {
        id: 'identity_123',
        userId: 'usr_123',
        provider: 'clerk',
        providerSubject: 'clerk_123',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      creditAccount: {
        id: 'cred_123',
        userId: 'usr_123',
        creditsRemaining: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    } as never)

    const response = await POST(buildRequest({
      overrideToken: 'override_token_123',
      consumeCredit: true,
    }), {
      params: { id: 'sess_123' },
    })

    expect(response.status).toBe(402)
    expect(await response.json()).toEqual({
      error: 'insufficient_credits',
      code: 'INSUFFICIENT_CREDITS',
      message: 'Você não tem créditos suficientes para gerar esta versão.',
      requiredCredits: 1,
      availableCredits: 0,
      openPricing: true,
    })
    expect(tryAcquireOverrideProcessingLock).not.toHaveBeenCalled()
    expect(updateSession).not.toHaveBeenCalled()
    expect(createCvVersion).not.toHaveBeenCalled()
    expect(generateBillableResume).not.toHaveBeenCalled()
  })

  it('returns a human message when the recoverable override token has expired', async () => {
    vi.mocked(getSession).mockResolvedValue({
      ...buildSession(),
      agentState: {
        ...buildSession().agentState,
        blockedTargetedRewriteDraft: {
          ...buildSession().agentState.blockedTargetedRewriteDraft,
          expiresAt: '2000-04-27T15:20:00.000Z',
        },
      },
    } as never)

    const response = await POST(buildRequest({
      overrideToken: 'override_token_123',
      consumeCredit: true,
    }), {
      params: { id: 'sess_123' },
    })

    expect(response.status).toBe(410)
    expect(await response.json()).toEqual({
      error: 'Esta confirmação expirou. Gere uma nova versão para continuar.',
    })
    expect(tryAcquireOverrideProcessingLock).not.toHaveBeenCalled()
    expect(updateSession).not.toHaveBeenCalled()
    expect(createCvVersion).not.toHaveBeenCalled()
    expect(generateBillableResume).not.toHaveBeenCalled()
  })

  it('keeps hard non-recoverable mismatches blocked and does not proceed with override generation', async () => {
    vi.mocked(getSession).mockResolvedValue({
      ...buildSession(),
      agentState: {
        ...buildSession().agentState,
        blockedTargetedRewriteDraft: {
          ...buildSession().agentState.blockedTargetedRewriteDraft,
          recoverable: false,
        },
        rewriteValidation: {
          blocked: true,
          valid: false,
          hardIssues: [{
            severity: 'high',
            section: 'summary',
            issueType: 'low_fit_target_role',
            message: 'Mismatch real sem override permitido.',
          }],
          softWarnings: [],
          issues: [{
            severity: 'high',
            section: 'summary',
            issueType: 'low_fit_target_role',
            message: 'Mismatch real sem override permitido.',
          }],
        },
      },
    } as never)

    const response = await POST(buildRequest({
      overrideToken: 'override_token_123',
      consumeCredit: true,
    }), {
      params: { id: 'sess_123' },
    })

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({
      error: 'Este bloqueio não pode ser liberado com override pago.',
    })
    expect(tryAcquireOverrideProcessingLock).not.toHaveBeenCalled()
    expect(createCvVersion).not.toHaveBeenCalled()
    expect(generateBillableResume).not.toHaveBeenCalled()
  })

  it('does not charge or finalize the override when the billable generation fails', async () => {
    vi.mocked(generateBillableResume).mockResolvedValue({
      output: {
        success: false,
        error: 'Falha técnica ao gerar artefato.',
        code: 'INTERNAL_ERROR',
      },
      outputJson: JSON.stringify({
        success: false,
        error: 'Falha técnica ao gerar artefato.',
        code: 'INTERNAL_ERROR',
      }),
      outputFailure: {
        error: 'Falha técnica ao gerar artefato.',
        code: 'INTERNAL_ERROR',
      },
    } as never)

    const response = await POST(buildRequest({
      overrideToken: 'override_token_123',
      consumeCredit: true,
    }), {
      params: { id: 'sess_123' },
    })

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({
      error: 'Falha técnica ao gerar artefato.',
      code: 'INTERNAL_ERROR',
    })
    expect(updateSession).not.toHaveBeenLastCalledWith('sess_123', expect.objectContaining({
      agentState: expect.objectContaining({
        validationOverride: expect.anything(),
        blockedTargetedRewriteDraft: undefined,
      }),
    }))
  })

  it('returns override_in_progress when the persistent processing lock is already active', async () => {
    vi.mocked(getSession).mockResolvedValue(buildPreRewriteLowFitSession() as never)
    vi.mocked(tryAcquireOverrideProcessingLock).mockResolvedValue({
      acquired: false,
      reason: 'already_processing',
      existingRequestId: 'req_existing_123',
      processingExpiresAt: '2026-04-27T15:05:00.000Z',
    } as never)

    const response = await POST(buildRequest({
      overrideToken: 'override_token_123',
      consumeCredit: true,
    }), {
      params: { id: 'sess_123' },
    })

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({
      error: 'override_in_progress',
      message: 'Essa geração já está em andamento.',
      requestId: 'req_existing_123',
      retryAfterMs: 3000,
    })
    expect(runJobTargetingPipeline).not.toHaveBeenCalled()
    expect(generateBillableResume).not.toHaveBeenCalled()
  })

  it('returns the completed result idempotently when the same override token is replayed after success', async () => {
    vi.mocked(tryAcquireOverrideProcessingLock).mockResolvedValue({
      acquired: false,
      reason: 'already_completed',
      completedResult: {
        cvVersionId: 'ver_123',
        resumeGenerationId: 'gen_123',
      },
    } as never)

    const response = await POST(buildRequest({
      overrideToken: 'override_token_123',
      consumeCredit: true,
    }), {
      params: { id: 'sess_123' },
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      success: true,
      status: 'already_completed',
      sessionId: 'sess_123',
      cvVersionId: 'ver_123',
      resumeGenerationId: 'gen_123',
      generationType: 'JOB_TARGETING',
      generationSource: 'job_targeting_override',
    })
    expect(createCvVersion).not.toHaveBeenCalled()
    expect(generateBillableResume).not.toHaveBeenCalled()
  })
})
