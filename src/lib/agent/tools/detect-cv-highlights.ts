import { z } from 'zod'

import { AGENT_CONFIG, MODEL_CONFIG } from '@/lib/agent/config'
import { trackApiUsage } from '@/lib/agent/usage-tracker'
import { callOpenAIWithRetry, getChatCompletionText, getChatCompletionUsage } from '@/lib/openai/chat'
import { openai } from '@/lib/openai/client'
import { recordMetricCounter } from '@/lib/observability/metric-events'
import { logWarn } from '@/lib/observability/structured-log'
import {
  CV_HIGHLIGHT_ARTIFACT_VERSION,
  type CvHighlightState,
  type CvHighlightDetectionResult,
  type CvHighlightInputItem,
  type CvResolvedHighlight,
  flattenCvStateForHighlight,
  validateAndResolveHighlights,
} from '@/lib/resume/cv-highlight-artifact'
import type { CVState } from '@/types/cv'

const cvHighlightReasonSchema = z.enum([
  'metric_impact',
  'business_impact',
  'action_result',
  'ats_strength',
  'tool_context',
])

const cvHighlightDetectionRangeSchema = z.object({
  start: z.number().int(),
  end: z.number().int(),
  reason: cvHighlightReasonSchema,
}).strict()

const cvHighlightDetectionItemSchema = z.object({
  itemId: z.string().min(1),
  ranges: z.array(cvHighlightDetectionRangeSchema),
}).strict()

const cvHighlightDetectionEnvelopeSchema = z.object({
  items: z.array(cvHighlightDetectionItemSchema),
}).strict()

const MAX_INVALID_HIGHLIGHT_PAYLOAD_SAMPLE_LENGTH = 400

type InvalidHighlightPayloadReason =
  | 'invalid_json'
  | 'invalid_shape_markdown_wrapper'
  | 'invalid_shape_text_before_json'
  | 'invalid_shape_text_after_json'
  | 'invalid_shape_non_object_root'
  | 'invalid_shape_non_array_root'
  | 'invalid_shape_wrapper'
  | 'invalid_shape_keys'
  | 'invalid_shape_ranges'

type ParsedHighlightPayloadResult =
  | { kind: 'valid'; value: { items: CvHighlightDetectionResult } }
  | {
      kind: 'invalid_payload'
      reason: InvalidHighlightPayloadReason
      details?: Record<string, unknown>
    }

function buildHighlightSystemPrompt(): string {
  return [
    'You detect strong inline highlight spans for a rewritten resume preview.',
    'Return only structured JSON.',
    'Return a single JSON object with exactly one top-level key: "items".',
    'Do not include markdown fences.',
    'Do not include explanatory prose before or after the JSON.',
    'Do not wrap the payload in "data", "result", "response", or any other extra object.',
    'Highlight only compact, high-value spans.',
    'Prefer phrase-level spans over isolated tokens.',
    'Prefer 2-10 word spans whenever possible.',
    'Highlight the smallest fragment that preserves meaning.',
    'Highlight measurable results, action-result fragments, business-impact phrases, and strong ATS evidence.',
    'Do not highlight full sentences by default.',
    'Do not highlight entire bullets unless the whole bullet is a compact measurable outcome.',
    'Do not highlight nearly the entire summary.',
    'Avoid highlighting more than one compact fragment when one is enough.',
    'Avoid trivial stack-only highlights unless strongly justified by nearby context.',
    'Never invent itemId values.',
    'Never return ranges outside the item text.',
    'Use "ranges" as an array of objects with exactly: start, end, reason.',
    'Do not create unnecessary overlaps.',
    'If an item has no meaningful highlight, omit it from the response.',
    'Respond with {"items":[{"itemId":"...","ranges":[{"start":0,"end":10,"reason":"ats_strength"}]}]}.',
  ].join('\n')
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasExactKeys(
  value: Record<string, unknown>,
  expectedKeys: string[],
): boolean {
  const actualKeys = Object.keys(value).sort()
  const sortedExpectedKeys = [...expectedKeys].sort()
  return actualKeys.length === sortedExpectedKeys.length
    && actualKeys.every((key, index) => key === sortedExpectedKeys[index])
}

function truncateInvalidPayloadSample(rawText: string): string {
  const trimmed = rawText.trim()
  if (trimmed.length <= MAX_INVALID_HIGHLIGHT_PAYLOAD_SAMPLE_LENGTH) {
    return trimmed
  }

  return `${trimmed.slice(0, MAX_INVALID_HIGHLIGHT_PAYLOAD_SAMPLE_LENGTH)}...`
}

function classifyNonJsonHighlightPayload(rawText: string): InvalidHighlightPayloadReason | null {
  const trimmed = rawText.trim()
  if (!trimmed) {
    return 'invalid_json'
  }

  if (/^```(?:json)?/i.test(trimmed)) {
    return 'invalid_shape_markdown_wrapper'
  }

  const firstJsonStart = trimmed.search(/[{[]/)
  if (firstJsonStart > 0) {
    return 'invalid_shape_text_before_json'
  }

  const lastJsonBoundary = Math.max(trimmed.lastIndexOf('}'), trimmed.lastIndexOf(']'))
  if (lastJsonBoundary >= 0 && lastJsonBoundary < trimmed.length - 1) {
    return 'invalid_shape_text_after_json'
  }

  return null
}

function parseHighlightPayload(rawText: string): ParsedHighlightPayloadResult {
  const nonJsonReason = classifyNonJsonHighlightPayload(rawText)
  if (nonJsonReason) {
    return { kind: 'invalid_payload', reason: nonJsonReason }
  }

  try {
    const parsed = JSON.parse(rawText.trim())
    const result = cvHighlightDetectionEnvelopeSchema.safeParse(parsed)
    if (result.success) {
      return { kind: 'valid', value: result.data }
    }

    if (!isPlainObject(parsed)) {
      return {
        kind: 'invalid_payload',
        reason: 'invalid_shape_non_object_root',
        details: {
          rootType: Array.isArray(parsed) ? 'array' : typeof parsed,
        },
      }
    }

    const rootKeys = Object.keys(parsed)
    if (!('items' in parsed)) {
      const wrapperKey = rootKeys.find((key) => ['data', 'result', 'results', 'response', 'highlights'].includes(key))
      return {
        kind: 'invalid_payload',
        reason: wrapperKey ? 'invalid_shape_wrapper' : 'invalid_shape_keys',
        details: {
          topLevelKeys: rootKeys,
          wrapperKey,
        },
      }
    }

    if (!Array.isArray(parsed.items)) {
      return {
        kind: 'invalid_payload',
        reason: 'invalid_shape_non_array_root',
        details: {
          topLevelKeys: rootKeys,
          itemsType: parsed.items === null ? 'null' : typeof parsed.items,
        },
      }
    }

    for (let itemIndex = 0; itemIndex < parsed.items.length; itemIndex += 1) {
      const item = parsed.items[itemIndex]
      if (!isPlainObject(item) || !hasExactKeys(item, ['itemId', 'ranges'])) {
        return {
          kind: 'invalid_payload',
          reason: 'invalid_shape_keys',
          details: {
            itemIndex,
            itemKeys: isPlainObject(item) ? Object.keys(item) : undefined,
          },
        }
      }

      if (typeof item.itemId !== 'string' || !Array.isArray(item.ranges)) {
        return {
          kind: 'invalid_payload',
          reason: 'invalid_shape_keys',
          details: {
            itemIndex,
            itemKeys: Object.keys(item),
          },
        }
      }

      for (let rangeIndex = 0; rangeIndex < item.ranges.length; rangeIndex += 1) {
        const range = item.ranges[rangeIndex]
        if (
          !isPlainObject(range)
          || !hasExactKeys(range, ['start', 'end', 'reason'])
          || !Number.isInteger(range.start)
          || !Number.isInteger(range.end)
          || !['metric_impact', 'business_impact', 'action_result', 'ats_strength', 'tool_context'].includes(String(range.reason))
        ) {
          return {
            kind: 'invalid_payload',
            reason: 'invalid_shape_ranges',
            details: {
              itemIndex,
              rangeIndex,
              rangeKeys: isPlainObject(range) ? Object.keys(range) : undefined,
            },
          }
        }
      }
    }

    return {
      kind: 'invalid_payload',
      reason: 'invalid_shape_keys',
      details: {
        topLevelKeys: rootKeys,
      },
    }
  } catch {
    return { kind: 'invalid_payload', reason: 'invalid_json' }
  }
}

export async function detectCvHighlights(
  items: CvHighlightInputItem[],
  context?: {
    userId?: string
    sessionId?: string
    workflowMode?: string
  },
): Promise<CvResolvedHighlight[]> {
  if (items.length === 0) {
    return []
  }

  const response = await callOpenAIWithRetry(
    (signal) => openai.chat.completions.create({
      model: MODEL_CONFIG.structuredModel,
      max_completion_tokens: AGENT_CONFIG.rewriterMaxTokens,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: buildHighlightSystemPrompt(),
        },
        {
          role: 'user',
          content: JSON.stringify({ items }),
        },
      ],
    }, { signal }),
    3,
    AGENT_CONFIG.timeout,
    undefined,
    {
      operation: 'detect_cv_highlights',
      stage: 'highlight_detection',
      model: MODEL_CONFIG.structuredModel,
      sessionId: context?.sessionId,
      userId: context?.userId,
    },
  )

  const usage = getChatCompletionUsage(response)
  if (context?.userId && context?.sessionId) {
      trackApiUsage({
        userId: context.userId,
        sessionId: context.sessionId,
        model: MODEL_CONFIG.structuredModel,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        endpoint: 'rewriter',
      }).catch(() => {})
  }

  const text = getChatCompletionText(response)
  const parsedPayload = parseHighlightPayload(text)
  if (parsedPayload.kind === 'invalid_payload') {
    logWarn('agent.highlight_detection.invalid_payload', {
      sessionId: context?.sessionId,
      userId: context?.userId,
      workflowMode: context?.workflowMode,
      stage: 'highlight_detection',
      failureType: 'invalid_model_payload',
      parseFailureReason: parsedPayload.reason,
      itemCount: items.length,
      responseTextLength: text.length,
      responseSample: truncateInvalidPayloadSample(text),
      payloadShapeDetails: parsedPayload.details ? JSON.stringify(parsedPayload.details) : undefined,
    })
    recordMetricCounter('architecture.highlight_detection.invalid_payload', {
      workflowMode: context?.workflowMode,
      parseFailureReason: parsedPayload.reason,
    })
    return []
  }

  return validateAndResolveHighlights(items, parsedPayload.value)
}

export async function generateCvHighlightState(
  cvState: CVState,
  context?: {
    userId?: string
    sessionId?: string
    workflowMode?: string
  },
): Promise<CvHighlightState> {
  return {
    source: 'rewritten_cv_state',
    version: CV_HIGHLIGHT_ARTIFACT_VERSION,
    resolvedHighlights: await detectCvHighlights(flattenCvStateForHighlight(cvState), context),
    generatedAt: new Date().toISOString(),
  }
}
