import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { CVState } from '@/types/cv'

import { createResumeTarget } from '@/lib/db/resume-targets'
import { analyzeGap } from '@/lib/agent/tools/gap-analysis'

import { createTargetResumeVariant, deriveTargetResumeCvState } from './create-target-resume'

const { createCompletion } = vi.hoisted(() => ({
  createCompletion: vi.fn(),
}))

vi.mock('@/lib/openai/client', () => ({
  openai: {
    chat: {
      completions: {
        create: createCompletion,
      },
    },
  },
}))

vi.mock('@/lib/agent/usage-tracker', () => ({
  trackApiUsage: vi.fn(() => Promise.resolve(undefined)),
}))

vi.mock('@/lib/agent/tools/gap-analysis', () => ({
  analyzeGap: vi.fn(),
}))

vi.mock('@/lib/db/resume-targets', () => ({
  createResumeTarget: vi.fn(),
}))

function buildBaseCvState(): CVState {
  return {
    fullName: 'Ana Silva',
    email: 'ana@example.com',
    phone: '555-0100',
    summary: 'Backend engineer focused on APIs.',
    experience: [{
      title: 'Backend Engineer',
      company: 'Acme',
      startDate: '2022',
      endDate: 'present',
      bullets: ['Built billing APIs'],
    }],
    skills: ['TypeScript', 'PostgreSQL'],
    education: [],
  }
}

function buildOpenAIResponse(text: string) {
  return {
    choices: [{ message: { content: text } }],
    usage: {
      prompt_tokens: 10,
      completion_tokens: 20,
    },
  }
}

describe('createTargetResumeVariant', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(analyzeGap).mockResolvedValue({
      output: {
        success: true,
        result: {
          matchScore: 70,
          missingSkills: ['AWS'],
          weakAreas: ['summary'],
          improvementSuggestions: ['Highlight cloud experience'],
        },
      },
      result: {
        matchScore: 70,
        missingSkills: ['AWS'],
        weakAreas: ['summary'],
        improvementSuggestions: ['Highlight cloud experience'],
      },
    })
  })

  it('creates target-specific resumes without overwriting the base cvState', async () => {
    const baseCvState = buildBaseCvState()

    createCompletion.mockResolvedValue(buildOpenAIResponse(JSON.stringify({
      ...baseCvState,
      summary: 'Backend engineer with strong cloud and API delivery experience.',
      skills: ['TypeScript', 'PostgreSQL', 'AWS'],
    })))

    vi.mocked(createResumeTarget).mockResolvedValue({
      id: 'target_123',
      sessionId: 'sess_123',
      targetJobDescription: 'AWS backend role',
      derivedCvState: {
        ...baseCvState,
        summary: 'Backend engineer with strong cloud and API delivery experience.',
        skills: ['TypeScript', 'PostgreSQL', 'AWS'],
      },
      gapAnalysis: {
        matchScore: 70,
        missingSkills: ['AWS'],
        weakAreas: ['summary'],
        improvementSuggestions: ['Highlight cloud experience'],
      },
      createdAt: new Date('2026-03-27T12:00:00.000Z'),
      updatedAt: new Date('2026-03-27T12:00:00.000Z'),
    })

    const result = await createTargetResumeVariant({
      sessionId: 'sess_123',
      userId: 'usr_123',
      baseCvState,
      targetJobDescription: 'AWS backend role',
    })

    expect(result.success).toBe(true)
    expect(baseCvState).toEqual(buildBaseCvState())
  })

  it('allows multiple targets to coexist with isolated derived cv states', async () => {
    const baseCvState = buildBaseCvState()

    createCompletion
      .mockResolvedValueOnce(buildOpenAIResponse(JSON.stringify({
        ...baseCvState,
        summary: 'Backend engineer optimized for AWS roles.',
        skills: ['TypeScript', 'PostgreSQL', 'AWS'],
      })))
      .mockResolvedValueOnce(buildOpenAIResponse(JSON.stringify({
        ...baseCvState,
        summary: 'Backend engineer optimized for data platform roles.',
        skills: ['TypeScript', 'PostgreSQL', 'Kafka'],
      })))

    vi.mocked(createResumeTarget)
      .mockResolvedValueOnce({
        id: 'target_aws',
        sessionId: 'sess_123',
        targetJobDescription: 'AWS backend role',
        derivedCvState: {
          ...baseCvState,
          summary: 'Backend engineer optimized for AWS roles.',
          skills: ['TypeScript', 'PostgreSQL', 'AWS'],
        },
        gapAnalysis: undefined,
        createdAt: new Date('2026-03-27T12:00:00.000Z'),
        updatedAt: new Date('2026-03-27T12:00:00.000Z'),
      })
      .mockResolvedValueOnce({
        id: 'target_data',
        sessionId: 'sess_123',
        targetJobDescription: 'Data platform backend role',
        derivedCvState: {
          ...baseCvState,
          summary: 'Backend engineer optimized for data platform roles.',
          skills: ['TypeScript', 'PostgreSQL', 'Kafka'],
        },
        gapAnalysis: undefined,
        createdAt: new Date('2026-03-27T12:05:00.000Z'),
        updatedAt: new Date('2026-03-27T12:05:00.000Z'),
      })

    const firstResult = await createTargetResumeVariant({
      sessionId: 'sess_123',
      userId: 'usr_123',
      baseCvState,
      targetJobDescription: 'AWS backend role',
    })
    const secondResult = await createTargetResumeVariant({
      sessionId: 'sess_123',
      userId: 'usr_123',
      baseCvState,
      targetJobDescription: 'Data platform backend role',
    })

    expect(firstResult.success).toBe(true)
    expect(secondResult.success).toBe(true)

    if (firstResult.success && secondResult.success) {
      expect(firstResult.target.id).toBe('target_aws')
      expect(secondResult.target.id).toBe('target_data')
      expect(firstResult.target.derivedCvState.summary).not.toBe(secondResult.target.derivedCvState.summary)
      expect(firstResult.target.derivedCvState.skills).toEqual(['TypeScript', 'PostgreSQL', 'AWS'])
      expect(secondResult.target.derivedCvState.skills).toEqual(['TypeScript', 'PostgreSQL', 'Kafka'])
    }

    expect(baseCvState).toEqual(buildBaseCvState())
  })

  it('fails atomically when target persistence does not commit', async () => {
    const baseCvState = buildBaseCvState()
    const persistedTargets: string[] = []

    createCompletion.mockResolvedValue(buildOpenAIResponse(JSON.stringify({
      ...baseCvState,
      summary: 'Backend engineer optimized for AWS roles.',
      skills: ['TypeScript', 'PostgreSQL', 'AWS'],
    })))

    vi.mocked(createResumeTarget).mockImplementation(async () => {
      return await Promise.reject(new Error('Transactional insert failed'))
    })

    const result = await createTargetResumeVariant({
      sessionId: 'sess_123',
      userId: 'usr_123',
      baseCvState,
      targetJobDescription: 'AWS backend role',
    })

    expect(result).toEqual({
      success: false,
      code: 'INTERNAL_ERROR',
      error: 'Failed to create target resume.',
    })

    expect(persistedTargets).toEqual([])
    expect(baseCvState).toEqual(buildBaseCvState())
  })

  it('retries when the first target resume is effectively the same as the base cv state', async () => {
    const baseCvState = buildBaseCvState()

    createCompletion
      .mockResolvedValueOnce(buildOpenAIResponse(JSON.stringify(baseCvState)))
      .mockResolvedValueOnce(buildOpenAIResponse(JSON.stringify({
        ...baseCvState,
        summary: 'Analytics Engineer com foco em SQL, BigQuery e confiabilidade de dados.',
        skills: ['TypeScript', 'PostgreSQL', 'BigQuery'],
      })))

    const result = await deriveTargetResumeCvState({
      sessionId: 'sess_123',
      userId: 'usr_123',
      baseCvState,
      targetJobDescription: 'Senior Analytics Engineer com foco em SQL e BigQuery.',
    })

    expect(createCompletion).toHaveBeenCalledTimes(2)
    expect(result.success).toBe(true)

    if (result.success) {
      expect(result.derivedCvState.summary).toContain('Analytics Engineer')
      expect(result.derivedCvState.skills).toContain('BigQuery')
    }
  })

  it('normalizes ATS-hostile pipe separators from the derived cv state', async () => {
    const baseCvState = buildBaseCvState()

    createCompletion.mockResolvedValue(buildOpenAIResponse(JSON.stringify({
      ...baseCvState,
      summary: 'Analytics Engineer | SQL | BigQuery',
      experience: [{
        ...baseCvState.experience[0],
        bullets: ['Modelou pipelines | melhorou confiabilidade'],
      }],
    })))

    const result = await deriveTargetResumeCvState({
      sessionId: 'sess_123',
      userId: 'usr_123',
      baseCvState,
      targetJobDescription: 'Senior Analytics Engineer com foco em SQL e BigQuery.',
    })

    expect(result.success).toBe(true)

    if (result.success) {
      expect(result.derivedCvState.summary).toBe('Analytics Engineer, SQL, BigQuery')
      expect(result.derivedCvState.experience[0]?.bullets[0]).toBe('Modelou pipelines, melhorou confiabilidade')
    }
  })
})
