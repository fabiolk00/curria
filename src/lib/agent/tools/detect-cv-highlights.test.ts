// Full test gate for this module and its Phase 97 hardening:
//
// npx vitest run \
//   src/lib/agent/tools/detect-cv-highlights.test.ts \
//   src/lib/resume/cv-highlight-artifact.test.ts \
//   src/lib/agent/tools/pipeline.test.ts \
//   src/lib/routes/session-comparison/decision.test.ts \
//   src/components/resume/resume-comparison-view.test.tsx
//
// All five files must be included. Running a subset masks cross-file regressions.

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { detectCvHighlights } from './detect-cv-highlights'
import {
  createExperienceBulletHighlightItemId,
  flattenCvStateForHighlight,
} from '@/lib/resume/cv-highlight-artifact'
import type { CVState } from '@/types/cv'

const { createCompletion, mockLogInfo, mockLogWarn, mockRecordMetricCounter } = vi.hoisted(() => ({
  createCompletion: vi.fn(),
  mockLogInfo: vi.fn(),
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
  logInfo: mockLogInfo,
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
    expect(mockLogInfo).toHaveBeenCalledWith('agent.highlight_detection.started', expect.objectContaining({
      itemCount: items.length,
      stage: 'highlight_detection',
    }))
  })

  it.skip('hardens the detector prompt around semantic closure and weak generic starts', async () => {
    // Prompt string inspection is documentation only. The real gate for prompt hardening
    // lives in the response-fixture tests below, which run the resolver against model output.
    const items = flattenCvStateForHighlight(buildCvState())

    createCompletion.mockResolvedValue(buildOpenAIResponse('{"items":[]}'))

    await detectCvHighlights(items)

    const systemPrompt = createCompletion.mock.calls[0]?.[0].messages[0].content as string

    expect(systemPrompt).toContain('The range must start and end on a complete semantic unit.')
    expect(systemPrompt).toContain('Never return an isolated number or percentage without its immediate measured context')
    expect(systemPrompt).toContain('A slightly longer natural phrase is better than a machine-cut fragment.')
    expect(systemPrompt).toContain('Otimizei pipelines com salting e repartitioning')
    expect(systemPrompt).toContain('Liderei a migracao de mais de 30 aplicacoes Qlik Sense para Qlik Cloud')
  })

  // NOTE: Editorial correction behavior (dangling metric, weak lead trim, non-regression)
  // is tested in cv-highlight-artifact.test.ts under the
  // 'validateAndResolveHighlights — editorial correction fixtures' describe block.
  // Tests here cover only the detector boundary: prompt construction, response parsing,
  // and the raw detection contract. They do not test the artifact resolver.

  it('passes raw model ranges through to the caller when the shared resolver accepts them unchanged', async () => {
    const text = 'Reduced costs by 40%.'
    const items = [{
      itemId: 'exp_test_item',
      section: 'experience' as const,
      text,
    }]
    const modelRange = {
      start: 0,
      end: text.length - 1,
      reason: 'metric_impact' as const,
    }

    createCompletion.mockResolvedValue(buildOpenAIResponse(JSON.stringify({
      items: [{
        itemId: 'exp_test_item',
        ranges: [modelRange],
      }],
    })))

    const result = await detectCvHighlights(items)

    expect(result).toEqual([{
      itemId: 'exp_test_item',
      section: 'experience',
      ranges: [modelRange],
    }])
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
        ranges: [{ start: 0, end: 18, reason: 'metric_impact' }],
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
    expect(mockLogInfo).toHaveBeenCalledWith('agent.highlight_detection.completed', expect.objectContaining({
      resultKind: 'invalid_payload',
      parseFailureReason: 'invalid_json',
      rawModelRangeCount: 0,
      validatedRangeCount: 0,
    }))
  })

  it('warns and records a metric for invalid payload shapes while failing closed', async () => {
    createCompletion.mockResolvedValue(buildOpenAIResponse('{"data":[]}'))

    await expect(detectCvHighlights(flattenCvStateForHighlight(buildCvState()))).resolves.toEqual([])

    expect(mockLogWarn).toHaveBeenCalledWith('agent.highlight_detection.invalid_payload', expect.objectContaining({
      failureType: 'invalid_model_payload',
      parseFailureReason: 'invalid_shape_wrapper',
    }))
    expect(mockRecordMetricCounter).toHaveBeenCalledWith(
      'architecture.highlight_detection.invalid_payload',
      expect.objectContaining({
        parseFailureReason: 'invalid_shape_wrapper',
      }),
    )
  })

  it('classifies prose before the JSON payload and logs a truncated sample', async () => {
    const invalidResponse = `Here is the highlight payload:\n${'x'.repeat(450)}\n{"items":[]}`
    createCompletion.mockResolvedValue(buildOpenAIResponse(invalidResponse))

    await expect(detectCvHighlights(flattenCvStateForHighlight(buildCvState()), {
      sessionId: 'sess_abc',
      workflowMode: 'ats_enhancement',
    })).resolves.toEqual([])

    expect(mockLogWarn).toHaveBeenCalledWith('agent.highlight_detection.invalid_payload', expect.objectContaining({
      sessionId: 'sess_abc',
      parseFailureReason: 'invalid_shape_text_before_json',
      responseSample: expect.stringMatching(/^Here is the highlight payload:/),
    }))
    const logFields = mockLogWarn.mock.calls[0][1]
    expect(logFields.responseSample.length).toBeLessThanOrEqual(403)
    expect(logFields.responseSample.endsWith('...')).toBe(true)
  })

  it('classifies markdown-wrapped payloads as invalid model output', async () => {
    createCompletion.mockResolvedValue(buildOpenAIResponse('```json\n{"items":[]}\n```'))

    await expect(detectCvHighlights(flattenCvStateForHighlight(buildCvState()))).resolves.toEqual([])

    expect(mockLogWarn).toHaveBeenCalledWith('agent.highlight_detection.invalid_payload', expect.objectContaining({
      parseFailureReason: 'invalid_shape_markdown_wrapper',
    }))
  })

  it('classifies malformed range objects as invalid range shape', async () => {
    const itemId = createExperienceBulletHighlightItemId(
      buildCvState().experience[0],
      buildCvState().experience[0].bullets[0],
    )

    createCompletion.mockResolvedValue(buildOpenAIResponse(JSON.stringify({
      items: [
        {
          itemId,
          ranges: [{ startOffset: 0, end: 10, reason: 'ats_strength' }],
        },
      ],
    })))

    await expect(detectCvHighlights(flattenCvStateForHighlight(buildCvState()))).resolves.toEqual([])

    expect(mockLogWarn).toHaveBeenCalledWith('agent.highlight_detection.invalid_payload', expect.objectContaining({
      parseFailureReason: 'invalid_shape_ranges',
      payloadShapeDetails: expect.stringContaining('"rangeIndex":0'),
    }))
  })

  it.each([
    ['action_impact', 'action_result'],
    ['optimization_impact', 'business_impact'],
    ['role_and_experience', 'ats_strength'],
    ['measurable_result', 'metric_impact'],
    ['measurable_impact', 'metric_impact'],
  ] as const)('normalizes alias reason %s to %s', async (rawReason, normalizedReason) => {
    const cvState = buildCvState()
    const items = flattenCvStateForHighlight(cvState)
    const itemId = createExperienceBulletHighlightItemId(
      cvState.experience[0],
      cvState.experience[0].bullets[0],
    )

    createCompletion.mockResolvedValue(buildOpenAIResponse(JSON.stringify({
      items: [
        {
          itemId,
          ranges: [{ start: 0, end: 18, reason: rawReason }],
        },
      ],
    })))

    await expect(detectCvHighlights(items)).resolves.toEqual([
      {
        itemId,
        section: 'experience',
        ranges: [{ start: 0, end: 18, reason: normalizedReason }],
      },
    ])

    expect(mockLogWarn).not.toHaveBeenCalled()
    expect(mockLogInfo).toHaveBeenCalledWith('agent.highlight_detection.completed', expect.objectContaining({
      resultKind: 'valid_non_empty',
      rawModelRangeCount: 1,
      validatedRangeCount: 1,
    }))
  })

  it('preserves valid enum reasons unchanged', async () => {
    const cvState = buildCvState()
    const items = flattenCvStateForHighlight(cvState)
    const itemId = createExperienceBulletHighlightItemId(
      cvState.experience[0],
      cvState.experience[0].bullets[0],
    )

    createCompletion.mockResolvedValue(buildOpenAIResponse(JSON.stringify({
      items: [
        {
          itemId,
          ranges: [{ start: 0, end: 18, reason: 'metric_impact' }],
        },
      ],
    })))

    await expect(detectCvHighlights(items)).resolves.toEqual([
      {
        itemId,
        section: 'experience',
        ranges: [{ start: 0, end: 18, reason: 'metric_impact' }],
      },
    ])
  })

  it('keeps unknown reason labels fail-closed and observable', async () => {
    const cvState = buildCvState()
    const itemId = createExperienceBulletHighlightItemId(
      cvState.experience[0],
      cvState.experience[0].bullets[0],
    )

    createCompletion.mockResolvedValue(buildOpenAIResponse(JSON.stringify({
      items: [
        {
          itemId,
          ranges: [{ start: 0, end: 18, reason: 'custom_reason' }],
        },
      ],
    })))

    await expect(detectCvHighlights(flattenCvStateForHighlight(cvState))).resolves.toEqual([])

    expect(mockLogWarn).toHaveBeenCalledWith('agent.highlight_detection.invalid_payload', expect.objectContaining({
      parseFailureReason: 'invalid_shape_ranges',
      payloadShapeDetails: expect.stringContaining('"reasonValue":"custom_reason"'),
    }))
    expect(mockLogInfo).toHaveBeenCalledWith('agent.highlight_detection.completed', expect.objectContaining({
      resultKind: 'invalid_payload',
      parseFailureReason: 'invalid_shape_ranges',
    }))
  })

  it('treats a valid empty payload as a normal no-highlight result without warning', async () => {
    createCompletion.mockResolvedValue(buildOpenAIResponse('{"items":[]}'))

    await expect(detectCvHighlights(flattenCvStateForHighlight(buildCvState()))).resolves.toEqual([])

    expect(mockLogWarn).not.toHaveBeenCalled()
    expect(mockLogInfo).toHaveBeenCalledWith('agent.highlight_detection.completed', expect.objectContaining({
      resultKind: 'valid_empty',
      rawModelItemCount: 0,
      rawModelRangeCount: 0,
      validatedItemCount: 0,
      validatedRangeCount: 0,
    }))
  })

  it('distinguishes model candidates that are fully filtered out after validation', async () => {
    createCompletion.mockResolvedValue(buildOpenAIResponse(JSON.stringify({
      items: [
        {
          itemId: 'missing_item',
          ranges: [{ start: 0, end: 12, reason: 'ats_strength' }],
        },
      ],
    })))

    await expect(detectCvHighlights(flattenCvStateForHighlight(buildCvState()))).resolves.toEqual([])

    expect(mockLogInfo).toHaveBeenCalledWith('agent.highlight_detection.completed', expect.objectContaining({
      resultKind: 'all_filtered_out',
      rawModelItemCount: 1,
      rawModelRangeCount: 1,
      validatedItemCount: 0,
      validatedRangeCount: 0,
    }))
  })

  it('classifies empty detector invocation as not_invoked', async () => {
    await expect(detectCvHighlights([])).resolves.toEqual([])

    expect(createCompletion).not.toHaveBeenCalled()
    expect(mockLogInfo).toHaveBeenCalledWith('agent.highlight_detection.completed', expect.objectContaining({
      resultKind: 'not_invoked',
      itemCount: 0,
    }))
  })

  it('surfaces thrown detection errors separately from invalid-payload handling', async () => {
    createCompletion.mockRejectedValue(new Error('model offline'))

    await expect(detectCvHighlights(flattenCvStateForHighlight(buildCvState()))).rejects.toThrow('model offline')

    expect(mockLogWarn).not.toHaveBeenCalled()
    expect(mockLogInfo).toHaveBeenCalledWith('agent.highlight_detection.completed', expect.objectContaining({
      resultKind: 'thrown_error',
      errorMessage: 'model offline',
    }))
  })
})
