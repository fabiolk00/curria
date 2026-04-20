import { createHash } from 'crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { generateBillableResume } from './generate-billable-resume'

const {
  mockGenerateFile,
  mockCreateSignedResumeArtifactUrls,
  mockValidateGenerationCvState,
  mockCheckUserQuota,
  mockConsumeCreditForGeneration,
  mockReserveCreditForGenerationIntent,
  mockFinalizeCreditReservation,
  mockReleaseCreditReservation,
  mockGetUserBillingInfo,
  mockGetLatestCvVersionForScope,
  mockMarkCreditReservationReconciliation,
  mockCreatePendingResumeGeneration,
  mockGetLatestCompletedResumeGenerationForScope,
  mockGetResumeGenerationByIdempotencyKey,
  mockGetResumeTargetForSession,
  mockGetSession,
  mockUpdateResumeGeneration,
  mockLogInfo,
  mockLogWarn,
} = vi.hoisted(() => ({
  mockGenerateFile: vi.fn(),
  mockCreateSignedResumeArtifactUrls: vi.fn(),
  mockValidateGenerationCvState: vi.fn(),
  mockCheckUserQuota: vi.fn(),
  mockConsumeCreditForGeneration: vi.fn(),
  mockReserveCreditForGenerationIntent: vi.fn(),
  mockFinalizeCreditReservation: vi.fn(),
  mockReleaseCreditReservation: vi.fn(),
  mockGetUserBillingInfo: vi.fn(),
  mockGetLatestCvVersionForScope: vi.fn(),
  mockMarkCreditReservationReconciliation: vi.fn(),
  mockCreatePendingResumeGeneration: vi.fn(),
  mockGetLatestCompletedResumeGenerationForScope: vi.fn(),
  mockGetResumeGenerationByIdempotencyKey: vi.fn(),
  mockGetResumeTargetForSession: vi.fn(),
  mockGetSession: vi.fn(),
  mockUpdateResumeGeneration: vi.fn(),
  mockLogInfo: vi.fn(),
  mockLogWarn: vi.fn(),
}))

vi.mock('@/lib/agent/tools/generate-file', () => ({
  generateFile: mockGenerateFile,
  createSignedResumeArtifactUrls: mockCreateSignedResumeArtifactUrls,
  createSignedResumeArtifactUrlsBestEffort: mockCreateSignedResumeArtifactUrls,
  validateGenerationCvState: mockValidateGenerationCvState,
}))

vi.mock('@/lib/asaas/quota', () => ({
  checkUserQuota: mockCheckUserQuota,
  consumeCreditForGeneration: mockConsumeCreditForGeneration,
  reserveCreditForGenerationIntent: mockReserveCreditForGenerationIntent,
  finalizeCreditReservation: mockFinalizeCreditReservation,
  releaseCreditReservation: mockReleaseCreditReservation,
  getUserBillingInfo: mockGetUserBillingInfo,
}))

vi.mock('@/lib/db/cv-versions', () => ({
  getLatestCvVersionForScope: mockGetLatestCvVersionForScope,
}))

vi.mock('@/lib/db/credit-reservations', () => ({
  markCreditReservationReconciliation: mockMarkCreditReservationReconciliation,
}))

vi.mock('@/lib/db/resume-generations', () => ({
  createPendingResumeGeneration: mockCreatePendingResumeGeneration,
  getLatestCompletedResumeGenerationForScope: mockGetLatestCompletedResumeGenerationForScope,
  getResumeGenerationByIdempotencyKey: mockGetResumeGenerationByIdempotencyKey,
  updateResumeGeneration: mockUpdateResumeGeneration,
}))

vi.mock('@/lib/db/resume-targets', () => ({
  getResumeTargetForSession: mockGetResumeTargetForSession,
}))

vi.mock('@/lib/db/sessions', () => ({
  getSession: mockGetSession,
}))

vi.mock('@/lib/observability/structured-log', () => ({
  logInfo: mockLogInfo,
  logWarn: mockLogWarn,
  serializeError: (error: unknown) => ({
    errorName: error instanceof Error ? error.name : 'Error',
    errorMessage: error instanceof Error ? error.message : String(error),
  }),
}))

function buildCvState() {
  return {
    fullName: 'Ana Silva',
    email: 'ana@example.com',
    phone: '555-0100',
    summary: 'Backend engineer with strong ATS writing.',
    experience: [],
    skills: ['TypeScript'],
    education: [],
  }
}

function buildLegacyFallbackGenerationId(cvState: ReturnType<typeof buildCvState>, overrides?: {
  sessionId?: string
  targetId?: string
  idempotencyKey?: string
}) {
  const fallbackFingerprint = overrides?.idempotencyKey
    ?? createHash('sha256').update(JSON.stringify(cvState)).digest('hex')

  return [
    'legacy',
    overrides?.sessionId ?? 'sess_123',
    overrides?.targetId ?? 'base',
    fallbackFingerprint,
  ].join(':')
}

function buildReservation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'res_123',
    userId: 'usr_123',
    generationIntentKey: 'dup_key',
    sessionId: 'sess_123',
    type: 'ATS_ENHANCEMENT',
    status: 'reserved',
    creditsReserved: 1,
    reconciliationStatus: 'clean',
    reservedAt: new Date('2026-04-12T12:00:00.000Z'),
    createdAt: new Date('2026-04-12T12:00:00.000Z'),
    updatedAt: new Date('2026-04-12T12:00:00.000Z'),
    ...overrides,
  }
}

function buildPendingGeneration(cvState: ReturnType<typeof buildCvState>, overrides: Record<string, unknown> = {}) {
  return {
    id: 'gen_pending',
    userId: 'usr_123',
    sessionId: 'sess_123',
    type: 'ATS_ENHANCEMENT',
    status: 'pending',
    idempotencyKey: 'dup_key',
    sourceCvSnapshot: cvState,
    versionNumber: 1,
    createdAt: new Date('2026-04-12T12:00:00.000Z'),
    updatedAt: new Date('2026-04-12T12:00:00.000Z'),
    ...overrides,
  }
}

describe('generateBillableResume', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockValidateGenerationCvState.mockReturnValue({
      success: true,
      cvState: buildCvState(),
      warnings: [],
    })
    mockGetLatestCompletedResumeGenerationForScope.mockResolvedValue(null)
    mockGetResumeGenerationByIdempotencyKey.mockResolvedValue(null)
    mockGetResumeTargetForSession.mockResolvedValue(null)
    mockGetSession.mockResolvedValue(null)
    mockUpdateResumeGeneration.mockResolvedValue(undefined)
    mockConsumeCreditForGeneration.mockResolvedValue(true)
    mockReserveCreditForGenerationIntent.mockResolvedValue(buildReservation())
    mockMarkCreditReservationReconciliation.mockResolvedValue(buildReservation({
      status: 'needs_reconciliation',
      reconciliationStatus: 'pending',
    }))
    mockFinalizeCreditReservation.mockResolvedValue(buildReservation({
      status: 'finalized',
      finalizedAt: new Date('2026-04-12T12:01:00.000Z'),
    }))
    mockGetUserBillingInfo.mockResolvedValue({
      plan: 'monthly',
    })
    mockReleaseCreditReservation.mockResolvedValue(buildReservation({
      status: 'released',
      releasedAt: new Date('2026-04-12T12:01:00.000Z'),
    }))
  })

  it('rejects exporting a manual-only cv state as a billable generation', async () => {
    mockGetLatestCvVersionForScope.mockResolvedValue({
      id: 'ver_manual',
      sessionId: 'sess_123',
      snapshot: buildCvState(),
      source: 'manual',
      createdAt: new Date('2026-04-12T12:00:00.000Z'),
    })

    const result = await generateBillableResume({
      userId: 'usr_123',
      sessionId: 'sess_123',
      sourceCvState: buildCvState(),
    })

    expect(result.output).toEqual({
      success: false,
      code: 'VALIDATION_ERROR',
      error: 'Gere uma nova versão otimizada pela IA antes de exportar este currículo.',
    })
    expect(mockCheckUserQuota).not.toHaveBeenCalled()
    expect(mockGenerateFile).not.toHaveBeenCalled()
  })

  it('replays an existing completed generation without charging again for paid viewers', async () => {
    const cvState = buildCvState()
    mockGetLatestCompletedResumeGenerationForScope.mockResolvedValue({
      id: 'gen_existing',
      userId: 'usr_123',
      sessionId: 'sess_123',
      type: 'ATS_ENHANCEMENT',
      status: 'completed',
      sourceCvSnapshot: cvState,
      generatedCvState: cvState,
      outputPdfPath: 'usr_123/sess_123/resume.pdf',
      outputDocxPath: null,
      versionNumber: 1,
      createdAt: new Date('2026-04-12T12:00:00.000Z'),
      updatedAt: new Date('2026-04-12T12:01:00.000Z'),
    })
    mockCreateSignedResumeArtifactUrls.mockResolvedValue({
      pdfUrl: 'https://example.com/resume.pdf',
      docxUrl: null,
    })

    const result = await generateBillableResume({
      userId: 'usr_123',
      sessionId: 'sess_123',
      sourceCvState: cvState,
    })

    expect(result.output).toEqual({
      success: true,
      pdfUrl: 'https://example.com/resume.pdf',
      docxUrl: null,
      creditsUsed: 0,
      resumeGenerationId: 'gen_existing',
    })
    expect(mockReserveCreditForGenerationIntent).not.toHaveBeenCalled()
  })

  it('keeps completed replay locked for free viewers and never signs a real artifact url', async () => {
    const cvState = buildCvState()
    mockGetUserBillingInfo.mockResolvedValue({
      plan: 'free',
    })
    mockGetLatestCompletedResumeGenerationForScope.mockResolvedValue({
      id: 'gen_existing_locked',
      userId: 'usr_123',
      sessionId: 'sess_123',
      type: 'ATS_ENHANCEMENT',
      status: 'completed',
      sourceCvSnapshot: cvState,
      generatedCvState: cvState,
      outputPdfPath: 'usr_123/sess_123/resume.pdf',
      outputDocxPath: 'usr_123/sess_123/resume.docx',
      versionNumber: 1,
      createdAt: new Date('2026-04-12T12:00:00.000Z'),
      updatedAt: new Date('2026-04-12T12:01:00.000Z'),
    })

    const result = await generateBillableResume({
      userId: 'usr_123',
      sessionId: 'sess_123',
      sourceCvState: cvState,
    })

    expect(result.output).toEqual({
      success: true,
      pdfUrl: null,
      docxUrl: null,
      creditsUsed: 0,
      resumeGenerationId: 'gen_existing_locked',
    })
    expect(result.generatedOutput?.previewAccess).toEqual(expect.objectContaining({
      locked: true,
      blurred: true,
      canViewRealContent: false,
      requiresRegenerationAfterUnlock: true,
      reason: 'free_trial_locked',
    }))
    expect(result.patch?.generatedOutput?.previewAccess).toEqual(
      result.generatedOutput?.previewAccess,
    )
    expect(mockCreateSignedResumeArtifactUrls).not.toHaveBeenCalled()
    expect(mockReserveCreditForGenerationIntent).not.toHaveBeenCalled()
  })

  it('keeps a previously locked completed replay blocked even after upgrade until the user regenerates', async () => {
    const cvState = buildCvState()
    mockGetLatestCompletedResumeGenerationForScope.mockResolvedValue({
      id: 'gen_existing_upgraded',
      userId: 'usr_123',
      sessionId: 'sess_123',
      type: 'ATS_ENHANCEMENT',
      status: 'completed',
      sourceCvSnapshot: cvState,
      generatedCvState: cvState,
      outputPdfPath: 'usr_123/sess_123/resume.pdf',
      outputDocxPath: 'usr_123/sess_123/resume.docx',
      versionNumber: 1,
      createdAt: new Date('2026-04-12T12:00:00.000Z'),
      updatedAt: new Date('2026-04-12T12:01:00.000Z'),
    })
    mockGetSession.mockResolvedValue({
      generatedOutput: {
        status: 'ready',
        pdfPath: 'usr_123/sess_123/resume.pdf',
        previewAccess: {
          locked: true,
          blurred: true,
          canViewRealContent: false,
          requiresUpgrade: true,
          requiresRegenerationAfterUnlock: true,
          reason: 'free_trial_locked',
          lockedAt: '2026-04-12T12:01:00.000Z',
          message: 'Seu preview gratuito está bloqueado. Faça upgrade e gere novamente para liberar o currículo real.',
        },
      },
    })

    const result = await generateBillableResume({
      userId: 'usr_123',
      sessionId: 'sess_123',
      sourceCvState: cvState,
    })

    expect(result.output).toEqual({
      success: true,
      pdfUrl: null,
      docxUrl: null,
      creditsUsed: 0,
      resumeGenerationId: 'gen_existing_upgraded',
    })
    expect(result.generatedOutput?.previewAccess).toEqual(expect.objectContaining({
      locked: true,
      requiresRegenerationAfterUnlock: true,
    }))
    expect(mockCreateSignedResumeArtifactUrls).not.toHaveBeenCalled()
  })

  it('returns an in-progress response when the idempotency key already points to a pending generation', async () => {
    const cvState = buildCvState()
    mockGetResumeGenerationByIdempotencyKey.mockResolvedValue(buildPendingGeneration(cvState, {
      id: 'gen_pending_existing',
    }))

    const result = await generateBillableResume({
      userId: 'usr_123',
      sessionId: 'sess_123',
      sourceCvState: cvState,
      idempotencyKey: 'dup_key',
    })

    expect(result.output).toEqual({
      success: true,
      pdfUrl: null,
      docxUrl: null,
      creditsUsed: 0,
      resumeGenerationId: 'gen_pending_existing',
      inProgress: true,
    })
    expect(mockGenerateFile).not.toHaveBeenCalled()
    expect(mockReserveCreditForGenerationIntent).not.toHaveBeenCalled()
  })

  it('stops before creating a generation when the user has no credits', async () => {
    const cvState = buildCvState()
    mockGetLatestCvVersionForScope.mockResolvedValue({
      id: 'ver_rewrite',
      sessionId: 'sess_123',
      snapshot: cvState,
      source: 'rewrite',
      createdAt: new Date('2026-04-12T12:00:00.000Z'),
    })
    mockCheckUserQuota.mockResolvedValue(false)

    const result = await generateBillableResume({
      userId: 'usr_123',
      sessionId: 'sess_123',
      sourceCvState: cvState,
    })

    expect(result.output).toEqual({
      success: false,
      code: 'INSUFFICIENT_CREDITS',
      error: 'Seus créditos acabaram. Gere um novo currículo quando houver saldo disponível.',
    })
    expect(mockCreatePendingResumeGeneration).not.toHaveBeenCalled()
    expect(mockGenerateFile).not.toHaveBeenCalled()
  })

  it('falls back to legacy generation when resume_generations lookup is unavailable', async () => {
    const cvState = buildCvState()
    mockGetLatestCompletedResumeGenerationForScope.mockRejectedValue(
      new Error('Failed to load latest completed resume generation: relation "resume_generations" does not exist'),
    )
    mockGetLatestCvVersionForScope.mockResolvedValue({
      id: 'ver_rewrite',
      sessionId: 'sess_123',
      snapshot: cvState,
      source: 'rewrite',
      createdAt: new Date('2026-04-12T12:00:00.000Z'),
    })
    mockCheckUserQuota.mockResolvedValue(true)
    mockGenerateFile.mockResolvedValue({
      output: {
        success: true,
        pdfUrl: 'https://example.com/resume.pdf',
        docxUrl: null,
        creditsUsed: 1,
      },
      generatedOutput: {
        status: 'ready',
        pdfPath: 'usr_123/sess_123/resume.pdf',
        docxPath: null,
        generatedAt: '2026-04-12T12:01:00.000Z',
      },
    })

    const result = await generateBillableResume({
      userId: 'usr_123',
      sessionId: 'sess_123',
      sourceCvState: cvState,
    })

    expect(result.output).toEqual({
      success: true,
      pdfUrl: 'https://example.com/resume.pdf',
      docxUrl: null,
      creditsUsed: 1,
    })
    expect(mockReserveCreditForGenerationIntent).not.toHaveBeenCalled()
    expect(buildLegacyFallbackGenerationId(cvState)).toContain('legacy:sess_123:base')
  })

  it('reserves one credit before generateFile runs and finalizes exactly once on success', async () => {
    const cvState = buildCvState()
    mockGetLatestCvVersionForScope.mockResolvedValue({
      id: 'ver_rewrite',
      sessionId: 'sess_123',
      snapshot: cvState,
      source: 'rewrite',
      createdAt: new Date('2026-04-12T12:00:00.000Z'),
    })
    mockCheckUserQuota.mockResolvedValue(true)
    mockCreatePendingResumeGeneration.mockResolvedValue({
      generation: buildPendingGeneration(cvState, { id: 'gen_pending_success' }),
      wasCreated: true,
    })
    mockGenerateFile.mockImplementation(async () => {
      expect(mockReserveCreditForGenerationIntent).toHaveBeenCalledTimes(1)
      expect(mockFinalizeCreditReservation).not.toHaveBeenCalled()
      return {
        output: {
          success: true,
          pdfUrl: 'https://example.com/resume.pdf',
          docxUrl: null,
        },
        generatedOutput: {
          status: 'ready',
          pdfPath: 'usr_123/sess_123/resume.pdf',
          docxPath: null,
          generatedAt: '2026-04-12T12:01:00.000Z',
        },
      }
    })
    mockUpdateResumeGeneration.mockResolvedValue({
      ...buildPendingGeneration(cvState, { id: 'gen_pending_success', status: 'completed' }),
      generatedCvState: cvState,
      outputPdfPath: 'usr_123/sess_123/resume.pdf',
      outputDocxPath: null,
      updatedAt: new Date('2026-04-12T12:01:00.000Z'),
    })

    const result = await generateBillableResume({
      userId: 'usr_123',
      sessionId: 'sess_123',
      sourceCvState: cvState,
      idempotencyKey: 'dup_key',
    })

    expect(result.output).toEqual({
      success: true,
      pdfUrl: 'https://example.com/resume.pdf',
      docxUrl: null,
      creditsUsed: 1,
      resumeGenerationId: 'gen_pending_success',
    })
    expect(mockReserveCreditForGenerationIntent).toHaveBeenCalledWith({
      userId: 'usr_123',
      generationIntentKey: 'dup_key',
      generationType: 'ATS_ENHANCEMENT',
      jobId: undefined,
      sessionId: 'sess_123',
      resumeTargetId: undefined,
      resumeGenerationId: 'gen_pending_success',
      metadata: expect.any(Object),
    })
    expect(mockFinalizeCreditReservation).toHaveBeenCalledWith({
      userId: 'usr_123',
      generationIntentKey: 'dup_key',
      resumeGenerationId: 'gen_pending_success',
      metadata: expect.any(Object),
    })
    expect(mockReleaseCreditReservation).not.toHaveBeenCalled()
  })

  it('applies the same locked preview access to the returned output and persisted patch for free trial generations', async () => {
    const cvState = buildCvState()
    mockGetLatestCvVersionForScope.mockResolvedValue({
      id: 'ver_rewrite',
      sessionId: 'sess_123',
      snapshot: cvState,
      source: 'rewrite',
      createdAt: new Date('2026-04-12T12:00:00.000Z'),
    })
    mockCheckUserQuota.mockResolvedValue(true)
    mockGetUserBillingInfo.mockResolvedValue({
      plan: 'free',
    })
    mockCreatePendingResumeGeneration.mockResolvedValue({
      generation: buildPendingGeneration(cvState, { id: 'gen_pending_free' }),
      wasCreated: true,
    })
    mockGenerateFile.mockResolvedValue({
      output: {
        success: true,
        pdfUrl: 'https://example.com/resume.pdf',
        docxUrl: null,
      },
      patch: {
        generatedOutput: {
          status: 'ready',
          pdfPath: 'usr_123/sess_123/resume.pdf',
          generatedAt: '2026-04-12T12:01:00.000Z',
        },
      },
      generatedOutput: {
        status: 'ready',
        pdfPath: 'usr_123/sess_123/resume.pdf',
        docxPath: null,
        generatedAt: '2026-04-12T12:01:00.000Z',
      },
    })
    mockUpdateResumeGeneration.mockResolvedValue({
      ...buildPendingGeneration(cvState, { id: 'gen_pending_free', status: 'completed' }),
      generatedCvState: cvState,
      outputPdfPath: 'usr_123/sess_123/resume.pdf',
      outputDocxPath: null,
      updatedAt: new Date('2026-04-12T12:01:00.000Z'),
    })

    const result = await generateBillableResume({
      userId: 'usr_123',
      sessionId: 'sess_123',
      sourceCvState: cvState,
      idempotencyKey: 'dup_key',
    })

    expect(result.output).toEqual({
      success: true,
      pdfUrl: '/api/file/sess_123/locked-preview',
      docxUrl: null,
      creditsUsed: 1,
      resumeGenerationId: 'gen_pending_free',
    })
    expect(result.generatedOutput?.previewAccess).toEqual(expect.objectContaining({
      locked: true,
      blurred: true,
      canViewRealContent: false,
      requiresRegenerationAfterUnlock: true,
      reason: 'free_trial_locked',
    }))
    expect(result.patch?.generatedOutput?.previewAccess).toEqual(
      result.generatedOutput?.previewAccess,
    )
  })

  it('releases the held credit exactly once when rendering fails after reservation', async () => {
    const cvState = buildCvState()
    mockGetLatestCvVersionForScope.mockResolvedValue({
      id: 'ver_rewrite',
      sessionId: 'sess_123',
      snapshot: cvState,
      source: 'rewrite',
      createdAt: new Date('2026-04-12T12:00:00.000Z'),
    })
    mockCheckUserQuota.mockResolvedValue(true)
    mockCreatePendingResumeGeneration.mockResolvedValue({
      generation: buildPendingGeneration(cvState, { id: 'gen_pending_render' }),
      wasCreated: true,
    })
    mockGenerateFile.mockResolvedValue({
      output: {
        success: false,
        code: 'GENERATION_ERROR',
        error: 'File generation failed.',
      },
      generatedOutput: {
        status: 'failed',
        error: 'renderer crashed',
      },
    })

    const result = await generateBillableResume({
      userId: 'usr_123',
      sessionId: 'sess_123',
      sourceCvState: cvState,
      idempotencyKey: 'dup_key',
    })

    expect(result.output).toEqual({
      success: false,
      code: 'GENERATION_ERROR',
      error: 'File generation failed.',
    })
    expect(mockReserveCreditForGenerationIntent).toHaveBeenCalledTimes(1)
    expect(mockFinalizeCreditReservation).not.toHaveBeenCalled()
    expect(mockReleaseCreditReservation).toHaveBeenCalledWith({
      userId: 'usr_123',
      generationIntentKey: 'dup_key',
      resumeGenerationId: 'gen_pending_render',
      metadata: expect.any(Object),
    })
    expect(mockUpdateResumeGeneration).toHaveBeenCalledWith({
      id: 'gen_pending_render',
      status: 'failed',
      failureReason: 'renderer crashed',
    })
  })

  it('fails timed-out renders through the release path so capacity is not held indefinitely', async () => {
    vi.useFakeTimers()
    process.env.EXPORT_GENERATION_TIMEOUT_MS = '5'

    const cvState = buildCvState()
    mockGetLatestCvVersionForScope.mockResolvedValue({
      id: 'ver_rewrite',
      sessionId: 'sess_123',
      snapshot: cvState,
      source: 'rewrite',
      createdAt: new Date('2026-04-12T12:00:00.000Z'),
    })
    mockCheckUserQuota.mockResolvedValue(true)
    mockCreatePendingResumeGeneration.mockResolvedValue({
      generation: buildPendingGeneration(cvState, { id: 'gen_pending_timeout' }),
      wasCreated: true,
    })
    mockGenerateFile.mockImplementation(() => new Promise(() => undefined))

    const resultPromise = generateBillableResume({
      userId: 'usr_123',
      sessionId: 'sess_123',
      sourceCvState: cvState,
      idempotencyKey: 'dup_key',
    })

    await vi.advanceTimersByTimeAsync(10)
    const result = await resultPromise

    expect(result.output).toEqual({
      success: false,
      code: 'GENERATION_ERROR',
      error: 'A geracao do PDF excedeu o tempo limite e foi interrompida.',
    })
    expect(mockReleaseCreditReservation).toHaveBeenCalledWith({
      userId: 'usr_123',
      generationIntentKey: 'dup_key',
      resumeGenerationId: 'gen_pending_timeout',
      metadata: expect.any(Object),
    })
    expect(mockUpdateResumeGeneration).toHaveBeenCalledWith({
      id: 'gen_pending_timeout',
      status: 'failed',
      failureReason: 'Export generation timed out.',
    })

    vi.useRealTimers()
    delete process.env.EXPORT_GENERATION_TIMEOUT_MS
  })

  it('reuses the same reservation when a durable retry resumes the same intent', async () => {
    const cvState = buildCvState()
    mockGetResumeGenerationByIdempotencyKey.mockResolvedValue(
      buildPendingGeneration(cvState, { id: 'gen_pending_existing' }),
    )
    mockGetLatestCvVersionForScope.mockResolvedValue({
      id: 'ver_rewrite',
      sessionId: 'sess_123',
      snapshot: cvState,
      source: 'rewrite',
      createdAt: new Date('2026-04-12T12:00:00.000Z'),
    })
    mockCheckUserQuota.mockResolvedValue(true)
    mockReserveCreditForGenerationIntent.mockResolvedValue(buildReservation({
      generationIntentKey: 'dup_key',
      resumeGenerationId: 'gen_pending_existing',
      metadata: { reused: true },
    }))
    mockGenerateFile.mockResolvedValue({
      output: {
        success: true,
        pdfUrl: 'https://example.com/resume.pdf',
        docxUrl: null,
      },
      generatedOutput: {
        status: 'ready',
        pdfPath: 'usr_123/sess_123/resume.pdf',
        docxPath: null,
        generatedAt: '2026-04-12T12:01:00.000Z',
      },
    })
    mockUpdateResumeGeneration.mockResolvedValue({
      ...buildPendingGeneration(cvState, { id: 'gen_pending_existing', status: 'completed' }),
      generatedCvState: cvState,
      outputPdfPath: 'usr_123/sess_123/resume.pdf',
      outputDocxPath: null,
      updatedAt: new Date('2026-04-12T12:01:00.000Z'),
    })

    await generateBillableResume({
      userId: 'usr_123',
      sessionId: 'sess_123',
      sourceCvState: cvState,
      idempotencyKey: 'dup_key',
      resumePendingGeneration: true,
    })

    expect(mockReserveCreditForGenerationIntent).toHaveBeenCalledTimes(1)
    expect(mockFinalizeCreditReservation).toHaveBeenCalledTimes(1)
    expect(mockReleaseCreditReservation).not.toHaveBeenCalled()
  })

  it('keeps retry billing idempotent when the same pending generation is resumed more than once', async () => {
    const cvState = buildCvState()
    mockGetResumeGenerationByIdempotencyKey.mockResolvedValue(
      buildPendingGeneration(cvState, { id: 'gen_pending_existing' }),
    )
    mockGetLatestCvVersionForScope.mockResolvedValue({
      id: 'ver_rewrite',
      sessionId: 'sess_123',
      snapshot: cvState,
      source: 'rewrite',
      createdAt: new Date('2026-04-12T12:00:00.000Z'),
    })
    mockCheckUserQuota.mockResolvedValue(true)
    mockReserveCreditForGenerationIntent.mockResolvedValue(buildReservation({
      generationIntentKey: 'dup_key',
      resumeGenerationId: 'gen_pending_existing',
    }))
    mockGenerateFile.mockResolvedValue({
      output: {
        success: true,
        pdfUrl: 'https://example.com/resume.pdf',
        docxUrl: null,
      },
      generatedOutput: {
        status: 'ready',
        pdfPath: 'usr_123/sess_123/resume.pdf',
        docxPath: null,
        generatedAt: '2026-04-12T12:01:00.000Z',
      },
    })
    mockUpdateResumeGeneration.mockResolvedValue({
      ...buildPendingGeneration(cvState, { id: 'gen_pending_existing', status: 'completed' }),
      generatedCvState: cvState,
      outputPdfPath: 'usr_123/sess_123/resume.pdf',
      outputDocxPath: null,
      updatedAt: new Date('2026-04-12T12:01:00.000Z'),
    })

    await generateBillableResume({
      userId: 'usr_123',
      sessionId: 'sess_123',
      sourceCvState: cvState,
      idempotencyKey: 'dup_key',
      resumePendingGeneration: true,
    })

    await generateBillableResume({
      userId: 'usr_123',
      sessionId: 'sess_123',
      sourceCvState: cvState,
      idempotencyKey: 'dup_key',
      resumePendingGeneration: true,
    })

    expect(mockReserveCreditForGenerationIntent).toHaveBeenNthCalledWith(1, expect.objectContaining({
      generationIntentKey: 'dup_key',
    }))
    expect(mockReserveCreditForGenerationIntent).toHaveBeenNthCalledWith(2, expect.objectContaining({
      generationIntentKey: 'dup_key',
    }))
    expect(mockFinalizeCreditReservation).toHaveBeenCalledTimes(2)
    expect(mockReleaseCreditReservation).not.toHaveBeenCalled()
  })

  it('preserves artifact availability when finalize and reconciliation marker writes both fail after render success', async () => {
    const cvState = buildCvState()
    mockGetLatestCvVersionForScope.mockResolvedValue({
      id: 'ver_rewrite',
      sessionId: 'sess_123',
      snapshot: cvState,
      source: 'rewrite',
      createdAt: new Date('2026-04-12T12:00:00.000Z'),
    })
    mockCheckUserQuota.mockResolvedValue(true)
    mockCreatePendingResumeGeneration.mockResolvedValue({
      generation: buildPendingGeneration(cvState, { id: 'gen_pending_success' }),
      wasCreated: true,
    })
    mockGenerateFile.mockResolvedValue({
      output: {
        success: true,
        pdfUrl: 'https://example.com/resume.pdf',
        docxUrl: null,
      },
      generatedOutput: {
        status: 'ready',
        pdfPath: 'usr_123/sess_123/resume.pdf',
        docxPath: null,
        generatedAt: '2026-04-12T12:01:00.000Z',
      },
    })
    mockFinalizeCreditReservation.mockRejectedValue(new Error('finalize rpc failed'))
    mockMarkCreditReservationReconciliation.mockRejectedValue(new Error('marker update failed'))
    mockUpdateResumeGeneration.mockRejectedValue(new Error('resume_generations update failed'))

    const result = await generateBillableResume({
      userId: 'usr_123',
      sessionId: 'sess_123',
      sourceCvState: cvState,
      idempotencyKey: 'dup_key',
    })

    expect(result.output).toEqual({
      success: true,
      pdfUrl: 'https://example.com/resume.pdf',
      docxUrl: null,
      creditsUsed: 1,
      resumeGenerationId: undefined,
    })
    expect(result.generatedOutput).toEqual(expect.objectContaining({
      status: 'ready',
      pdfPath: 'usr_123/sess_123/resume.pdf',
    }))
    expect(mockReleaseCreditReservation).not.toHaveBeenCalled()
    expect(mockMarkCreditReservationReconciliation).toHaveBeenCalledWith({
      reservationId: 'res_123',
      status: 'needs_reconciliation',
      reconciliationStatus: 'pending',
      failureReason: 'finalize rpc failed',
      metadata: {
        source: 'artifact_success_finalize',
        generationIntentKey: 'dup_key',
      },
    })
    expect(mockLogWarn).toHaveBeenCalledWith(
      'resume_generation.reconciliation_marker_failed',
      expect.objectContaining({
        generationIntentKey: 'dup_key',
        stage: 'finalize_credit',
        errorMessage: 'marker update failed',
      }),
    )
    expect(mockLogWarn).toHaveBeenCalledWith(
      'resume_generation.billing_reconciliation_required',
      expect.objectContaining({
        stage: 'finalize_credit',
        generationIntentKey: 'dup_key',
        resumeGenerationId: 'gen_pending_success',
      }),
    )
  })
})
