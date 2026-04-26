import { z } from 'zod'
import { zodResponseFormat } from 'openai/helpers/zod'

import { AGENT_CONFIG, MODEL_CONFIG } from '@/lib/agent/config'
import { trackApiUsage } from '@/lib/agent/usage-tracker'
import { callOpenAIWithRetry, getChatCompletionText, getChatCompletionUsage } from '@/lib/openai/chat'
import { openai } from '@/lib/openai/client'
import { recordMetricCounter } from '@/lib/observability/metric-events'
import { logInfo, logWarn } from '@/lib/observability/structured-log'
import {
  CV_HIGHLIGHT_ARTIFACT_VERSION,
  type CvHighlightState,
  type CvHighlightDetectionResult,
  type CvHighlightInputItem,
  type CvHighlightReason,
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
  fragment: z.string().min(1),
  start: z.number().int().optional(),
  end: z.number().int().optional(),
  reason: cvHighlightReasonSchema,
}).strict().superRefine((value, context) => {
  const hasStart = typeof value.start === 'number'
  const hasEnd = typeof value.end === 'number'

  if (hasStart !== hasEnd) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'start and end must be provided together.',
    })
  }
})

const cvHighlightDetectionItemSchema = z.object({
  itemId: z.string().min(1),
  ranges: z.array(cvHighlightDetectionRangeSchema),
}).strict()

const cvHighlightDetectionEnvelopeSchema = z.object({
  items: z.array(cvHighlightDetectionItemSchema),
}).strict()

const cvHighlightStructuredRangeSchema = z.object({
  fragment: z.string().min(1),
  start: z.number().int().nullable(),
  end: z.number().int().nullable(),
  reason: cvHighlightReasonSchema,
}).strict().superRefine((value, context) => {
  const hasNumericOffsets = typeof value.start === 'number' && typeof value.end === 'number'
  const hasNullOffsets = value.start === null && value.end === null

  if (!hasNumericOffsets && !hasNullOffsets) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'start and end must both be integers or both be null.',
    })
  }
})

const cvHighlightStructuredItemSchema = z.object({
  itemId: z.string().min(1),
  ranges: z.array(cvHighlightStructuredRangeSchema),
}).strict()

const cvHighlightStructuredEnvelopeSchema = z.object({
  items: z.array(cvHighlightStructuredItemSchema),
}).strict()

const MAX_INVALID_HIGHLIGHT_PAYLOAD_SAMPLE_LENGTH = 400
const ALLOWED_HIGHLIGHT_REASONS: CvHighlightReason[] = [
  'metric_impact',
  'business_impact',
  'action_result',
  'ats_strength',
  'tool_context',
]

const HIGHLIGHT_REASON_ALIASES: Record<string, CvHighlightReason> = {
  action_impact: 'action_result',
  optimization_impact: 'business_impact',
  role_and_experience: 'ats_strength',
  measurable_result: 'metric_impact',
  measurable_impact: 'metric_impact',
}

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

function sanitizeJobKeywords(jobKeywords?: string[]): string[] {
  if (!Array.isArray(jobKeywords) || jobKeywords.length === 0) {
    return []
  }

  return Array.from(new Set(
    jobKeywords
      .map((keyword) => keyword.trim())
      .filter(Boolean),
  )).slice(0, 20)
}

function buildHighlightSystemPrompt(jobKeywords: string[] = []): string {
  const sanitizedJobKeywords = sanitizeJobKeywords(jobKeywords)

  return [
    'You detect strong inline highlight spans for a rewritten resume preview.',
    'Return only structured JSON that matches the provided schema.',
    '',
    'Never invent itemId values.',
    'Each highlight must copy the exact fragment text from the item text into the "fragment" field.',
    'Do not paraphrase, translate, normalize accents, or change punctuation inside the fragment.',
    'Use "ranges" as an array of objects with: fragment, reason, start, and end.',
    'Prefer getting the fragment text exactly right over guessing numeric offsets.',
    'When you are not highly confident in numeric offsets, set "start": null and "end": null.',
    'Include numeric start/end only when you are highly confident they match the exact fragment.',
    'Do not create unnecessary overlaps.',
    'If an item has no meaningful highlight, omit it from the response.',
    '',
    'The reason value must be exactly one of these five labels:',
    '- metric_impact',
    '- business_impact',
    '- action_result',
    '- ats_strength',
    '- tool_context',
    'Do not invent synonyms or alternate reason labels.',
    'Do not use labels such as action_impact, optimization_impact, role_and_experience, or measurable_result.',
    'If unsure, map to the closest allowed reason from the five-label list above.',
    '',
    'Highlight only compact, high-value spans.',
    'Prefer phrase-level spans over isolated tokens.',
    'Prefer 2-10 word spans whenever possible.',
    'Prefer the smallest span that preserves the strongest information unit.',
    'Do not highlight full sentences by default.',
    'Do not highlight entire bullets unless the whole bullet is a compact measurable outcome.',
    'Do not highlight nearly the entire summary.',
    'Avoid highlighting more than one compact fragment when one is enough.',
    'The fragment must start and end on a complete semantic unit.',
    'A slightly longer natural phrase is better than a machine-cut fragment.',
    'Never return an isolated number or percentage without its immediate measured context when that context exists in the same bullet.',
    'When a measurable or business-significant phrase needs one immediate complement to feel complete, include that complement in the fragment.',
    '',
    'Most important editorial rule:',
    'Do NOT default to the beginning of the sentence.',
    'Do NOT highlight generic lead-in verbs when a denser and more valuable semantic nucleus appears later in the same bullet.',
    'Do NOT start on a generic action verb if the stronger nucleus begins later in the same bullet.',
    '',
    'Prioritize highlight targets in this order:',
    '1. measurable results or quantified impact',
    '2. scale, complexity, or technically distinctive scope',
    '3. business outcomes',
    '4. distinctive technical specialization',
    '5. ownership or responsibility scope',
    '6. tool context only when no stronger nucleus exists',
    '',
    'Prefer strong editorial nuclei such as:',
    '- "reduced processing time by 40%"',
    '- "zero downtime"',
    '- "migration of more than 30 applications"',
    '- "scalable processing of large data volumes"',
    '- "data modeling and governance"',
    '- "best practices for data development and modeling"',
    '- "processing scalability for high-volume data flows"',
    '',
    'Avoid weaker spans like:',
    '- "Developed pipelines"',
    '- "Acted as consultant"',
    '- "Built dashboards"',
    '- "Led initiatives"',
    '- "Worked on data projects"',
    'when a more informative nucleus exists later in the same bullet.',
    '',
    'If a bullet begins with a generic action verb but later contains a stronger measurable, scalable, architectural, or business-significant phrase, highlight the later phrase instead.',
    '',
    ...(sanitizedJobKeywords.length > 0
      ? [
          'Optional vacancy prioritization:',
          `- When two highlight candidates are similarly strong, prefer the fragment that truthfully reinforces these vacancy signals already present in the rewritten text: ${sanitizedJobKeywords.join(', ')}.`,
          '- Vacancy keyword overlap is a tie-breaker only. Do not force keyword matches when a stronger measurable or editorial nucleus exists.',
          '',
        ]
      : []),
    'Examples:',
    'Prefer "scalable processing of large data volumes" over "Developed ETL pipelines".',
    'Prefer "reduced processing time by 40%" over "Optimized pipelines".',
    'Prefer "migration of more than 30 Qlik applications" over "Led migration initiative".',
    'Prefer "best practices for data development and modeling" over "Acted as consultant".',
    '',
    'Negative example:',
    'Bullet: "Otimizei pipelines com salting e repartitioning, reduzindo em até 40% o tempo de processamento."',
    'Invalid fragment: "Otimizei pipelines com salting e repartitioning, reduzindo em até 40%".',
    'Valid fragment: "reduzindo em até 40% o tempo de processamento".',
    'Valid alternative when still compact and natural: the full measurable semantic unit.',
    '',
    'Negative example:',
    'Bullet: "Liderei a migracao de mais de 30 aplicacoes Qlik Sense para Qlik Cloud."',
    'Invalid fragment: "mais de 30".',
    'Valid fragment: the complete migration phrase with volume plus source and destination.',
    '',
    'Respond with {"items":[{"itemId":"...","ranges":[{"fragment":"reduced processing time by 40%","reason":"metric_impact","start":null,"end":null}]}]}.',
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

function hasOnlyAllowedKeys(
  value: Record<string, unknown>,
  allowedKeys: string[],
): boolean {
  const allowedKeySet = new Set(allowedKeys)
  return Object.keys(value).every((key) => allowedKeySet.has(key))
}

function truncateInvalidPayloadSample(rawText: string): string {
  const trimmed = rawText.trim()
  if (trimmed.length <= MAX_INVALID_HIGHLIGHT_PAYLOAD_SAMPLE_LENGTH) {
    return trimmed
  }

  return `${trimmed.slice(0, MAX_INVALID_HIGHLIGHT_PAYLOAD_SAMPLE_LENGTH)}...`
}

export type HighlightDetectionResultKind =
  | 'valid_non_empty'
  | 'valid_empty'
  | 'all_filtered_out'
  | 'invalid_payload'
  | 'thrown_error'
  | 'not_invoked'

export type HighlightDetectionOutcome = {
  resultKind: HighlightDetectionResultKind
  itemCount: number
  rawModelItemCount: number
  rawModelRangeCount: number
  validatedItemCount: number
  validatedRangeCount: number
  parseFailureReason?: InvalidHighlightPayloadReason
  errorMessage?: string
}

export type CvHighlightDetectionContext = {
  userId?: string
  sessionId?: string
  workflowMode?: string
  jobKeywords?: string[]
  onCompleted?: (outcome: HighlightDetectionOutcome) => void
}

function countModelHighlights(
  payload: { items: CvHighlightDetectionResult },
): {
  rawModelItemCount: number
  rawModelRangeCount: number
} {
  return {
    rawModelItemCount: payload.items.length,
    rawModelRangeCount: payload.items.reduce((total, item) => total + item.ranges.length, 0),
  }
}

function countResolvedHighlightRanges(
  highlights: CvResolvedHighlight[],
): {
  validatedItemCount: number
  validatedRangeCount: number
} {
  return {
    validatedItemCount: highlights.length,
    validatedRangeCount: highlights.reduce((total, highlight) => total + highlight.ranges.length, 0),
  }
}

function emitHighlightDetectionCompleted(
  outcome: HighlightDetectionOutcome,
  context?: CvHighlightDetectionContext,
): void {
  logInfo('agent.highlight_detection.completed', {
    sessionId: context?.sessionId,
    userId: context?.userId,
    workflowMode: context?.workflowMode,
    stage: 'highlight_detection',
    itemCount: outcome.itemCount,
    rawModelItemCount: outcome.rawModelItemCount,
    rawModelRangeCount: outcome.rawModelRangeCount,
    modelReturnedItemCount: outcome.rawModelItemCount,
    modelReturnedRangeCount: outcome.rawModelRangeCount,
    validatedItemCount: outcome.validatedItemCount,
    validatedRangeCount: outcome.validatedRangeCount,
    resolvedItemCount: outcome.validatedItemCount,
    resolvedHighlightCount: outcome.validatedRangeCount,
    resultKind: outcome.resultKind,
    parseFailureReason: outcome.parseFailureReason,
    errorMessage: outcome.errorMessage,
  })
  recordMetricCounter('architecture.highlight_detection.outcome', {
    workflowMode: context?.workflowMode,
    resultKind: outcome.resultKind,
  })

  try {
    context?.onCompleted?.(outcome)
  } catch {}
}

function normalizeHighlightReason(rawReason: unknown): CvHighlightReason | null {
  if (typeof rawReason !== 'string') {
    return null
  }

  const trimmedReason = rawReason.trim()
  if (!trimmedReason) {
    return null
  }

  if (ALLOWED_HIGHLIGHT_REASONS.includes(trimmedReason as CvHighlightReason)) {
    return trimmedReason as CvHighlightReason
  }

  return HIGHLIGHT_REASON_ALIASES[trimmedReason] ?? null
}

function classifyOffsetPair(
  range: Record<string, unknown>,
): 'missing' | 'null' | 'number' | 'invalid' {
  const hasStartKey = Object.prototype.hasOwnProperty.call(range, 'start')
  const hasEndKey = Object.prototype.hasOwnProperty.call(range, 'end')

  if (!hasStartKey && !hasEndKey) {
    return 'missing'
  }

  if (range.start === null && range.end === null) {
    return 'null'
  }

  if (Number.isInteger(range.start) && Number.isInteger(range.end)) {
    return 'number'
  }

  return 'invalid'
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

      const normalizedRanges = []
      for (let rangeIndex = 0; rangeIndex < item.ranges.length; rangeIndex += 1) {
        const range = item.ranges[rangeIndex]
        const normalizedReason = isPlainObject(range)
          ? normalizeHighlightReason(range.reason)
          : null
        const offsetPairKind = isPlainObject(range)
          ? classifyOffsetPair(range)
          : 'invalid'
        if (
          !isPlainObject(range)
          || !hasOnlyAllowedKeys(range, ['fragment', 'start', 'end', 'reason'])
          || typeof range.fragment !== 'string'
          || range.fragment.trim().length === 0
          || offsetPairKind === 'invalid'
          || normalizedReason === null
        ) {
          return {
            kind: 'invalid_payload',
            reason: 'invalid_shape_ranges',
            details: {
              itemIndex,
              rangeIndex,
              rangeKeys: isPlainObject(range) ? Object.keys(range) : undefined,
              reasonValue: isPlainObject(range) ? range.reason : undefined,
            },
          }
        }

        normalizedRanges.push({
          fragment: range.fragment,
          ...(offsetPairKind === 'number'
            ? {
                start: range.start,
                end: range.end,
              }
            : {}),
          reason: normalizedReason,
        })
      }

      parsed.items[itemIndex] = {
        itemId: item.itemId,
        ranges: normalizedRanges,
      }
    }

    const result = cvHighlightDetectionEnvelopeSchema.safeParse(parsed)
    if (result.success) {
      return { kind: 'valid', value: result.data }
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
  context?: CvHighlightDetectionContext,
): Promise<CvResolvedHighlight[]> {
  const jobKeywords = sanitizeJobKeywords(context?.jobKeywords)

  logInfo('agent.highlight_detection.started', {
    sessionId: context?.sessionId,
    userId: context?.userId,
    workflowMode: context?.workflowMode,
    stage: 'highlight_detection',
    itemCount: items.length,
  })

  if (items.length === 0) {
    emitHighlightDetectionCompleted({
      resultKind: 'not_invoked',
      itemCount: 0,
      rawModelItemCount: 0,
      rawModelRangeCount: 0,
      validatedItemCount: 0,
      validatedRangeCount: 0,
    }, context)
    return []
  }

  try {
    const response = await callOpenAIWithRetry(
      (signal) => openai.chat.completions.create({
        model: MODEL_CONFIG.structuredModel,
        max_completion_tokens: AGENT_CONFIG.rewriterMaxTokens,
        temperature: 0,
        response_format: zodResponseFormat(
          cvHighlightStructuredEnvelopeSchema,
          'cv_highlight_detection',
        ),
        messages: [
          {
            role: 'system',
            content: buildHighlightSystemPrompt(jobKeywords),
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
      emitHighlightDetectionCompleted({
        resultKind: 'invalid_payload',
        itemCount: items.length,
        rawModelItemCount: 0,
        rawModelRangeCount: 0,
        validatedItemCount: 0,
        validatedRangeCount: 0,
        parseFailureReason: parsedPayload.reason,
      }, context)
      return []
    }

    const rawCounts = countModelHighlights(parsedPayload.value)
    const resolvedHighlights = validateAndResolveHighlights(items, parsedPayload.value)
    const validatedCounts = countResolvedHighlightRanges(resolvedHighlights)
    const resultKind: HighlightDetectionResultKind = rawCounts.rawModelRangeCount === 0
      ? 'valid_empty'
      : validatedCounts.validatedRangeCount === 0
        ? 'all_filtered_out'
        : 'valid_non_empty'

    emitHighlightDetectionCompleted({
      resultKind,
      itemCount: items.length,
      rawModelItemCount: rawCounts.rawModelItemCount,
      rawModelRangeCount: rawCounts.rawModelRangeCount,
      validatedItemCount: validatedCounts.validatedItemCount,
      validatedRangeCount: validatedCounts.validatedRangeCount,
    }, context)

    return resolvedHighlights
  } catch (error) {
    emitHighlightDetectionCompleted({
      resultKind: 'thrown_error',
      itemCount: items.length,
      rawModelItemCount: 0,
      rawModelRangeCount: 0,
      validatedItemCount: 0,
      validatedRangeCount: 0,
      errorMessage: error instanceof Error ? error.message : String(error),
    }, context)
    throw error
  }
}

export async function generateCvHighlightState(
  cvState: CVState,
  context?: CvHighlightDetectionContext,
): Promise<CvHighlightState> {
  return {
    source: 'rewritten_cv_state',
    version: CV_HIGHLIGHT_ARTIFACT_VERSION,
    resolvedHighlights: await detectCvHighlights(flattenCvStateForHighlight(cvState), context),
    generatedAt: new Date().toISOString(),
  }
}
