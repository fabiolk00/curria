import { createHash } from 'crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { generateBillableResume } from './generate-billable-resume'

const {
  mockGenerateFile,
  mockCreateSignedResumeArtifactUrls,
  mockValidateGenerationCvState,
  mockCheckUserQuota,
  mockConsumeCreditForGeneration,
  mockGetLatestCvVersionForScope,
  mockCreatePendingResumeGeneration,
  mockGetLatestCompletedResumeGenerationForScope,
  mockGetResumeGenerationByIdempotencyKey,
  mockUpdateResumeGeneration,
  mockLogWarn,
} = vi.hoisted(() => ({
  mockGenerateFile: vi.fn(),
  mockCreateSignedResumeArtifactUrls: vi.fn(),
  mockValidateGenerationCvState: vi.fn(),
  mockCheckUserQuota: vi.fn(),
  mockConsumeCreditForGeneration: vi.fn(),
  mockGetLatestCvVersionForScope: vi.fn(),
  mockCreatePendingResumeGeneration: vi.fn(),
  mockGetLatestCompletedResumeGenerationForScope: vi.fn(),
  mockGetResumeGenerationByIdempotencyKey: vi.fn(),
  mockUpdateResumeGeneration: vi.fn(),
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
}))

vi.mock('@/lib/db/cv-versions', () => ({
  getLatestCvVersionForScope: mockGetLatestCvVersionForScope,
}))

vi.mock('@/lib/db/resume-generations', () => ({
  createPendingResumeGeneration: mockCreatePendingResumeGeneration,
  getLatestCompletedResumeGenerationForScope: mockGetLatestCompletedResumeGenerationForScope,
  getResumeGenerationByIdempotencyKey: mockGetResumeGenerationByIdempotencyKey,
  updateResumeGeneration: mockUpdateResumeGeneration,
}))

vi.mock('@/lib/observability/structured-log', () => ({
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
    mockUpdateResumeGeneration.mockResolvedValue(undefined)
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
    expect(mockCreatePendingResumeGeneration).not.toHaveBeenCalled()
    expect(mockGenerateFile).not.toHaveBeenCalled()
  })

  it('replays an existing completed generation without charging again', async () => {
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
    expect(mockCheckUserQuota).not.toHaveBeenCalled()
    expect(mockCreatePendingResumeGeneration).not.toHaveBeenCalled()
    expect(mockGenerateFile).not.toHaveBeenCalled()
  })

  it('keeps replaying an existing completed generation when signed url creation fails', async () => {
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
      pdfUrl: null,
      docxUrl: null,
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
      resumeGenerationId: 'gen_existing',
    })
    expect(mockCheckUserQuota).not.toHaveBeenCalled()
    expect(mockCreatePendingResumeGeneration).not.toHaveBeenCalled()
    expect(mockGenerateFile).not.toHaveBeenCalled()
  })

  it('short-circuits duplicate in-flight pending generations without rendering twice', async () => {
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
      generation: {
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
      },
      wasCreated: false,
    })

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
      resumeGenerationId: 'gen_pending',
      inProgress: true,
    })
    expect(result.generatedOutput).toEqual({
      status: 'generating',
    })
    expect(result.resumeGeneration?.id).toBe('gen_pending')
    expect(mockGenerateFile).not.toHaveBeenCalled()
    expect(mockConsumeCreditForGeneration).not.toHaveBeenCalled()
  })

  it('returns an in-progress response when the idempotency key already points to a pending generation', async () => {
    const cvState = buildCvState()
    mockGetResumeGenerationByIdempotencyKey.mockResolvedValue({
      id: 'gen_pending_existing',
      userId: 'usr_123',
      sessionId: 'sess_123',
      type: 'ATS_ENHANCEMENT',
      status: 'pending',
      idempotencyKey: 'dup_key',
      sourceCvSnapshot: cvState,
      versionNumber: 1,
      createdAt: new Date('2026-04-12T12:00:00.000Z'),
      updatedAt: new Date('2026-04-12T12:00:00.000Z'),
    })

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
    expect(mockCreatePendingResumeGeneration).not.toHaveBeenCalled()
    expect(mockGenerateFile).not.toHaveBeenCalled()
  })

  it('resumes a pending generation when a durable worker is retrying the same idempotency key', async () => {
    const cvState = buildCvState()
    const createdAt = new Date('2026-04-12T12:00:00.000Z')
    const completedAt = new Date('2026-04-12T12:01:00.000Z')

    mockGetResumeGenerationByIdempotencyKey.mockResolvedValue({
      id: 'gen_pending_existing',
      userId: 'usr_123',
      sessionId: 'sess_123',
      type: 'ATS_ENHANCEMENT',
      status: 'pending',
      idempotencyKey: 'dup_key',
      sourceCvSnapshot: cvState,
      versionNumber: 1,
      createdAt,
      updatedAt: createdAt,
    })
    mockGetLatestCvVersionForScope.mockResolvedValue({
      id: 'ver_rewrite',
      sessionId: 'sess_123',
      snapshot: cvState,
      source: 'rewrite',
      createdAt,
    })
    mockCheckUserQuota.mockResolvedValue(true)
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
        generatedAt: completedAt.toISOString(),
      },
    })
    mockConsumeCreditForGeneration.mockResolvedValue(true)
    mockUpdateResumeGeneration.mockResolvedValue({
      id: 'gen_pending_existing',
      userId: 'usr_123',
      sessionId: 'sess_123',
      type: 'ATS_ENHANCEMENT',
      status: 'completed',
      idempotencyKey: 'dup_key',
      sourceCvSnapshot: cvState,
      generatedCvState: cvState,
      outputPdfPath: 'usr_123/sess_123/resume.pdf',
      outputDocxPath: null,
      versionNumber: 1,
      createdAt,
      updatedAt: completedAt,
    })

    const result = await generateBillableResume({
      userId: 'usr_123',
      sessionId: 'sess_123',
      sourceCvState: cvState,
      idempotencyKey: 'dup_key',
      resumePendingGeneration: true,
    })

    expect(result.output).toEqual({
      success: true,
      pdfUrl: 'https://example.com/resume.pdf',
      docxUrl: null,
      creditsUsed: 1,
      resumeGenerationId: 'gen_pending_existing',
    })
    expect(mockCreatePendingResumeGeneration).not.toHaveBeenCalled()
    expect(mockGenerateFile).toHaveBeenCalledTimes(1)
    expect(mockConsumeCreditForGeneration).toHaveBeenCalledWith(
      'usr_123',
      'gen_pending_existing',
      'ATS_ENHANCEMENT',
    )
  })

  it('returns the previous failure for the same idempotency key without retrying or charging again', async () => {
    const cvState = buildCvState()
    mockGetResumeGenerationByIdempotencyKey.mockResolvedValue({
      id: 'gen_failed_existing',
      userId: 'usr_123',
      sessionId: 'sess_123',
      type: 'ATS_ENHANCEMENT',
      status: 'failed',
      idempotencyKey: 'dup_failed',
      sourceCvSnapshot: cvState,
      failureReason: 'wkhtmltopdf crashed',
      versionNumber: 1,
      createdAt: new Date('2026-04-12T12:00:00.000Z'),
      updatedAt: new Date('2026-04-12T12:00:00.000Z'),
    })

    const result = await generateBillableResume({
      userId: 'usr_123',
      sessionId: 'sess_123',
      sourceCvState: cvState,
      idempotencyKey: 'dup_failed',
    })

    expect(result.output).toEqual({
      success: false,
      code: 'GENERATION_ERROR',
      error: 'wkhtmltopdf crashed',
    })
    expect(mockCreatePendingResumeGeneration).not.toHaveBeenCalled()
    expect(mockCheckUserQuota).not.toHaveBeenCalled()
    expect(mockConsumeCreditForGeneration).not.toHaveBeenCalled()
    expect(mockGenerateFile).not.toHaveBeenCalled()
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
      },
      generatedOutput: {
        status: 'ready',
        pdfPath: 'usr_123/sess_123/resume.pdf',
        docxPath: null,
        generatedAt: '2026-04-12T12:01:00.000Z',
      },
    })
    mockConsumeCreditForGeneration.mockResolvedValue(true)

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
    expect(mockCreatePendingResumeGeneration).not.toHaveBeenCalled()
    expect(mockConsumeCreditForGeneration).toHaveBeenCalledWith(
      'usr_123',
      buildLegacyFallbackGenerationId(cvState),
      'ATS_ENHANCEMENT',
    )
  })

  it('still rejects fallback exports when the latest cv version source is not billable', async () => {
    const cvState = buildCvState()
    mockGetLatestCompletedResumeGenerationForScope.mockRejectedValue(
      new Error('Failed to load latest completed resume generation: relation "resume_generations" does not exist'),
    )
    mockGetLatestCvVersionForScope.mockResolvedValue({
      id: 'ver_manual',
      sessionId: 'sess_123',
      snapshot: cvState,
      source: 'manual',
      createdAt: new Date('2026-04-12T12:00:00.000Z'),
    })

    const result = await generateBillableResume({
      userId: 'usr_123',
      sessionId: 'sess_123',
      sourceCvState: cvState,
    })

    expect(result.output).toEqual({
      success: false,
      code: 'VALIDATION_ERROR',
      error: 'Gere uma nova versão otimizada pela IA antes de exportar este currículo.',
    })
    expect(mockCheckUserQuota).not.toHaveBeenCalled()
    expect(mockGenerateFile).not.toHaveBeenCalled()
    expect(mockConsumeCreditForGeneration).not.toHaveBeenCalled()
  })

  it('still stops fallback exports before rendering when the user has no credits', async () => {
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
    expect(mockGenerateFile).not.toHaveBeenCalled()
    expect(mockConsumeCreditForGeneration).not.toHaveBeenCalled()
  })

  it('falls back to legacy generation when resume_generations inserts are unavailable', async () => {
    const cvState = buildCvState()
    mockGetLatestCvVersionForScope.mockResolvedValue({
      id: 'ver_rewrite',
      sessionId: 'sess_123',
      snapshot: cvState,
      source: 'rewrite',
      createdAt: new Date('2026-04-12T12:00:00.000Z'),
    })
    mockCheckUserQuota.mockResolvedValue(true)
    mockCreatePendingResumeGeneration.mockRejectedValue(
      new Error('Failed to create resume generation: relation "resume_generations" does not exist'),
    )
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
    mockConsumeCreditForGeneration.mockResolvedValue(true)

    const result = await generateBillableResume({
      userId: 'usr_123',
      sessionId: 'sess_123',
      sourceCvState: cvState,
      idempotencyKey: 'profile-ats:sess_123',
    })

    expect(result.output).toEqual({
      success: true,
      pdfUrl: 'https://example.com/resume.pdf',
      docxUrl: null,
      creditsUsed: 1,
    })
    expect(mockConsumeCreditForGeneration).toHaveBeenCalledWith(
      'usr_123',
      buildLegacyFallbackGenerationId(cvState, { idempotencyKey: 'profile-ats:sess_123' }),
      'ATS_ENHANCEMENT',
    )
  })

  it('uses distinct fallback billing ids for separate exports in the same session scope', async () => {
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
      },
      generatedOutput: {
        status: 'ready',
        pdfPath: 'usr_123/sess_123/resume.pdf',
        docxPath: null,
        generatedAt: '2026-04-12T12:01:00.000Z',
      },
    })
    mockConsumeCreditForGeneration.mockResolvedValue(true)

    await generateBillableResume({
      userId: 'usr_123',
      sessionId: 'sess_123',
      sourceCvState: cvState,
      idempotencyKey: 'export-1',
    })

    await generateBillableResume({
      userId: 'usr_123',
      sessionId: 'sess_123',
      sourceCvState: cvState,
      idempotencyKey: 'export-2',
    })

    expect(mockConsumeCreditForGeneration).toHaveBeenNthCalledWith(
      1,
      'usr_123',
      buildLegacyFallbackGenerationId(cvState, { idempotencyKey: 'export-1' }),
      'ATS_ENHANCEMENT',
    )
    expect(mockConsumeCreditForGeneration).toHaveBeenNthCalledWith(
      2,
      'usr_123',
      buildLegacyFallbackGenerationId(cvState, { idempotencyKey: 'export-2' }),
      'ATS_ENHANCEMENT',
    )
  })

  it('marks the generation failed when rendering succeeded but credit consumption cannot finalize', async () => {
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
      generation: {
        id: 'gen_pending_credit',
        userId: 'usr_123',
        sessionId: 'sess_123',
        type: 'ATS_ENHANCEMENT',
        status: 'pending',
        sourceCvSnapshot: cvState,
        versionNumber: 1,
        createdAt: new Date('2026-04-12T12:00:00.000Z'),
        updatedAt: new Date('2026-04-12T12:00:00.000Z'),
      },
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
    mockConsumeCreditForGeneration.mockResolvedValue(false)

    const result = await generateBillableResume({
      userId: 'usr_123',
      sessionId: 'sess_123',
      sourceCvState: cvState,
    })

    expect(result.output).toEqual({
      success: false,
      code: 'INSUFFICIENT_CREDITS',
      error: 'Seus créditos acabaram antes de concluir esta geração. Tente novamente após recarregar seu saldo.',
    })
    expect(mockUpdateResumeGeneration).toHaveBeenCalledWith({
      id: 'gen_pending_credit',
      status: 'failed',
      generatedCvState: cvState,
      failureReason: 'No credits available to finalize this generation.',
    })
    expect(mockLogWarn).toHaveBeenCalledWith(
      'resume_generation.billing_failed',
      expect.objectContaining({
        resumeGenerationId: 'gen_pending_credit',
        stage: 'billing',
        generationType: 'ATS_ENHANCEMENT',
        errorCode: 'INSUFFICIENT_CREDITS',
      }),
    )
  })

  it('returns the generated artifact even when persisting the completed generation record fails', async () => {
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
      generation: {
        id: 'gen_pending_success',
        userId: 'usr_123',
        sessionId: 'sess_123',
        type: 'ATS_ENHANCEMENT',
        status: 'pending',
        sourceCvSnapshot: cvState,
        versionNumber: 1,
        createdAt: new Date('2026-04-12T12:00:00.000Z'),
        updatedAt: new Date('2026-04-12T12:00:00.000Z'),
      },
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
    mockConsumeCreditForGeneration.mockResolvedValue(true)
    mockUpdateResumeGeneration.mockRejectedValue(new Error('resume_generations update failed'))

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
      resumeGenerationId: undefined,
    })
    expect(result.resumeGeneration).toBeUndefined()
    expect(mockLogWarn).toHaveBeenCalledWith(
      'resume_generation.persistence_failed',
      expect.objectContaining({
        resumeGenerationId: 'gen_pending_success',
        status: 'completed',
        stage: 'persistence',
        errorMessage: 'resume_generations update failed',
      }),
    )
  })

  it('logs render-stage failures and does not attempt billing consumption', async () => {
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
      generation: {
        id: 'gen_pending_render',
        userId: 'usr_123',
        sessionId: 'sess_123',
        type: 'ATS_ENHANCEMENT',
        status: 'pending',
        sourceCvSnapshot: cvState,
        versionNumber: 1,
        createdAt: new Date('2026-04-12T12:00:00.000Z'),
        updatedAt: new Date('2026-04-12T12:00:00.000Z'),
      },
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
    })

    expect(result.output).toEqual({
      success: false,
      code: 'GENERATION_ERROR',
      error: 'File generation failed.',
    })
    expect(mockConsumeCreditForGeneration).not.toHaveBeenCalled()
    expect(mockLogWarn).toHaveBeenCalledWith(
      'resume_generation.render_failed',
      expect.objectContaining({
        resumeGenerationId: 'gen_pending_render',
        stage: 'render',
        generationType: 'ATS_ENHANCEMENT',
        errorCode: 'GENERATION_ERROR',
        errorMessage: 'renderer crashed',
      }),
    )
  })
})
