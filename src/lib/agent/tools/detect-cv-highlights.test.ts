import { beforeEach, describe, expect, it, vi } from 'vitest'

import { detectCvHighlights } from './detect-cv-highlights'
import {
  createExperienceBulletHighlightItemId,
  flattenCvStateForHighlight,
} from '@/lib/resume/cv-highlight-artifact'
import type { CVState } from '@/types/cv'

const { createCompletion, mockLogWarn, mockRecordMetricCounter } = vi.hoisted(() => ({
  createCompletion: vi.fn(),
  mockLogWarn: vi.fn(),
  mockRecordMetricCounter: vi.fn(),
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

vi.mock('@/lib/observability/structured-log', () => ({
  logWarn: mockLogWarn,
}))

vi.mock('@/lib/observability/metric-events', () => ({
  recordMetricCounter: mockRecordMetricCounter,
}))

function buildOpenAIResponse(text: string) {
  return {
    choices: [{ message: { content: text } }],
    usage: {
      prompt_tokens: 10,
      completion_tokens: 20,
    },
  }
}

function buildCvState(): CVState {
  return {
    fullName: 'Fabio Silva',
    email: 'fabio@example.com',
    phone: '11999999999',
    summary: 'Senior BI engineer improving executive analytics for LATAM stakeholders.',
    experience: [
      {
        title: 'Senior BI Engineer',
        company: 'ACME',
        startDate: '2022',
        endDate: 'present',
        bullets: [
          'Reduced processing time by 40% with Azure Databricks and PySpark.',
          'Built dashboards for regional leaders.',
        ],
      },
    ],
    skills: ['SQL', 'Python'],
    education: [],
  }
}

describe('detectCvHighlights', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls highlight detection exactly once for the full rewritten resume payload', async () => {
    const items = flattenCvStateForHighlight(buildCvState())

    createCompletion.mockResolvedValue(buildOpenAIResponse(JSON.stringify({
      items: [
        {
          itemId: 'summary_0',
          ranges: [{ start: 0, end: 16, reason: 'ats_strength' }],
        },
      ],
    })))

    await detectCvHighlights(items)

    expect(createCompletion).toHaveBeenCalledTimes(1)
    expect(JSON.parse(createCompletion.mock.calls[0][0].messages[1].content as string)).toEqual({
      items,
    })
  })

  it('drops invalid item ids and invalid ranges without throwing', async () => {
    const items = flattenCvStateForHighlight(buildCvState())
    const itemId = createExperienceBulletHighlightItemId(
      buildCvState().experience[0],
      buildCvState().experience[0].bullets[0],
    )

    createCompletion.mockResolvedValue(buildOpenAIResponse(JSON.stringify({
      items: [
        {
          itemId: 'missing',
          ranges: [{ start: 0, end: 16, reason: 'ats_strength' }],
        },
        {
          itemId,
          ranges: [
            { start: -1, end: 5, reason: 'metric_impact' },
            { start: 0, end: 10, reason: 'metric_impact' },
            { start: 5, end: 15, reason: 'tool_context' },
            { start: 1000, end: 1200, reason: 'tool_context' },
          ],
        },
      ],
    })))

    await expect(detectCvHighlights(items)).resolves.toEqual([
      {
        itemId,
        section: 'experience',
        ranges: [{ start: 0, end: 15, reason: 'metric_impact' }],
      },
    ])
  })

  it('warns and records a metric for invalid JSON payloads while failing closed', async () => {
    createCompletion.mockResolvedValue(buildOpenAIResponse('{invalid'))

    await expect(detectCvHighlights(flattenCvStateForHighlight(buildCvState()), {
      sessionId: 'sess_123',
      userId: 'usr_123',
      workflowMode: 'ats_enhancement',
    })).resolves.toEqual([])

    expect(mockLogWarn).toHaveBeenCalledWith('agent.highlight_detection.invalid_payload', expect.objectContaining({
      sessionId: 'sess_123',
      userId: 'usr_123',
      workflowMode: 'ats_enhancement',
      failureType: 'invalid_model_payload',
      parseFailureReason: 'invalid_json',
    }))
    expect(mockRecordMetricCounter).toHaveBeenCalledWith(
      'architecture.highlight_detection.invalid_payload',
      expect.objectContaining({
        workflowMode: 'ats_enhancement',
        parseFailureReason: 'invalid_json',
      }),
    )
  })

  it('warns and records a metric for invalid payload shapes while failing closed', async () => {
    createCompletion.mockResolvedValue(buildOpenAIResponse('{"invalid":true}'))

    await expect(detectCvHighlights(flattenCvStateForHighlight(buildCvState()))).resolves.toEqual([])

    expect(mockLogWarn).toHaveBeenCalledWith('agent.highlight_detection.invalid_payload', expect.objectContaining({
      failureType: 'invalid_model_payload',
      parseFailureReason: 'invalid_shape',
    }))
    expect(mockRecordMetricCounter).toHaveBeenCalledWith(
      'architecture.highlight_detection.invalid_payload',
      expect.objectContaining({
        parseFailureReason: 'invalid_shape',
      }),
    )
  })

  it('treats a valid empty payload as a normal no-highlight result without warning', async () => {
    createCompletion.mockResolvedValue(buildOpenAIResponse('{"items":[]}'))

    await expect(detectCvHighlights(flattenCvStateForHighlight(buildCvState()))).resolves.toEqual([])

    expect(mockLogWarn).not.toHaveBeenCalled()
    expect(mockRecordMetricCounter).not.toHaveBeenCalled()
  })

  it('surfaces thrown detection errors separately from invalid-payload handling', async () => {
    createCompletion.mockRejectedValue(new Error('model offline'))

    await expect(detectCvHighlights(flattenCvStateForHighlight(buildCvState()))).rejects.toThrow('model offline')

    expect(mockLogWarn).not.toHaveBeenCalled()
    expect(mockRecordMetricCounter).not.toHaveBeenCalled()
  })
})
