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
      repairAttempted: false,
    })
  })

  it('coerces almost valid gap analysis output without a repair round', async () => {
    createCompletion.mockResolvedValue(buildOpenAIResponse([
      'Here is the analysis you asked for:',
      '```json',
      JSON.stringify({
        matchScore: '72',
        missingSkills: 'AWS, Docker',
        weakAreas: 'summary; experience',
        improvementSuggestions: 'Add AWS examples\nShow Docker usage',
      }, null, 2),
      '```',
      'That should help.',
    ].join('\n')))

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
          missingSkills: ['AWS', 'Docker'],
          weakAreas: ['summary', 'experience'],
          improvementSuggestions: ['Add AWS examples', 'Show Docker usage'],
        },
      },
      result: {
        matchScore: 72,
        missingSkills: ['AWS', 'Docker'],
        weakAreas: ['summary', 'experience'],
        improvementSuggestions: ['Add AWS examples', 'Show Docker usage'],
      },
      repairAttempted: false,
    })

    expect(createCompletion).toHaveBeenCalledTimes(1)
    expect(createCompletion.mock.calls[0]?.[0]).toEqual(expect.objectContaining({
      max_completion_tokens: 600,
      messages: expect.arrayContaining([
        expect.objectContaining({
          role: 'user',
          content: expect.stringContaining('"resume"'),
        }),
      ]),
    }))
  })

  it('retries with a repair prompt when the first payload is invalid', async () => {
    createCompletion
      .mockResolvedValueOnce(buildOpenAIResponse(JSON.stringify({
        matchScore: 'high',
        missingSkills: 123,
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
      repairAttempted: true,
    })

    expect(createCompletion).toHaveBeenCalledTimes(2)
    expect(createCompletion.mock.calls[0]?.[0]).toEqual(expect.objectContaining({
      max_completion_tokens: 600,
    }))
    expect(createCompletion.mock.calls[1]?.[0]).toEqual(expect.objectContaining({
      max_completion_tokens: 400,
      messages: expect.arrayContaining([
        expect.objectContaining({
          role: 'system',
          content: expect.stringContaining('previous gap analysis response was invalid'),
        }),
        expect.objectContaining({
          role: 'user',
          content: expect.stringContaining('"resume"'),
        }),
      ]),
    }))
  })

  it('returns the original validation failure when the repair payload is still invalid', async () => {
    createCompletion
      .mockResolvedValueOnce(buildOpenAIResponse(JSON.stringify({
        matchScore: 'high',
        missingSkills: 123,
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
      repairAttempted: true,
    })

    expect(createCompletion).toHaveBeenCalledTimes(2)
  })
})
