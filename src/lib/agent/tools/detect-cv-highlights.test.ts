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

import { detectCvHighlights, generateCvHighlightState } from './detect-cv-highlights'
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

function buildResolvedRange(
  text: string,
  fragment: string,
  reason: 'metric_impact' | 'business_impact' | 'action_result' | 'ats_strength' | 'tool_context',
) {
  const start = text.indexOf(fragment)
  if (start === -1) {
    throw new Error(`Fragment not found in text: ${fragment}`)
  }

  return {
    start,
    end: start + fragment.length,
    reason,
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
          ranges: [{ fragment: 'Senior BI engineer', reason: 'ats_strength' }],
        },
      ],
    })))

    await detectCvHighlights(items)

    expect(createCompletion).toHaveBeenCalledTimes(1)
    expect(JSON.parse(createCompletion.mock.calls[0][0].messages[1].content as string)).toEqual({
      items,
    })
    const systemPrompt = createCompletion.mock.calls[0][0].messages[0].content as string
    expect(systemPrompt).not.toContain('Optional vacancy prioritization:')
    expect(createCompletion.mock.calls[0][0].response_format.type).toBe('json_schema')
    expect(mockLogInfo).toHaveBeenCalledWith('agent.highlight_detection.started', expect.objectContaining({
      itemCount: items.length,
      stage: 'highlight_detection',
    }))
  })

  it('includes vacancy keyword prioritization only when job keywords are provided', async () => {
    const items = flattenCvStateForHighlight(buildCvState())

    createCompletion.mockResolvedValue(buildOpenAIResponse('{"items":[]}'))

    await detectCvHighlights(items, {
      workflowMode: 'job_targeting',
      jobKeywords: ['Tableau', 'dbt'],
    })

    const systemPrompt = createCompletion.mock.calls[0][0].messages[0].content as string
    expect(systemPrompt).toContain('Optional vacancy prioritization:')
    expect(systemPrompt).toContain('Tableau, dbt')
    expect(systemPrompt).toContain('Vacancy keyword overlap is a tie-breaker only.')
  })

  it('generates an ATS highlight artifact without vacancy keywords and tags the source as ats_enhancement', async () => {
    createCompletion.mockResolvedValue(buildOpenAIResponse('{"items":[]}'))

    const highlightState = await generateCvHighlightState(buildCvState(), {
      workflowMode: 'ats_enhancement',
      sessionId: 'sess_ats_only',
      userId: 'usr_123',
    })

    expect(highlightState.highlightSource).toBe('ats_enhancement')
    expect(highlightState.highlightGeneratedAt).toBe(highlightState.generatedAt)

    const systemPrompt = createCompletion.mock.calls[0][0].messages[0].content as string
    expect(systemPrompt).not.toContain('Optional vacancy prioritization:')
  })

  it('defaults the highlight source to ats_enhancement when workflowMode is omitted', async () => {
    createCompletion.mockResolvedValue(buildOpenAIResponse('{"items":[]}'))

    const highlightState = await generateCvHighlightState(buildCvState())

    expect(highlightState.highlightSource).toBe('ats_enhancement')
    expect(highlightState.highlightGeneratedAt).toBe(highlightState.generatedAt)
  })

  it('still accepts a stronger non-keyword semantic nucleus even when job keywords are provided', async () => {
    const cvState = buildCvState()
    const items = flattenCvStateForHighlight(cvState)
    const text = cvState.experience[0].bullets[0]
    const fragment = 'Reduced processing time by 40%'
    const itemId = createExperienceBulletHighlightItemId(
      cvState.experience[0],
      text,
    )

    createCompletion.mockResolvedValue(buildOpenAIResponse(JSON.stringify({
      items: [
        {
          itemId,
          ranges: [{ fragment, reason: 'metric_impact' }],
        },
      ],
    })))

    await expect(detectCvHighlights(items, {
      workflowMode: 'job_targeting',
      jobKeywords: ['Databricks'],
    })).resolves.toEqual([
      {
        itemId,
        section: 'experience',
        ranges: [buildResolvedRange(text, fragment, 'metric_impact')],
      },
    ])
  })

  it('accepts a keyword-aligned fragment when the model chooses that tie-breaker path', async () => {
    const cvState = buildCvState()
    const items = flattenCvStateForHighlight(cvState)
    const text = cvState.experience[0].bullets[0]
    const fragment = 'Azure Databricks'
    const itemId = createExperienceBulletHighlightItemId(
      cvState.experience[0],
      text,
    )

    createCompletion.mockResolvedValue(buildOpenAIResponse(JSON.stringify({
      items: [
        {
          itemId,
          ranges: [{ fragment, reason: 'tool_context' }],
        },
      ],
    })))

    await expect(detectCvHighlights(items, {
      workflowMode: 'job_targeting',
      jobKeywords: ['Databricks'],
    })).resolves.toEqual([
      {
        itemId,
        section: 'experience',
        ranges: [buildResolvedRange(text, fragment, 'tool_context')],
      },
    ])
  })

  it('hardens the detector prompt around semantic closure and weak generic starts', async () => {
    // Prompt string inspection is documentation only. The real gate for prompt hardening
    // lives in the response-fixture tests below, which run the resolver against model output.
    const items = flattenCvStateForHighlight(buildCvState())

    createCompletion.mockResolvedValue(buildOpenAIResponse('{"items":[]}'))

    await detectCvHighlights(items)

    const systemPrompt = createCompletion.mock.calls[0]?.[0].messages[0].content as string

    expect(systemPrompt).toContain('The fragment must start and end on a complete semantic unit.')
    expect(systemPrompt).toContain('Never return an isolated number or percentage without its immediate measured context')
    expect(systemPrompt).toContain('Each highlight must copy the exact fragment text')
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
    const fragment = 'Reduced costs by 40%'
    const modelRange = buildResolvedRange(text, fragment, 'metric_impact')

    createCompletion.mockResolvedValue(buildOpenAIResponse(JSON.stringify({
      items: [{
        itemId: 'exp_test_item',
        ranges: [{ fragment, reason: 'metric_impact' }],
      }],
    })))

    const result = await detectCvHighlights(items)

    expect(result).toEqual([{
      itemId: 'exp_test_item',
      section: 'experience',
      ranges: [modelRange],
    }])
  })

  it('drops invalid item ids while preserving valid fragment matches', async () => {
    const items = flattenCvStateForHighlight(buildCvState())
    const text = buildCvState().experience[0].bullets[0]
    const itemId = createExperienceBulletHighlightItemId(
      buildCvState().experience[0],
      text,
    )
    const expectedRange = buildResolvedRange(text, 'Reduced processing time by 40%', 'metric_impact')

    createCompletion.mockResolvedValue(buildOpenAIResponse(JSON.stringify({
      items: [
        {
          itemId: 'missing',
          ranges: [{ fragment: 'Senior BI engineer', reason: 'ats_strength' }],
        },
        {
          itemId,
          ranges: [
            { fragment: 'Reduced processing time by 40%', reason: 'metric_impact' },
          ],
        },
      ],
    })))

    await expect(detectCvHighlights(items)).resolves.toEqual([
      {
        itemId,
        section: 'experience',
        ranges: [expectedRange],
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
          ranges: [{ fragment: 'Reduced processing time by 40%', startOffset: 0, end: 10, reason: 'ats_strength' }],
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
    const text = cvState.experience[0].bullets[0]
    const fragment = 'Reduced processing time by 40%'
    const itemId = createExperienceBulletHighlightItemId(
      cvState.experience[0],
      text,
    )

    createCompletion.mockResolvedValue(buildOpenAIResponse(JSON.stringify({
      items: [
        {
          itemId,
          ranges: [{ fragment, reason: rawReason }],
        },
      ],
    })))

    await expect(detectCvHighlights(items)).resolves.toEqual([
      {
        itemId,
        section: 'experience',
        ranges: [buildResolvedRange(text, fragment, normalizedReason)],
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
    const text = cvState.experience[0].bullets[0]
    const fragment = 'Reduced processing time by 40%'
    const itemId = createExperienceBulletHighlightItemId(
      cvState.experience[0],
      text,
    )

    createCompletion.mockResolvedValue(buildOpenAIResponse(JSON.stringify({
      items: [
        {
          itemId,
          ranges: [{ fragment, reason: 'metric_impact' }],
        },
      ],
    })))

    await expect(detectCvHighlights(items)).resolves.toEqual([
      {
        itemId,
        section: 'experience',
        ranges: [buildResolvedRange(text, fragment, 'metric_impact')],
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
          ranges: [{ fragment: 'Reduced processing time by 40%', reason: 'custom_reason' }],
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
          ranges: [{ fragment: 'Senior BI engineer', reason: 'ats_strength' }],
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
