import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ResumeGeneration } from '@/types/agent'

import {
  buildResumeGenerationHistoryMetadata,
  listResumeGenerationHistory,
  sanitizeTargetJobSnippet,
} from './resume-generation-history'
import { listRecentResumeGenerationsForUser } from '@/lib/db/resume-generations'

vi.mock('@/lib/db/resume-generations', () => ({
  listRecentResumeGenerationsForUser: vi.fn(),
}))

function buildGeneration(overrides: Partial<ResumeGeneration>): ResumeGeneration {
  return {
    id: 'gen_default',
    userId: 'usr_123',
    sessionId: 'sess_default',
    type: 'ATS_ENHANCEMENT',
    status: 'completed',
    idempotencyKey: 'profile-ats:sess_default',
    sourceCvSnapshot: {
      fullName: 'Ana Silva',
      email: 'ana@example.com',
      phone: '555-0100',
      summary: 'Resumo',
      experience: [],
      skills: ['TypeScript'],
      education: [],
    },
    outputPdfPath: 'usr_123/sess_default/resume.pdf',
    versionNumber: 1,
    createdAt: new Date('2026-04-24T10:00:00.000Z'),
    updatedAt: new Date('2026-04-24T10:05:00.000Z'),
    completedAt: new Date('2026-04-24T10:05:00.000Z'),
    ...overrides,
  }
}

describe('resume generation history service', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-24T12:00:00.000Z'))
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('sanitizes long target-job snippets without leaking html', () => {
    expect(
      sanitizeTargetJobSnippet('<p> Senior Data Analyst </p> com SQL, Power BI e modelagem '.repeat(8)),
    ).toMatch(/^Senior Data Analyst/)
    expect(sanitizeTargetJobSnippet('<p>vaga</p>')).toBe('vaga')
  })

  it('maps chat, ats, and target-job metadata consistently', () => {
    expect(buildResumeGenerationHistoryMetadata({
      idempotencyKey: 'generation:sess_1:chat:ats_enhancement:abc',
    })).toMatchObject({
      historyKind: 'chat',
      historyTitle: 'Currículo gerado no chat',
    })

    expect(buildResumeGenerationHistoryMetadata({
      idempotencyKey: 'profile-ats:sess_2',
    })).toMatchObject({
      historyKind: 'ats_enhancement',
      historyTitle: 'Currículo ATS otimizado',
    })

    expect(buildResumeGenerationHistoryMetadata({
      idempotencyKey: 'profile-target:sess_3',
      resumeTargetId: 'target_3',
      targetRole: 'Data Analyst',
      targetJobDescription: 'Senior Data Analyst com SQL e Power BI.',
    })).toMatchObject({
      historyKind: 'target_job',
      historyTitle: 'Currículo para Data Analyst',
      targetJobSnippet: 'Senior Data Analyst com SQL e Power BI.',
    })
  })

  it('returns the latest 6 items only, paginates 4 per page, and exposes safe URLs', async () => {
    vi.mocked(listRecentResumeGenerationsForUser).mockResolvedValue([
      buildGeneration({
        id: 'gen_older_excluded',
        sessionId: 'sess_excluded',
        createdAt: new Date('2026-04-24T04:00:00.000Z'),
        completedAt: new Date('2026-04-24T04:05:00.000Z'),
      }),
      buildGeneration({
        id: 'gen_target',
        sessionId: 'sess_target',
        resumeTargetId: 'target_1',
        type: 'JOB_TARGETING',
        idempotencyKey: 'profile-target:sess_target',
        targetRole: 'Data Analyst',
        targetJobSnippet: 'Senior Data Analyst com SQL e Power BI.',
        historyKind: 'target_job',
        historyTitle: 'Currículo para Data Analyst',
        historyDescription: 'Adaptado para vaga: "Senior Data Analyst com SQL e Power BI."',
        createdAt: new Date('2026-04-24T11:55:00.000Z'),
        completedAt: new Date('2026-04-24T11:56:00.000Z'),
      }),
      buildGeneration({
        id: 'gen_chat',
        sessionId: 'sess_chat',
        idempotencyKey: 'generation:sess_chat:chat:ats_enhancement:abc',
        historyKind: 'chat',
        historyTitle: 'Currículo gerado no chat',
        historyDescription: 'Versão criada a partir da conversa com a IA.',
        createdAt: new Date('2026-04-24T11:50:00.000Z'),
        completedAt: new Date('2026-04-24T11:51:00.000Z'),
      }),
      buildGeneration({
        id: 'gen_processing',
        sessionId: 'sess_processing',
        status: 'pending',
        outputPdfPath: undefined,
        completedAt: undefined,
        createdAt: new Date('2026-04-24T11:45:00.000Z'),
        updatedAt: new Date('2026-04-24T11:45:00.000Z'),
      }),
      buildGeneration({
        id: 'gen_failed',
        sessionId: 'sess_failed',
        status: 'failed',
        outputPdfPath: undefined,
        failureReason: 'Rendering failed.',
        errorMessage: 'Rendering failed.',
        failedAt: new Date('2026-04-24T11:41:00.000Z'),
        completedAt: undefined,
        createdAt: new Date('2026-04-24T11:40:00.000Z'),
      }),
      buildGeneration({
        id: 'gen_completed_1',
        sessionId: 'sess_completed_1',
        createdAt: new Date('2026-04-24T11:35:00.000Z'),
        completedAt: new Date('2026-04-24T11:36:00.000Z'),
      }),
      buildGeneration({
        id: 'gen_completed_2',
        sessionId: 'sess_completed_2',
        createdAt: new Date('2026-04-24T11:30:00.000Z'),
        completedAt: new Date('2026-04-24T11:31:00.000Z'),
      }),
    ])

    const pageOne = await listResumeGenerationHistory({
      userId: 'usr_123',
      page: 1,
      limit: 4,
    })
    const pageTwo = await listResumeGenerationHistory({
      userId: 'usr_123',
      page: 2,
      limit: 4,
    })

    expect(listRecentResumeGenerationsForUser).toHaveBeenCalledWith('usr_123', 6)
    expect(pageOne.pagination).toEqual({
      page: 1,
      limit: 4,
      totalItems: 6,
      totalPages: 2,
      hasNextPage: true,
      hasPreviousPage: false,
    })
    expect(pageTwo.pagination).toEqual({
      page: 2,
      limit: 4,
      totalItems: 6,
      totalPages: 2,
      hasNextPage: false,
      hasPreviousPage: true,
    })
    expect(pageOne.items).toHaveLength(4)
    expect(pageTwo.items).toHaveLength(2)
    expect(pageOne.items.map((item) => item.id)).toEqual([
      'gen_target',
      'gen_chat',
      'gen_processing',
      'gen_failed',
    ])
    expect(pageTwo.items.map((item) => item.id)).toEqual([
      'gen_completed_1',
      'gen_completed_2',
    ])
    expect(pageOne.items[0]).toEqual(expect.objectContaining({
      kind: 'target_job',
      downloadPdfUrl: '/api/file/sess_target?download=pdf&targetId=target_1',
      viewerUrl: '/dashboard/resume/compare/sess_target',
    }))
    expect(pageOne.items[1]).toEqual(expect.objectContaining({
      kind: 'chat',
      status: 'completed',
    }))
    expect(pageOne.items[2]).toEqual(expect.objectContaining({
      status: 'processing',
      downloadPdfUrl: null,
    }))
    expect(pageOne.items[3]).toEqual(expect.objectContaining({
      status: 'failed',
      downloadPdfUrl: null,
    }))
    expect(pageOne.items[0]).not.toHaveProperty('outputPdfPath')
    expect(pageOne.items[0]).not.toHaveProperty('userId')
  })
})
