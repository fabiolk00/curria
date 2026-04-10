import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { CVState } from '@/types/cv'

import { analyzeGap } from './gap-analysis'

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

function buildCvState(): CVState {
  return {
    fullName: 'Ana Silva',
    email: 'ana@example.com',
    phone: '555-0100',
    summary: 'Backend engineer focused on APIs.',
    experience: [],
    skills: ['TypeScript', 'PostgreSQL'],
    education: [],
  }
}

function buildOpenAIResponse(content: string) {
  return {
    choices: [{
      message: {
        content,
      },
    }],
    usage: {
      prompt_tokens: 10,
      completion_tokens: 20,
    },
  }
}

describe('gap analysis', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns validated structured output', async () => {
    createCompletion.mockResolvedValue(buildOpenAIResponse(JSON.stringify({
      matchScore: 72,
      missingSkills: ['AWS'],
      weakAreas: ['summary'],
      improvementSuggestions: ['Add AWS experience to the summary and skills sections'],
    })))

    const result = await analyzeGap(
      buildCvState(),
      'Looking for AWS and backend API experience',
      'usr_123',
      'sess_123',
    )

    expect(result).toEqual({
      output: {
        success: true,
        result: {
          matchScore: 72,
          missingSkills: ['AWS'],
          weakAreas: ['summary'],
          improvementSuggestions: ['Add AWS experience to the summary and skills sections'],
        },
      },
      result: {
        matchScore: 72,
        missingSkills: ['AWS'],
        weakAreas: ['summary'],
        improvementSuggestions: ['Add AWS experience to the summary and skills sections'],
      },
    })
  })

  it('rejects invalid gap analysis output', async () => {
    createCompletion.mockResolvedValue(buildOpenAIResponse(JSON.stringify({
      matchScore: 120,
      missingSkills: 'AWS',
    })))

    const result = await analyzeGap(
      buildCvState(),
      'Looking for AWS and backend API experience',
      'usr_123',
      'sess_123',
    )

    expect(result).toEqual({
      output: {
        success: false,
        code: 'LLM_INVALID_OUTPUT',
        error: 'Invalid gap analysis payload.',
      },
    })
  })

  it('retries with a repair prompt when the first payload is invalid', async () => {
    createCompletion
      .mockResolvedValueOnce(buildOpenAIResponse(JSON.stringify({
        matchScore: 120,
        missingSkills: 'AWS',
      })))
      .mockResolvedValueOnce(buildOpenAIResponse(JSON.stringify({
        matchScore: 68,
        missingSkills: ['AWS'],
        weakAreas: ['summary'],
        improvementSuggestions: ['Highlight AWS projects in the summary'],
      })))

    const result = await analyzeGap(
      buildCvState(),
      'Looking for AWS and backend API experience',
      'usr_123',
      'sess_123',
    )

    expect(result).toEqual({
      output: {
        success: true,
        result: {
          matchScore: 68,
          missingSkills: ['AWS'],
          weakAreas: ['summary'],
          improvementSuggestions: ['Highlight AWS projects in the summary'],
        },
      },
      result: {
        matchScore: 68,
        missingSkills: ['AWS'],
        weakAreas: ['summary'],
        improvementSuggestions: ['Highlight AWS projects in the summary'],
      },
    })

    expect(createCompletion).toHaveBeenCalledTimes(2)
    expect(createCompletion.mock.calls[1]?.[0]).toEqual(expect.objectContaining({
      messages: expect.arrayContaining([
        expect.objectContaining({
          role: 'system',
          content: expect.stringContaining('previous gap analysis response was invalid'),
        }),
        expect.objectContaining({
          role: 'user',
        }),
      ]),
    }))
  })

  it('returns the original validation failure when the repair payload is still invalid', async () => {
    createCompletion
      .mockResolvedValueOnce(buildOpenAIResponse(JSON.stringify({
        matchScore: 120,
        missingSkills: 'AWS',
      })))
      .mockResolvedValueOnce(buildOpenAIResponse(JSON.stringify({
        matchScore: 200,
        missingSkills: ['AWS'],
      })))

    const result = await analyzeGap(
      buildCvState(),
      'Looking for AWS and backend API experience',
      'usr_123',
      'sess_123',
    )

    expect(result).toEqual({
      output: {
        success: false,
        code: 'LLM_INVALID_OUTPUT',
        error: 'Invalid gap analysis payload.',
      },
    })

    expect(createCompletion).toHaveBeenCalledTimes(2)
  })
})
