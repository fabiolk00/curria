import { beforeEach, describe, expect, it, vi } from 'vitest'

import { generateBillableResume } from './generate-billable-resume'

const {
  mockGenerateFile,
  mockCreateSignedResumeArtifactUrls,
  mockCheckUserQuota,
  mockConsumeCreditForGeneration,
  mockGetLatestCvVersionForScope,
  mockCreatePendingResumeGeneration,
  mockGetLatestCompletedResumeGenerationForScope,
  mockGetResumeGenerationByIdempotencyKey,
  mockUpdateResumeGeneration,
} = vi.hoisted(() => ({
  mockGenerateFile: vi.fn(),
  mockCreateSignedResumeArtifactUrls: vi.fn(),
  mockCheckUserQuota: vi.fn(),
  mockConsumeCreditForGeneration: vi.fn(),
  mockGetLatestCvVersionForScope: vi.fn(),
  mockCreatePendingResumeGeneration: vi.fn(),
  mockGetLatestCompletedResumeGenerationForScope: vi.fn(),
  mockGetResumeGenerationByIdempotencyKey: vi.fn(),
  mockUpdateResumeGeneration: vi.fn(),
}))

vi.mock('@/lib/agent/tools/generate-file', () => ({
  generateFile: mockGenerateFile,
  createSignedResumeArtifactUrls: mockCreateSignedResumeArtifactUrls,
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

describe('generateBillableResume', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
      error: 'Gere uma nova versao otimizada pela IA antes de exportar este curriculo.',
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
})
