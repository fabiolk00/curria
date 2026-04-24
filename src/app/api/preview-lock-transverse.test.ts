import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockGetCurrentAppUser,
  mockValidateTrustedMutationRequest,
  mockCreateSession,
  mockCheckUserQuota,
  mockApplyToolPatchWithVersion,
  mockGetSession,
  mockRunAtsEnhancementPipeline,
  mockRunJobTargetingPipeline,
  mockDispatchToolWithContext,
  mockValidateGenerationCvState,
  mockGenerateFile,
  mockCreateSignedResumeArtifactUrls,
  mockGetLatestCompletedResumeGenerationForScope,
  mockGetResumeGenerationByIdempotencyKey,
  mockCreatePendingResumeGeneration,
  mockUpdateResumeGeneration,
  mockGetLatestCvVersionForScope,
  mockGetCvTimelineForSession,
  mockGetCvVersionForSession,
  mockToTimelineEntry,
  mockGetResumeTargetsForSession,
  mockGetResumeTargetForSession,
  mockListJobsForSession,
  mockGetUserBillingInfo,
  mockGetUserBillingPlan,
  mockReserveCreditForGenerationIntent,
  mockFinalizeCreditReservation,
  mockReleaseCreditReservation,
  mockMarkCreditReservationReconciliation,
} = vi.hoisted(() => ({
  mockGetCurrentAppUser: vi.fn(),
  mockValidateTrustedMutationRequest: vi.fn(),
  mockCreateSession: vi.fn(),
  mockCheckUserQuota: vi.fn(),
  mockApplyToolPatchWithVersion: vi.fn(),
  mockGetSession: vi.fn(),
  mockRunAtsEnhancementPipeline: vi.fn(),
  mockRunJobTargetingPipeline: vi.fn(),
  mockDispatchToolWithContext: vi.fn(),
  mockValidateGenerationCvState: vi.fn(),
  mockGenerateFile: vi.fn(),
  mockCreateSignedResumeArtifactUrls: vi.fn(),
  mockGetLatestCompletedResumeGenerationForScope: vi.fn(),
  mockGetResumeGenerationByIdempotencyKey: vi.fn(),
  mockCreatePendingResumeGeneration: vi.fn(),
  mockUpdateResumeGeneration: vi.fn(),
  mockGetLatestCvVersionForScope: vi.fn(),
  mockGetCvTimelineForSession: vi.fn(),
  mockGetCvVersionForSession: vi.fn(),
  mockToTimelineEntry: vi.fn(),
  mockGetResumeTargetsForSession: vi.fn(),
  mockGetResumeTargetForSession: vi.fn(),
  mockListJobsForSession: vi.fn(),
  mockGetUserBillingInfo: vi.fn(),
  mockGetUserBillingPlan: vi.fn(),
  mockReserveCreditForGenerationIntent: vi.fn(),
  mockFinalizeCreditReservation: vi.fn(),
  mockReleaseCreditReservation: vi.fn(),
  mockMarkCreditReservationReconciliation: vi.fn(),
}))

vi.mock('@/lib/auth/app-user', () => ({
  getCurrentAppUser: mockGetCurrentAppUser,
}))

vi.mock('@/lib/security/request-trust', () => ({
  validateTrustedMutationRequest: mockValidateTrustedMutationRequest,
}))

vi.mock('@/lib/db/sessions', () => ({
  createSession: mockCreateSession,
  checkUserQuota: mockCheckUserQuota,
  applyToolPatchWithVersion: mockApplyToolPatchWithVersion,
  getSession: mockGetSession,
}))

vi.mock('@/lib/agent/ats-enhancement-pipeline', () => ({
  runAtsEnhancementPipeline: mockRunAtsEnhancementPipeline,
}))

vi.mock('@/lib/agent/job-targeting-pipeline', () => ({
  runJobTargetingPipeline: mockRunJobTargetingPipeline,
}))

vi.mock('@/lib/agent/tools', () => ({
  dispatchToolWithContext: mockDispatchToolWithContext,
}))

vi.mock('@/lib/agent/tools/generate-file', () => ({
  validateGenerationCvState: mockValidateGenerationCvState,
  generateFile: mockGenerateFile,
  createSignedResumeArtifactUrls: mockCreateSignedResumeArtifactUrls,
  createSignedResumeArtifactUrlsBestEffort: mockCreateSignedResumeArtifactUrls,
}))

vi.mock('@/lib/asaas/quota', () => ({
  checkUserQuota: mockCheckUserQuota,
  getUserBillingInfo: mockGetUserBillingInfo,
  getUserBillingPlan: mockGetUserBillingPlan,
  reserveCreditForGenerationIntent: mockReserveCreditForGenerationIntent,
  finalizeCreditReservation: mockFinalizeCreditReservation,
  releaseCreditReservation: mockReleaseCreditReservation,
  consumeCreditForGeneration: vi.fn(),
}))

vi.mock('@/lib/db/resume-generations', () => ({
  getLatestCompletedResumeGenerationForScope: mockGetLatestCompletedResumeGenerationForScope,
  getResumeGenerationByIdempotencyKey: mockGetResumeGenerationByIdempotencyKey,
  createPendingResumeGeneration: mockCreatePendingResumeGeneration,
  updateResumeGeneration: mockUpdateResumeGeneration,
}))

vi.mock('@/lib/db/cv-versions', () => ({
  getLatestCvVersionForScope: mockGetLatestCvVersionForScope,
  getCvTimelineForSession: mockGetCvTimelineForSession,
  getCvVersionForSession: mockGetCvVersionForSession,
  toTimelineEntry: mockToTimelineEntry,
}))

vi.mock('@/lib/db/resume-targets', () => ({
  getResumeTargetsForSession: mockGetResumeTargetsForSession,
  getResumeTargetForSession: mockGetResumeTargetForSession,
}))

vi.mock('@/lib/jobs/repository', () => ({
  listJobsForSession: mockListJobsForSession,
}))

vi.mock('@/lib/observability/structured-log', () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
  serializeError: (error: unknown) => ({
    errorMessage: error instanceof Error ? error.message : String(error),
  }),
}))

vi.mock('@/lib/observability/timed-operation', () => ({
  withTimedOperation: async ({ run }: { run: () => Promise<unknown> }) => run(),
}))

vi.mock('@/lib/observability/metric-events', () => ({
  recordMetricCounter: vi.fn(),
}))

vi.mock('@/lib/jobs/config', () => ({
  resolveExportGenerationConfig: () => ({
    timeoutMs: 90_000,
  }),
}))

vi.mock('@/lib/db/credit-reservations', () => ({
  markCreditReservationReconciliation: mockMarkCreditReservationReconciliation,
}))

import { POST as postSmartGeneration } from '@/app/api/profile/smart-generation/route'
import { GET as getSessionVersions } from '@/app/api/session/[id]/versions/route'
import { POST as postSessionCompare } from '@/app/api/session/[id]/compare/route'
import { GET as getFileUrls } from '@/app/api/file/[sessionId]/route'
import { generateBillableResume } from '@/lib/resume-generation/generate-billable-resume'

function buildCvState(summary = 'Analista de dados com foco em BI e melhoria continua.') {
  return {
    fullName: 'Ana Silva',
    email: 'ana@example.com',
    phone: '555-0100',
    linkedin: 'https://linkedin.com/in/ana',
    location: 'Sao Paulo',
    summary,
    experience: [{
      title: 'Analista de Dados',
      company: 'Acme',
      location: 'Sao Paulo',
      startDate: '2022',
      endDate: '2024',
      bullets: ['Criei dashboards executivos.', 'Automatizei relatorios.'],
    }],
    skills: ['SQL', 'Power BI', 'ETL', 'Excel'],
    education: [{
      degree: 'Bacharel em Sistemas de Informacao',
      institution: 'USP',
      year: '2020',
    }],
    certifications: [{
      name: 'AWS Cloud Practitioner',
      issuer: 'Amazon',
      year: '2024',
    }],
  }
}

function buildLockedPreviewAccess() {
  return {
    locked: true,
    blurred: true,
    canViewRealContent: false,
    requiresUpgrade: true,
    requiresRegenerationAfterUnlock: true,
    reason: 'free_trial_locked' as const,
    lockedAt: '2026-04-20T12:00:00.000Z',
    message: 'Seu preview gratuito está bloqueado. Faça upgrade e gere novamente para liberar o currículo real.',
  }
}

function buildTrustedHeaders() {
  return {
    'content-type': 'application/json',
    origin: 'https://example.com',
  }
}

describe('preview lock transverse regression flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('keeps trial artifacts locked through replay and upgrade, and only unlocks after a new paid generation', async () => {
    const baseCvState = buildCvState()
    const lockedOptimizedCvState = buildCvState('Resumo real otimizado que não deve vazar no trial.')
    const unlockedOptimizedCvState = buildCvState('Resumo real otimizado apos upgrade e nova geracao.')
    const lockedPreviewAccess = buildLockedPreviewAccess()

    const sharedSession: any = {
      id: 'sess_generation_123',
      userId: 'usr_123',
      phase: 'generation',
      stateVersion: 1,
      cvState: baseCvState,
      agentState: {
        parseStatus: 'parsed' as const,
        rewriteHistory: {},
      },
      generatedOutput: {
        status: 'idle' as const,
      },
      creditsUsed: 0,
      messageCount: 0,
      creditConsumed: false,
      createdAt: new Date('2026-04-20T12:00:00.000Z'),
      updatedAt: new Date('2026-04-20T12:00:00.000Z'),
    }

    const sharedVersion = {
      id: 'ver_locked_123',
      sessionId: sharedSession.id,
      source: 'ats-enhancement' as const,
      snapshot: lockedOptimizedCvState,
      createdAt: new Date('2026-04-20T12:05:00.000Z'),
    }

    const completedLockedGeneration = {
      id: 'gen_locked_123',
      userId: 'usr_123',
      sessionId: sharedSession.id,
      type: 'ATS_ENHANCEMENT' as const,
      status: 'completed' as const,
      sourceCvSnapshot: lockedOptimizedCvState,
      generatedCvState: lockedOptimizedCvState,
      outputPdfPath: 'usr_123/sess_generation_123/resume.pdf',
      outputDocxPath: null,
      versionNumber: 1,
      createdAt: new Date('2026-04-20T12:05:00.000Z'),
      updatedAt: new Date('2026-04-20T12:06:00.000Z'),
    }

    let currentPlan: 'free' | 'monthly' = 'free'

    mockGetCurrentAppUser.mockResolvedValue({
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
    })
    mockValidateTrustedMutationRequest.mockReturnValue({
      ok: true,
      signal: 'origin',
      reason: 'trusted',
    })
    mockCreateSession.mockResolvedValue(sharedSession)
    mockCheckUserQuota.mockResolvedValue(true)
    mockApplyToolPatchWithVersion.mockResolvedValue(undefined)
    mockGetSession.mockImplementation(async () => sharedSession)
    mockRunJobTargetingPipeline.mockResolvedValue({
      success: false,
    })
    mockRunAtsEnhancementPipeline.mockImplementation(async (session) => {
      session.agentState.optimizedCvState = lockedOptimizedCvState
      session.agentState.rewriteStatus = 'completed'
      return {
        success: true,
        optimizedCvState: lockedOptimizedCvState,
      }
    })
    mockDispatchToolWithContext.mockImplementation(async () => {
      sharedSession.generatedOutput = {
        status: 'ready',
        pdfPath: 'usr_123/sess_generation_123/resume.pdf',
        previewAccess: lockedPreviewAccess,
        generatedAt: '2026-04-20T12:06:00.000Z',
      }

      return {
        output: {
          success: true,
          pdfUrl: '/api/file/sess_generation_123/locked-preview',
          creditsUsed: 1,
          resumeGenerationId: completedLockedGeneration.id,
        },
        generatedOutput: sharedSession.generatedOutput,
        persistedPatch: {
          generatedOutput: {
            ...sharedSession.generatedOutput,
          },
        },
        outputJson: JSON.stringify({
          success: true,
          pdfUrl: '/api/file/sess_generation_123/locked-preview',
          creditsUsed: 1,
          resumeGenerationId: completedLockedGeneration.id,
        }),
      }
    })
    mockValidateGenerationCvState.mockImplementation(() => ({
      success: true,
      cvState: baseCvState,
      warnings: [],
    }))
    mockGetLatestCvVersionForScope.mockResolvedValue({
      id: 'ver_locked_123',
      sessionId: sharedSession.id,
      snapshot: lockedOptimizedCvState,
      source: 'ats-enhancement',
      createdAt: new Date('2026-04-20T12:05:00.000Z'),
    })
    mockGetCvTimelineForSession.mockResolvedValue([{
      ...sharedVersion,
      label: 'ATS Enhancement Created',
      timestamp: '2026-04-20T12:05:00.000Z',
      scope: 'base',
    }])
    mockGetCvVersionForSession.mockResolvedValue(sharedVersion)
    mockToTimelineEntry.mockReturnValue({
      ...sharedVersion,
      label: 'ATS Enhancement Created',
      timestamp: '2026-04-20T12:05:00.000Z',
      scope: 'base',
    })
    mockGetResumeTargetsForSession.mockResolvedValue([])
    mockGetResumeTargetForSession.mockResolvedValue(null)
    mockListJobsForSession.mockResolvedValue([])
    mockCreateSignedResumeArtifactUrls.mockResolvedValue({
      pdfUrl: 'https://cdn.example.com/signed/resume.pdf',
      docxUrl: null,
    })
    mockGetLatestCompletedResumeGenerationForScope.mockImplementation(async () => completedLockedGeneration)
    mockGetResumeGenerationByIdempotencyKey.mockResolvedValue(null)
    mockGetUserBillingInfo.mockImplementation(async () => ({
      plan: currentPlan,
    }))
    mockGetUserBillingPlan.mockImplementation(async () => currentPlan)
    mockReserveCreditForGenerationIntent.mockResolvedValue({
      id: 'res_123',
      userId: 'usr_123',
      generationIntentKey: 'dup_key',
      sessionId: sharedSession.id,
      type: 'ATS_ENHANCEMENT',
      status: 'reserved',
      creditsReserved: 1,
      reconciliationStatus: 'clean',
      reservedAt: new Date('2026-04-20T12:20:00.000Z'),
      createdAt: new Date('2026-04-20T12:20:00.000Z'),
      updatedAt: new Date('2026-04-20T12:20:00.000Z'),
    })
    mockFinalizeCreditReservation.mockResolvedValue({})
    mockReleaseCreditReservation.mockResolvedValue({})
    mockMarkCreditReservationReconciliation.mockResolvedValue({})
    mockUpdateResumeGeneration.mockResolvedValue({
      ...completedLockedGeneration,
      id: 'gen_unlocked_456',
      sourceCvSnapshot: unlockedOptimizedCvState,
      generatedCvState: unlockedOptimizedCvState,
      outputPdfPath: 'usr_123/sess_generation_123/resume-upgraded.pdf',
      updatedAt: new Date('2026-04-20T12:31:00.000Z'),
    })

    const trialResponse = await postSmartGeneration(new NextRequest('https://example.com/api/profile/smart-generation', {
      method: 'POST',
      headers: buildTrustedHeaders(),
      body: JSON.stringify(baseCvState),
    }))

    expect(trialResponse.status).toBe(200)
    expect(await trialResponse.json()).toEqual(expect.objectContaining({
      success: true,
      sessionId: sharedSession.id,
      optimizedCvState: expect.objectContaining({
        fullName: 'Preview bloqueado',
      }),
      previewLock: expect.objectContaining({
        locked: true,
        requiresPaidRegeneration: true,
      }),
    }))
    expect(sharedSession.generatedOutput.previewAccess).toEqual(lockedPreviewAccess)

    const replayWhileTrial = await generateBillableResume({
      userId: 'usr_123',
      sessionId: sharedSession.id,
      sourceCvState: lockedOptimizedCvState,
    })

    expect(replayWhileTrial.output).toEqual({
      success: true,
      pdfUrl: null,
      docxUrl: null,
      creditsUsed: 0,
      resumeGenerationId: completedLockedGeneration.id,
    })
    expect(replayWhileTrial.generatedOutput?.previewAccess).toEqual(lockedPreviewAccess)
    expect(replayWhileTrial.patch?.generatedOutput?.previewAccess).toEqual(
      replayWhileTrial.generatedOutput?.previewAccess,
    )

    mockCreateSignedResumeArtifactUrls.mockClear()

    const versionsResponse = await getSessionVersions(
      new NextRequest(`https://example.com/api/session/${sharedSession.id}/versions`),
      { params: { id: sharedSession.id } },
    )
    expect(versionsResponse.status).toBe(200)
    const versionsPayload = await versionsResponse.json()
    expect(versionsPayload.sessionId).toBe(sharedSession.id)
    expect(versionsPayload.versions).toHaveLength(1)
    expect(versionsPayload.versions[0]).toMatchObject({
      id: sharedVersion.id,
      previewLocked: true,
      blurred: true,
      canViewRealContent: false,
      requiresRegenerationAfterUnlock: true,
      requiresUpgrade: true,
    })
    expect(versionsPayload.versions[0]).not.toHaveProperty('snapshot')

    const compareResponse = await postSessionCompare(
      new NextRequest(`https://example.com/api/session/${sharedSession.id}/compare`, {
        method: 'POST',
        body: JSON.stringify({
          left: { kind: 'version', id: sharedVersion.id },
          right: { kind: 'base' },
        }),
      }),
      { params: { id: sharedSession.id } },
    )
    expect(compareResponse.status).toBe(200)
    expect(await compareResponse.json()).toEqual({
      sessionId: sharedSession.id,
      locked: true,
      reason: 'preview_locked',
      left: expect.objectContaining({
        kind: 'version',
        id: sharedVersion.id,
        previewLocked: true,
      }),
      right: expect.objectContaining({
        kind: 'base',
        previewLocked: false,
      }),
    })

    const fileResponse = await getFileUrls(
      new NextRequest(`https://example.com/api/file/${sharedSession.id}`),
      { params: { sessionId: sharedSession.id } },
    )
    expect(fileResponse.status).toBe(200)
    expect(await fileResponse.json()).toEqual(expect.objectContaining({
      available: true,
      pdfUrl: `/api/file/${sharedSession.id}/locked-preview`,
      previewLock: expect.objectContaining({
        locked: true,
      }),
    }))
    expect(mockCreateSignedResumeArtifactUrls).not.toHaveBeenCalled()

    currentPlan = 'monthly'

    const replayAfterUpgrade = await generateBillableResume({
      userId: 'usr_123',
      sessionId: sharedSession.id,
      sourceCvState: lockedOptimizedCvState,
    })

    expect(replayAfterUpgrade.output).toEqual({
      success: true,
      pdfUrl: null,
      docxUrl: null,
      creditsUsed: 0,
      resumeGenerationId: completedLockedGeneration.id,
    })
    expect(replayAfterUpgrade.generatedOutput?.previewAccess).toEqual(lockedPreviewAccess)
    expect(mockCreateSignedResumeArtifactUrls).not.toHaveBeenCalled()

    const fileResponseAfterUpgrade = await getFileUrls(
      new NextRequest(`https://example.com/api/file/${sharedSession.id}`),
      { params: { sessionId: sharedSession.id } },
    )
    expect(fileResponseAfterUpgrade.status).toBe(200)
    expect(await fileResponseAfterUpgrade.json()).toEqual(expect.objectContaining({
      available: true,
      pdfUrl: `/api/file/${sharedSession.id}/locked-preview`,
      previewLock: expect.objectContaining({
        locked: true,
      }),
    }))
    expect(mockCreateSignedResumeArtifactUrls).not.toHaveBeenCalled()

    mockGetLatestCvVersionForScope.mockResolvedValue({
      id: 'ver_unlocked_456',
      sessionId: sharedSession.id,
      snapshot: unlockedOptimizedCvState,
      source: 'rewrite',
      createdAt: new Date('2026-04-20T12:30:00.000Z'),
    })
    mockCreatePendingResumeGeneration.mockResolvedValue({
      generation: {
        id: 'gen_pending_unlocked',
        userId: 'usr_123',
        sessionId: sharedSession.id,
        type: 'ATS_ENHANCEMENT',
        status: 'pending',
        idempotencyKey: 'profile-ats:sess_generation_123:upgraded',
        sourceCvSnapshot: unlockedOptimizedCvState,
        versionNumber: 2,
        createdAt: new Date('2026-04-20T12:30:00.000Z'),
        updatedAt: new Date('2026-04-20T12:30:00.000Z'),
      },
      wasCreated: true,
    })
    mockGenerateFile.mockResolvedValue({
      output: {
        success: true,
        pdfUrl: 'https://cdn.example.com/signed/new-resume.pdf',
        docxUrl: null,
      },
      patch: {
        generatedOutput: {
          status: 'ready',
          pdfPath: 'usr_123/sess_generation_123/resume-upgraded.pdf',
          generatedAt: '2026-04-20T12:31:00.000Z',
        },
      },
      generatedOutput: {
        status: 'ready',
        pdfPath: 'usr_123/sess_generation_123/resume-upgraded.pdf',
        generatedAt: '2026-04-20T12:31:00.000Z',
      },
    })

    const regeneratedAfterUpgrade = await generateBillableResume({
      userId: 'usr_123',
      sessionId: sharedSession.id,
      sourceCvState: unlockedOptimizedCvState,
      idempotencyKey: 'profile-ats:sess_generation_123:upgraded',
    })

    expect(regeneratedAfterUpgrade.output).toEqual({
      success: true,
      pdfUrl: 'https://cdn.example.com/signed/new-resume.pdf',
      docxUrl: null,
      creditsUsed: 1,
      resumeGenerationId: 'gen_unlocked_456',
    })
    expect(regeneratedAfterUpgrade.generatedOutput?.previewAccess).toBeUndefined()
    expect(regeneratedAfterUpgrade.patch?.generatedOutput?.previewAccess).toBeUndefined()
  })
})
