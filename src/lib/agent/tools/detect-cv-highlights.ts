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

const cvHighlightDetectionEnvelopeSchema = z.object({
  items: z.array(z.object({
    itemId: z.string().min(1),
    ranges: z.array(z.object({
      start: z.number().int(),
      end: z.number().int(),
      reason: z.enum([
        'metric_impact',
        'business_impact',
        'action_result',
        'ats_strength',
        'tool_context',
      ]),
    })),
  })), 
})

type ParsedHighlightPayloadResult =
  | { kind: 'valid'; value: { items: CvHighlightDetectionResult } }
  | { kind: 'invalid_payload'; reason: 'invalid_json' | 'invalid_shape' }

function buildHighlightSystemPrompt(): string {
  return [
    'You detect strong inline highlight spans for a rewritten resume preview.',
    'Return only structured JSON.',
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
    'Do not create unnecessary overlaps.',
    'If an item has no meaningful highlight, omit it from the response.',
    'Respond with {"items":[{"itemId":"...","ranges":[{"start":0,"end":10,"reason":"ats_strength"}]}]}.',
  ].join('\n')
}

function parseHighlightPayload(rawText: string): ParsedHighlightPayloadResult {
  try {
    const parsed = JSON.parse(rawText)
    const result = cvHighlightDetectionEnvelopeSchema.safeParse(parsed)
    return result.success
      ? { kind: 'valid', value: result.data }
      : { kind: 'invalid_payload', reason: 'invalid_shape' }
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
